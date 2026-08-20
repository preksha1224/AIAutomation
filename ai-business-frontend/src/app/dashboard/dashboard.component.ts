import {
  ChangeDetectorRef,
  Component,
  Inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { DocumentSummary } from '../models/document.summary.model';

import { isPlatformBrowser } from '@angular/common';

import { finalize } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { DocumentService } from '../services/document.service';

interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  status: string;

  uploadedAt: string;

  // Backend-compatible fields
  document_id?: string;
  file_name?: string;
  file_type?: string;
  uploaded_at?: string;

  fileUrl?: string;
  url?: string;

  [key: string]: any;
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {

  // ============================================================
  // DOCUMENT DATA
  // ============================================================

  documents: UploadedDocument[] = [];

  searchResults: UploadedDocument[] = [];

  selectedDocument: UploadedDocument | null = null;

  selectedFile: File | null = null;


  // ============================================================
  // DASHBOARD STATISTICS
  // ============================================================

  /**
   * Total number of documents available
   */
  totalDocuments = 0;

  /**
   * Documents which have completed processing
   */
  processedDocuments = 0;

  /**
   * Documents which are still processing / pending
   */
  pendingDocuments = 0;

  /**
   * Documents which are ready to be queried by AI
   */
  aiReadyDocuments = 0;


  // ============================================================
  // SEARCH
  // ============================================================

  search = '';


  // ============================================================
  // STATUS / UI
  // ============================================================

  statusMessage = '';

  isUploading = false;

  isLoadingDocuments = false;

  isSearching = false;


  // ============================================================
  // LAST UPDATED
  // ============================================================

  lastUpdated: Date | null = null;


  // ============================================================
  // PLATFORM
  // ============================================================

  private isBrowser = false;


  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    public auth: AuthService,

    private documentService: DocumentService,

    private readonly cdr: ChangeDetectorRef,

    @Inject(PLATFORM_ID)
    private platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }


  // ============================================================
  // INIT
  // ============================================================

  ngOnInit(): void {

    if (!this.isBrowser) {
      return;
    }

    this.loadDocuments();
  }


  // ============================================================
  // LOAD DOCUMENTS
  // ============================================================

loadDocuments(): void {
  console.log('========== DASHBOARD LOAD DOCUMENTS ==========');

  const storageKey = 'ai-business-frontend.recent-documents';

  let localDocuments: DocumentSummary[] = [];

  // --------------------------------------------------
  // 1. READ DOCUMENTS FROM LOCAL STORAGE
  // --------------------------------------------------

  try {
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        localDocuments = parsed;
      }
    }
  } catch (error) {
    console.error('Dashboard localStorage error:', error);
  }

  console.log('Documents from localStorage:', localDocuments);
  console.log('Local document count:', localDocuments.length);

  // --------------------------------------------------
  // 2. GET DOCUMENTS FROM BACKEND / N8N
  // --------------------------------------------------

  this.documentService.getDocuments().subscribe({

    next: (backendDocuments: DocumentSummary[]) => {

      console.log(
        'Documents from backend:',
        backendDocuments
      );

      console.log(
        'Backend document count:',
        backendDocuments.length
      );

      // ------------------------------------------------
      // 3. MERGE BACKEND + LOCAL DOCUMENTS
      // ------------------------------------------------

      const documentMap = new Map<string, DocumentSummary>();

      // Backend first
      for (const document of backendDocuments) {

        const id =
          document.document_id ||
          document.id;

        if (id) {
          documentMap.set(id, document);
        }
      }

      // Local documents
      for (const document of localDocuments) {

        const id =
          document.document_id ||
          document.id;

        if (!id) {
          continue;
        }

        // Only add local document if backend doesn't already
        // contain it.
        if (!documentMap.has(id)) {
          documentMap.set(id, document);
        }
      }

      const documents = Array.from(
        documentMap.values()
      );

      console.log(
        '========== FINAL DASHBOARD DOCUMENTS =========='
      );

      console.log('Final documents:', documents);
      console.log('Final count:', documents.length);

      // ------------------------------------------------
      // 4. UPDATE DASHBOARD
      // ------------------------------------------------

      this.documents = documents;
      this.searchResults = [...documents];

      // ------------------------------------------------
      // 5. UPDATE COUNTS
      // ------------------------------------------------

      this.totalDocuments = documents.length;

      this.processedDocuments = documents.filter(
        document =>
          this.isProcessed(document)
      ).length;

      this.pendingDocuments = documents.filter(
        document =>
          !this.isProcessed(document)
      ).length;

      this.aiReadyDocuments = documents.filter(
        document =>
          this.isAIReady(document)
      ).length;

      console.log('TOTAL:', this.totalDocuments);
      console.log('PROCESSED:', this.processedDocuments);
      console.log('PENDING:', this.pendingDocuments);
      console.log('AI READY:', this.aiReadyDocuments);

      this.cdr.detectChanges();
    },

    error: (error) => {

      console.error(
        '========== DASHBOARD BACKEND ERROR =========='
      );

      console.error(error);

      // If backend fails, still show local documents
      this.documents = localDocuments;
      this.searchResults = [...localDocuments];

      this.totalDocuments = localDocuments.length;

      this.processedDocuments = localDocuments.filter(
        document =>
          this.isProcessed(document)
      ).length;

      this.pendingDocuments = localDocuments.filter(
        document =>
          !this.isProcessed(document)
      ).length;

      this.aiReadyDocuments = localDocuments.filter(
        document =>
          this.isAIReady(document)
      ).length;

      this.cdr.detectChanges();
    }
  });
}

  // ============================================================
  // NORMALIZE DOCUMENT
  // ============================================================

  /**
   * Your backend may return:
   *
   * document_id
   * file_name
   * file_type
   * uploaded_at
   *
   * while the frontend uses:
   *
   * id
   * name
   * type
   * uploadedAt
   *
   * This method keeps both formats compatible.
   */
  private normalizeDocument(
    document: any,
  ): UploadedDocument {

    const id =
      this.getStringValue(
        document?.id,
        document?.document_id,
      ) || '';

    const name =
      this.getStringValue(
        document?.name,
        document?.file_name,
      ) || 'Unnamed Document';

    const type =
      this.getStringValue(
        document?.type,
        document?.file_type,
      ) || 'Document';

    const uploadedAt =
      this.getStringValue(
        document?.uploadedAt,
        document?.uploaded_at,
      ) || '';

    const status =
      this.getStringValue(
        document?.status,
      ) || 'Pending';

    return {

      ...document,

      id,

      name,

      type,

      status,

      uploadedAt,

      document_id:
        document?.document_id || id,

      file_name:
        document?.file_name || name,

      file_type:
        document?.file_type || type,

      uploaded_at:
        document?.uploaded_at || uploadedAt,

      fileUrl:
        document?.fileUrl,

      url:
        document?.url,

    };
  }


  // ============================================================
  // GET STRING VALUE
  // ============================================================

  private getStringValue(
    ...values: any[]
  ): string {

    for (const value of values) {

      if (
        typeof value === 'string' &&
        value.trim()
      ) {

        return value.trim();
      }
    }

    return '';
  }


  // ============================================================
  // CALCULATE DASHBOARD STATISTICS
  // ============================================================

  private calculateStatistics(): void {

    this.totalDocuments =
      this.documents.length;


    // ----------------------------------------------------------
    // PROCESSED DOCUMENTS
    // ----------------------------------------------------------

    this.processedDocuments =
      this.documents.filter(
        (document) =>
          this.isProcessed(document),
      ).length;


    // ----------------------------------------------------------
    // PENDING DOCUMENTS
    // ----------------------------------------------------------

    this.pendingDocuments =
      this.documents.filter(
        (document) =>
          !this.isProcessed(document),
      ).length;


    // ----------------------------------------------------------
    // AI READY DOCUMENTS
    // ----------------------------------------------------------

    /*
     * For the current RAG workflow,
     * a successfully processed document
     * is considered AI Ready.
     */
    this.aiReadyDocuments =
      this.documents.filter(
        (document) =>
          this.isAIReady(document),
      ).length;
  }


  // ============================================================
  // CHECK PROCESSED
  // ============================================================

  private isProcessed(
    document: UploadedDocument,
  ): boolean {

    const status =
      (document.status || '')
        .trim()
        .toLowerCase();

    return (
      status === 'processed' ||
      status === 'completed' ||
      status === 'complete' ||
      status === 'ready' ||
      status === 'ai ready' ||
      status === 'success' ||
      status === 'successful'
    );
  }


  // ============================================================
  // CHECK AI READY
  // ============================================================

  private isAIReady(
    document: UploadedDocument,
  ): boolean {

    /*
     * Currently your document workflow considers
     * successfully processed documents AI ready.
     */
    return this.isProcessed(document);
  }


  // ============================================================
  // FILE SELECTION
  // ============================================================

  selectFile(event: Event): void {

    const input =
      event.target as HTMLInputElement;

    if (!input.files?.length) {

      this.selectedFile = null;

      return;
    }

    this.selectedFile =
      input.files[0];

    this.statusMessage =
      `Selected: ${this.selectedFile.name}`;
  }


  // ============================================================
  // UPLOAD DOCUMENT
  // ============================================================

  uploadDocument(): void {

    if (
      !this.selectedFile ||
      this.isUploading
    ) {
      return;
    }

    this.isUploading = true;

    this.statusMessage =
      `Uploading ${this.selectedFile.name}...`;


    this.documentService
      .uploadDocument(this.selectedFile)
      .pipe(
        finalize(() => {

          this.isUploading = false;

          this.cdr.detectChanges();

        }),
      )
      .subscribe({

        next: (response: any) => {

          console.log(
            'DASHBOARD UPLOAD RESPONSE:',
            response,
          );

          this.selectedFile = null;

          this.statusMessage =
            'Upload successful. Refreshing documents...';

          /*
           * IMPORTANT:
           *
           * Reload the real backend data so the
           * dashboard statistics update immediately.
           */
          this.loadDocuments();
        },

        error: (err: unknown) => {

          console.error(
            'DASHBOARD UPLOAD ERROR:',
            err,
          );

          this.statusMessage =
            'Upload failed. Please try again.';

          this.cdr.detectChanges();
        },

      });
  }


  // ============================================================
  // SEARCH DOCUMENTS
  // ============================================================

  runSearch(): void {

    const searchTerm =
      this.search.trim();


    // ----------------------------------------------------------
    // Empty search
    // ----------------------------------------------------------

    if (!searchTerm) {

      this.searchResults =
        [...this.documents];

      return;
    }


    this.isSearching = true;


    this.documentService
      .searchDocuments(searchTerm)
      .pipe(
        finalize(() => {

          this.isSearching = false;

          this.cdr.detectChanges();

        }),
      )
      .subscribe({

        next: (results: any) => {

          console.log(
            'DASHBOARD SEARCH RESPONSE:',
            results,
          );

          this.searchResults =
            Array.isArray(results)
              ? results.map(
                  (document: any) =>
                    this.normalizeDocument(document),
                )
              : [];

        },

        error: (err: unknown) => {

          console.error(
            'DASHBOARD SEARCH ERROR:',
            err,
          );

          /*
           * Fallback to local filtering.
           *
           * This means the dashboard still works
           * even if the search endpoint has an issue.
           */
          this.searchResults =
            this.documents.filter(
              (document) =>
                this.matchesSearch(
                  document,
                  searchTerm,
                ),
            );

          this.statusMessage =
            'Search service unavailable. Showing local results.';

        },

      });
  }


  // ============================================================
  // LOCAL SEARCH FALLBACK
  // ============================================================

  private matchesSearch(
    document: UploadedDocument,
    searchTerm: string,
  ): boolean {

    const term =
      searchTerm.toLowerCase();

    return [

      document.name,

      document.type,

      document.status,

      document.file_name,

      document.file_type,

    ].some(
      (value) =>
        typeof value === 'string' &&
        value.toLowerCase().includes(term),
    );
  }


  // ============================================================
  // VIEW DOCUMENT
  // ============================================================

  viewDocument(
    document: UploadedDocument,
  ): void {

    const existingUrl =
      this.getDocumentUrl(document);


    if (existingUrl) {

      this.openDocument(existingUrl);

      return;
    }


    const previewWindow =
      this.isBrowser
        ? window.open(
            '',
            '_blank',
          )
        : null;


    this.documentService
      .getDocument(document.id)
      .subscribe({

        next: (doc: any) => {

          this.selectedDocument =
            this.normalizeDocument(doc);


          const documentUrl =
            this.getDocumentUrl(
              this.selectedDocument,
            );


          if (documentUrl) {

            this.openDocument(
              documentUrl,
              previewWindow,
            );

            return;
          }


          previewWindow?.close();


          this.statusMessage =
            'Document preview is not available yet.';

        },

        error: (err: unknown) => {

          console.error(
            'VIEW DOCUMENT ERROR:',
            err,
          );

          previewWindow?.close();

          this.statusMessage =
            'Unable to load document preview.';

        },

      });
  }


  // ============================================================
  // EDIT DOCUMENT
  // ============================================================

  editDocument(
    document: UploadedDocument,
  ): void {

    if (!this.isBrowser) {
      return;
    }


    const newName =
      window.prompt(
        'Enter new document name',
        document.name,
      );


    if (!newName?.trim()) {
      return;
    }


    const trimmedName =
      newName.trim();


    this.documentService
      .updateDocument(
        document.id,
        trimmedName,
      )
      .subscribe({

        next: () => {

          this.statusMessage =
            'Document updated successfully.';

          this.loadDocuments();

        },

        error: (err: unknown) => {

          console.error(
            'EDIT DOCUMENT ERROR:',
            err,
          );

          this.statusMessage =
            'Unable to update document.';

        },

      });
  }


  // ============================================================
  // DELETE DOCUMENT
  // ============================================================

  deleteDocument(
    document: UploadedDocument,
  ): void {

    if (!this.isBrowser) {
      return;
    }


    const confirmed =
      window.confirm(
        `Delete "${document.name}"?`,
      );


    if (!confirmed) {
      return;
    }


    this.documentService
      .deleteDocument(document.id)
      .subscribe({

        next: () => {

          this.statusMessage =
            'Document deleted successfully.';

          /*
           * Reload from backend.
           *
           * This is important for the dashboard because
           * the statistics must also change after deletion.
           */
          this.loadDocuments();

        },

        error: (err: unknown) => {

          console.error(
            'DELETE DOCUMENT ERROR:',
            err,
          );

          this.statusMessage =
            'Unable to delete document.';

        },

      });
  }


  // ============================================================
  // LOGOUT
  // ============================================================

  logout(): void {
    this.auth.logout();
  }


  // ============================================================
  // DOCUMENT URL
  // ============================================================

  private getDocumentUrl(
    document: Partial<UploadedDocument>,
  ): string | null {

    if (
      typeof document.fileUrl === 'string' &&
      document.fileUrl.trim()
    ) {

      return document.fileUrl.trim();
    }


    if (
      typeof document.url === 'string' &&
      document.url.trim()
    ) {

      return document.url.trim();
    }


    return null;
  }


  // ============================================================
  // OPEN DOCUMENT
  // ============================================================

  private openDocument(
    url: string,
    previewWindow?: Window | null,
  ): void {

    if (!this.isBrowser) {
      return;
    }


    const targetWindow =
      previewWindow ??
      window.open(
        url,
        '_blank',
        'noopener,noreferrer',
      );


    if (!targetWindow) {

      this.statusMessage =
        'Unable to open document preview.';

      return;
    }


    if (previewWindow) {

      previewWindow.location.href =
        url;
    }
  }


  // ============================================================
  // REFRESH DASHBOARD
  // ============================================================

  refreshDashboard(): void {

    if (this.isLoadingDocuments) {
      return;
    }

    this.loadDocuments();
  }


  // ============================================================
  // GET DOCUMENT STATUS
  // ============================================================

  getDocumentStatus(
    document: UploadedDocument,
  ): string {

    if (this.isAIReady(document)) {
      return 'AI Ready';
    }

    return document.status || 'Pending';
  }


  // ============================================================
  // GET DOCUMENT DATE
  // ============================================================

  getDocumentDate(
    document: UploadedDocument,
  ): string {

    const dateValue =
      document.uploadedAt ||
      document.uploaded_at;


    if (!dateValue) {
      return 'Recently';
    }


    const date =
      new Date(dateValue);


    if (Number.isNaN(date.getTime())) {
      return 'Recently';
    }


    return date.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    );
  }
}
