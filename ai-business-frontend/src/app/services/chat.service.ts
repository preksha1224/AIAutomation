import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

interface ChatResponse {
  answer?: string;
  text?: string;
  result?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly chatWebhook =
    'https://intn8n.deenovum.com/webhook-test/23211c68-7bcd-42bb-b472-8a5b2cc14b5e';

  private readonly amazonChatWebhook =
    'https://intn8n.deenovum.com/webhook-test/23211c68-7bcd-42bb-b472-8a5b2cc14b5e';

  constructor(private http: HttpClient) {}

  sendMessage(prompt: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(this.chatWebhook, { prompt });
  }

  sendAmazonMessage(prompt: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(this.amazonChatWebhook, { prompt });
  }
}
