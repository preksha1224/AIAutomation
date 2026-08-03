import { Component } from '@angular/core';
import { catchError, finalize, of, timeout } from 'rxjs';
import { ChatService } from '../services/chat.service';

type ChatApiResponse = {
  answer?: string;
  text?: string;
  result?: string;
  message?: string;
  [key: string]: any;
};

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
    if (!this.prompt.trim()) {
      return;
    }

    const userMessage = { role: 'user' as const, content: this.prompt.trim() };
    this.conversation.push(userMessage);
    this.prompt = '';
    this.loading = true;

    this.chatService.sendMessage(userMessage.content).pipe(
      timeout(20000),
      catchError((error) => {
        console.error('Chat send error', error);
        return of({ answer: 'Unable to reach the AI chat service.' } as ChatApiResponse);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((response: ChatApiResponse) => {
      const assistantText =
        response?.answer ?? response?.text ?? response?.result ?? response?.message ?? JSON.stringify(response);
      this.conversation.push({ role: 'assistant', content: assistantText });
    });
  }
}
