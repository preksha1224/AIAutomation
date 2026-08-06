import { Component } from '@angular/core';
import { catchError, finalize, of, timeout } from 'rxjs';
import { ChatService } from '../services/chat.service';

interface ChatApiResponse {
  answer?: string;
  text?: string;
  result?: string;
  message?: string;
  [key: string]: any;
}

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

    if (!message) {
      return;
    }

    this.conversation.push({
      role: 'user',
      content: message,
    });

    this.prompt = '';
    this.loading = true;

    this.amazonChatService
      .sendMessage(message)
      .pipe(
        timeout(20000),
        catchError((error) => {
          console.error('Amazon Chat Error:', error);

          return of({
            answer: 'Unable to reach the Amazon AI service.',
          } as ChatApiResponse);
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((response: ChatApiResponse) => {
        const assistantReply =
          response.answer ??
          response.text ??
          response.result ??
          response.message ??
          'No response received.';

        this.conversation.push({
          role: 'assistant',
          content: assistantReply,
        });
      });
  }
}
