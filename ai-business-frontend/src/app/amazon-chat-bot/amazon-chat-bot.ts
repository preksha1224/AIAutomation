import { Component } from '@angular/core';
import { catchError, finalize, of, timeout } from 'rxjs';
import { ChatService, ChatResponse } from '../services/chat.service';

@Component({
  selector: 'app-amazon-chat-bot',
  standalone: false,
  templateUrl: './amazon-chat-bot.html',
  styleUrl: './amazon-chat-bot.scss',
})
export class AmazonChatBot {
  prompt = '';

  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
  }> = [];

  loading = false;

  constructor(private amazonChatService: ChatService) {}

  sendMessage(): void {
    const message = this.prompt.trim();

    if (!message || this.loading) {
      return;
    }

    this.conversation.push({
      role: 'user',
      content: message,
    });

    this.prompt = '';
    this.loading = true;

    this.amazonChatService
      .sendAmazonMessage(message)
      .pipe(
        timeout(15000),
        catchError((error) => {
          console.error('Amazon Chat Error:', error);
          return of({
            answer: 'Unable to reach the Amazon AI service. Please check your connection or backend webhook.',
          } as ChatResponse);
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((response: ChatResponse) => {
        const assistantReply =
          response.answer ??
          response.text ??
          response.result ??
          response.message ??
          (typeof response === 'string' ? response : 'No response received.');

        this.conversation.push({
          role: 'assistant',
          content: assistantReply,
        });
      });
  }
}
