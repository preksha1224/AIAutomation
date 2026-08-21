import {
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';

import {
  catchError,
  finalize,
  of,
  timeout,
} from 'rxjs';

import {
  ChatService,
  ChatResponse,
} from '../services/chat.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit {

  // ==========================================================
  // STORAGE KEYS
  // ==========================================================

  private readonly sessionStorageKey =
    'intelligent-document-rag.session-id';

  private readonly chatHistoryStorageKey =
    'intelligent-document-rag.chat-history';


  // ==========================================================
  // CHAT STATE
  // ==========================================================

  prompt = '';

  conversation: ChatMessage[] = [];

  loading = false;

  sessionId = '';


  // ==========================================================
  // CONSTRUCTOR
  // ==========================================================

  constructor(
    private readonly chatService: ChatService,
    private readonly cdr: ChangeDetectorRef,
  ) {}


  // ==========================================================
  // INIT
  // ==========================================================

  ngOnInit(): void {

    this.initializeSession();

    this.loadConversation();

    this.cdr.detectChanges();

  }


  // ==========================================================
  // SESSION ID
  // ==========================================================

  private initializeSession(): void {

    const existingSessionId =
      localStorage.getItem(
        this.sessionStorageKey
      );

    if (existingSessionId?.trim()) {

      this.sessionId =
        existingSessionId;

      console.log(
        'Using existing chat session:',
        this.sessionId
      );

      return;
    }


    this.sessionId =
      this.generateSessionId();


    localStorage.setItem(
      this.sessionStorageKey,
      this.sessionId
    );


    console.log(
      'Created new chat session:',
      this.sessionId
    );
  }


  // ==========================================================
  // GENERATE SESSION ID
  // ==========================================================

  private generateSessionId(): string {

    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return `chat_${crypto.randomUUID()}`;
    }

    return `chat_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 10)}`;
  }


  // ==========================================================
  // LOAD CHAT HISTORY
  // ==========================================================

  private loadConversation(): void {

    try {

      const storedHistory =
        localStorage.getItem(
          this.chatHistoryStorageKey
        );

      if (!storedHistory) {

        this.conversation = [];

        return;
      }


      const parsedHistory =
        JSON.parse(storedHistory);


      if (!Array.isArray(parsedHistory)) {

        this.conversation = [];

        return;
      }


      this.conversation =
        parsedHistory.filter(
          (message): message is ChatMessage =>
            !!message &&
            (
              message.role === 'user' ||
              message.role === 'assistant'
            ) &&
            typeof message.content === 'string'
        );


      console.log(
        'Loaded chat history:',
        this.conversation
      );

    } catch (error) {

      console.error(
        'Unable to load chat history:',
        error
      );

      this.conversation = [];
    }
  }


  // ==========================================================
  // SAVE CHAT HISTORY
  // ==========================================================

  private saveConversation(): void {

    try {

      localStorage.setItem(
        this.chatHistoryStorageKey,
        JSON.stringify(
          this.conversation
        )
      );

    } catch (error) {

      console.error(
        'Unable to save chat history:',
        error
      );
    }
  }


  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  sendMessage(): void {

    const messageText =
      this.prompt.trim();


    if (
      !messageText ||
      this.loading
    ) {
      return;
    }


    // --------------------------------------------------------
    // USER MESSAGE
    // --------------------------------------------------------

    this.conversation.push({
      role: 'user',
      content: messageText,
    });


    // Save immediately
    this.saveConversation();


    // Clear input
    this.prompt = '';


    // Loading
    this.loading = true;


    this.cdr.detectChanges();


    console.log(
      '========== CHAT REQUEST =========='
    );

    console.log(
      'Session ID:',
      this.sessionId
    );

    console.log(
      'Question:',
      messageText
    );


    // --------------------------------------------------------
    // SEND TO N8N
    // --------------------------------------------------------

    this.chatService
      .sendMessage(
        messageText,
        this.sessionId
      )
      .pipe(

        timeout(60000),

        catchError((error) => {

          console.error(
            'Chat send error:',
            error
          );

          return of({
            answer:
              'Unable to reach the AI chat service. Please try again.',
          } as ChatResponse);

        }),

        finalize(() => {

          this.loading = false;

          this.cdr.detectChanges();

        }),

      )
      .subscribe({

        next: (
          response: ChatResponse
        ) => {

          console.log(
            '========== CHAT RESPONSE =========='
          );

          console.log(
            'Response:',
            response
          );


          const assistantText =
            this.extractAssistantResponse(
              response
            );


          this.conversation.push({
            role: 'assistant',
            content: assistantText,
          });


          // IMPORTANT:
          // Persist the AI response too.
          this.saveConversation();


          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Unexpected chat error:',
            error
          );


          this.conversation.push({
            role: 'assistant',
            content:
              'Unable to get a response from the AI. Please try again.',
          });


          this.saveConversation();


          this.loading = false;

          this.cdr.detectChanges();
        },

      });
  }


  // ==========================================================
  // RESPONSE EXTRACTION
  // ==========================================================

  private extractAssistantResponse(
    response: ChatResponse,
  ): string {

    if (
      typeof response === 'string'
    ) {
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


  // ==========================================================
  // CLEAR CHAT
  // ==========================================================

clearChat(): void {

  if (this.loading) {
    return;
  }

  const confirmed = window.confirm(
    'Are you sure you want to clear this chat?'
  );

  if (!confirmed) {
    return;
  }

  // Clear visible messages
  this.conversation = [];

  // Remove saved chat history
  localStorage.removeItem(
    this.chatHistoryStorageKey
  );

  // Create a new session for the next conversation
  this.sessionId =
    this.generateSessionId();

  localStorage.setItem(
    this.sessionStorageKey,
    this.sessionId
  );

  this.cdr.detectChanges();

  console.log(
    'Chat cleared. New session:',
    this.sessionId
  );
}
}
