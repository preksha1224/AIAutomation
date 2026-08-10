import { Component } from '@angular/core';
import { catchError, finalize, of, timeout } from 'rxjs';
import { ChatService, ChatResponse } from '../services/chat.service';

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent {
  prompt = '';
  conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  loading = false;

  constructor(private chatService: ChatService) {}

  sendMessage() {
    const messageText = this.prompt.trim();
    if (!messageText || this.loading) {
      return;
    }

    const userMessage = { role: 'user' as const, content: messageText };
    this.conversation.push(userMessage);
    this.prompt = '';
    this.loading = true;

    this.chatService.sendMessage(messageText).pipe(
      timeout(15000),
      catchError((error) => {
        console.error('Chat send error:', error);
        return of({ answer: 'Unable to reach the AI chat service. Please try again.' } as ChatResponse);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((response: ChatResponse) => {
      const assistantText =
        response?.answer ??
        response?.output ??
        response?.text ??
        response?.result ??
        response?.message ??
        (typeof response === 'string' ? response : 'No response received.');

      this.conversation.push({ role: 'assistant', content: assistantText });
    });
  }
}
