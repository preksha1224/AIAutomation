import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, timeout } from 'rxjs';

export interface ChatResponse {
  answer?: string;
  text?: string;
  result?: string;
  message?: string;
  output?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  // Production endpoints execute instantly without n8n test canvas delay
  private readonly chatWebhookProd =
    'https://intn8n.deenovum.com/webhook/2c5793aa-6d9c-439e-a7ec-1900a1aab3a8';
  private readonly chatWebhookTest =
    'https://intn8n.deenovum.com/webhook-test/2c5793aa-6d9c-439e-a7ec-1900a1aab3a8';

  private readonly amazonChatWebhookProd =
    'https://intn8n.deenovum.com/webhook/23211c68-7bcd-42bb-b472-8a5b2cc14b5e';
  private readonly amazonChatWebhookTest =
    'https://intn8n.deenovum.com/webhook-test/23211c68-7bcd-42bb-b472-8a5b2cc14b5e';

  constructor(private readonly http: HttpClient) {}

  private normalizeChatResponse(response: unknown): ChatResponse {
    if (typeof response === 'string') {
      return { answer: response };
    }

    if (Array.isArray(response) && response.length > 0) {
      return this.normalizeChatResponse(response[0]);
    }

    if (!response || typeof response !== 'object') {
      return {};
    }

    const payload = response as Record<string, unknown>;
    const directOutput = payload['output'];

    if (typeof directOutput === 'string' && directOutput.trim()) {
      return {
        ...payload,
        output: directOutput,
        answer: directOutput,
      };
    }

    const nestedPayload =
      payload['data'] ?? payload['result'] ?? payload['item'] ?? payload['json'];

    if (nestedPayload && typeof nestedPayload === 'object') {
      const normalizedNested = this.normalizeChatResponse(nestedPayload);
      return {
        ...payload,
        ...normalizedNested,
      };
    }

    return payload as ChatResponse;
  }

  /**
   * Fast AI Chat request with production endpoint priority
   */
sendMessage(
  prompt: string,
  sessionId: string
): Observable<ChatResponse> {

  const headers = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  const payload = {
    prompt,
    session_id: sessionId,
  };

  console.log('========== CHAT REQUEST ==========');
  console.log('Prompt:', prompt);
  console.log('Session ID:', sessionId);
  console.log('Payload:', payload);

  return this.http
    .post<ChatResponse>(
      this.chatWebhookProd,
      payload,
      { headers }
    )
    .pipe(

      map((response) =>
        this.normalizeChatResponse(response)
      ),

      timeout(65000),

      catchError((prodErr) => {

        console.warn(
          'Prod webhook fallback to test endpoint:',
          prodErr
        );

        return this.http
          .post<ChatResponse>(
            this.chatWebhookTest,
            payload,
            { headers }
          )
          .pipe(

            map((response) =>
              this.normalizeChatResponse(response)
            ),

            timeout(12000),

          );
      }),

    );
}

  /**
   * Fast Amazon Chat request with production endpoint priority
   */
  sendAmazonMessage(prompt: string): Observable<ChatResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const payload = { prompt };

    return this.http.post<ChatResponse>(this.amazonChatWebhookProd, payload, { headers }).pipe(
      map((response) => this.normalizeChatResponse(response)),
      timeout(65000),
      catchError((prodErr) => {
        console.warn('Amazon Prod webhook fallback to test endpoint:', prodErr);
        return this.http.post<ChatResponse>(this.amazonChatWebhookTest, payload, { headers }).pipe(
          map((response) => this.normalizeChatResponse(response)),
          timeout(60000),
        );
      }),
    );
  }
}
