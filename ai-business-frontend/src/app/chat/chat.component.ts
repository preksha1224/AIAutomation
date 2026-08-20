import { ChangeDetectorRef, Component } from '@angular/core';

import { catchError, finalize, of, timeout } from 'rxjs';

import { ChatService, ChatResponse } from '../services/chat.service';

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent {
  prompt = '';

  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
  }> = [];

  loading = false;

  constructor(
    private readonly chatService: ChatService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  sendMessage(): void {
    // ==========================================================
    // GET USER MESSAGE
    // ==========================================================

    const messageText = this.prompt.trim();

    if (!messageText || this.loading) {
      return;
    }

    // ==========================================================
    // ADD USER MESSAGE IMMEDIATELY
    // ==========================================================

    this.conversation.push({
      role: 'user',
      content: messageText,
    });

    // Clear input immediately
    this.prompt = '';

    // Start loading state
    this.loading = true;

    // Force UI update
    this.cdr.detectChanges();

    console.log('========== CHAT REQUEST ==========');

    console.log('Question:', messageText);

    // ==========================================================
    // SEND TO AI
    // ==========================================================

    this.chatService
      .sendMessage(messageText)
      .pipe(
        timeout(60000),

        catchError((error) => {
          console.error('Chat send error:', error);

          return of({
            answer: 'Unable to reach the AI chat service. Please try again.',
          } as ChatResponse);
        }),

        finalize(() => {
          this.loading = false;

          /*
           * IMPORTANT:
           *
           * Force Angular to immediately update the UI.
           */
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response: ChatResponse) => {
          console.log('========== CHAT RESPONSE ==========');

          console.log('Response:', response);

          // ====================================================
          // EXTRACT AI RESPONSE
          // ====================================================

          const assistantText = this.extractAssistantResponse(response);

          console.log('Assistant text:', assistantText);

          // ====================================================
          // ADD AI RESPONSE
          // ====================================================

          this.conversation.push({
            role: 'assistant',
            content: assistantText,
          });

          // ====================================================
          // FORCE IMMEDIATE UI UPDATE
          // ====================================================

          this.cdr.detectChanges();

          console.log('Conversation:', this.conversation);
        },

        error: (error) => {
          console.error('Unexpected chat error:', error);

          this.conversation.push({
            role: 'assistant',
            content: 'Unable to get a response from the AI. Please try again.',
          });

          this.loading = false;

          this.cdr.detectChanges();
        },
      });
  }

  // ==========================================================
  // EXTRACT AI RESPONSE
  // ==========================================================

  private extractAssistantResponse(response: ChatResponse): string {
    if (typeof response === 'string') {
      return response;
    }

    if (response?.answer) {
      return String(response.answer);
    }

    if (response?.output) {
      return String(response.output);
    }

    if (response?.text) {
      return String(response.text);
    }

    if (response?.result) {
      return String(response.result);
    }

    if (response?.message) {
      return String(response.message);
    }

    return 'No response received.';
  }
}
