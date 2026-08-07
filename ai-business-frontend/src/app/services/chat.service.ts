import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, timeout } from 'rxjs';

export interface ChatResponse {
  answer?: string;
  text?: string;
  result?: string;
  message?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  // Production endpoints execute instantly without n8n test canvas delay
  private readonly chatWebhookProd =
    'https://intn8n.deenovum.com/webhook/23211c68-7bcd-42bb-b472-8a5b2cc14b5e';
  private readonly chatWebhookTest =
    'https://intn8n.deenovum.com/webhook/23211c68-7bcd-42bb-b472-8a5b2cc14b5e';

  private readonly amazonChatWebhookProd =
    'https://intn8n.deenovum.com/webhook/23211c68-7bcd-42bb-b472-8a5b2cc14b5e';
  private readonly amazonChatWebhookTest =
    'https://intn8n.deenovum.com/webhook-test/23211c68-7bcd-42bb-b472-8a5b2cc14b5e';

  constructor(private readonly http: HttpClient) { }

  /**
   * Fast AI Chat request with production endpoint priority
   */
  sendMessage(prompt: string): Observable<ChatResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const payload = { prompt };

    return this.http.post<ChatResponse>(this.chatWebhookProd, payload, { headers }).pipe(
      timeout(12000),
      catchError((prodErr) => {
        console.warn('Prod webhook fallback to test endpoint:', prodErr);
        return this.http.post<ChatResponse>(this.chatWebhookTest, payload, { headers }).pipe(
          timeout(12000)
        );
      })
    );
  }

  /**
   * Fast Amazon Chat request with production endpoint priority
   */
  sendAmazonMessage(prompt: string): Observable<ChatResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const payload = { prompt };

    return this.http.post<ChatResponse>(this.amazonChatWebhookProd, payload, { headers }).pipe(
      timeout(12000),
      catchError((prodErr) => {
        console.warn('Amazon Prod webhook fallback to test endpoint:', prodErr);
        return this.http.post<ChatResponse>(this.amazonChatWebhookTest, payload, { headers }).pipe(
          timeout(12000)
        );
      })
    );
  }
}
