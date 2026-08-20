import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnInit,
  PLATFORM_ID,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';

import { isPlatformBrowser } from '@angular/common';
import { finalize } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { DocumentService } from '../services/document.service';

import { DocumentSummary, UploadDocumentResponse } from '../models/document.summary.model';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-documents',
  standalone: false,
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class Documents implements OnInit {
  // ============================================================
  // STORAGE
  // ============================================================

  private readonly uploadedDocumentsStorageKey = 'ai-business-frontend.recent-documents';

  // ============================================================
  // DOCUMENT DATA
  // ============================================================

  documents: DocumentSummary[] = [];

  searchResults: DocumentSummary[] = [];

  selectedDocument: DocumentSummary | null = null;

  // ============================================================
  // FILE INPUTS
  // ============================================================

  @ViewChild('dropzoneInput')
  dropzoneInput!: ElementRef<HTMLInputElement>;

  @ViewChild('summaryInput')
  summaryInput!: ElementRef<HTMLInputElement>;

  @ViewChildren('fileInput')
  private fileInputs?: QueryList<ElementRef<HTMLInputElement>>;

  // ============================================================
  // VIEW / PDF
  // ============================================================

  safePdfUrl: SafeResourceUrl | null = null;

  isViewingModalOpen = false;

  isLoadingView = false;

  viewingDocId: string | null = null;

  // ============================================================
  // SELECTED FILES
  // ============================================================

  /**
   * Current file selected from the browser.
   */
  selectedFile: File | null = null;

  /**
   * Multiple files selected for normal upload.
   */
  selectedFiles: File[] = [];

  // ============================================================
  // SEARCH / STATUS
  // ============================================================

  search = '';

  statusMessage = '';

  // ============================================================
  // LOADING STATES
  // ============================================================

  isUploading = false;

  isLoading = false;

  isDeletingDocumentId: string | null = null;

  isRenamingDocumentId: string | null = null;

  // ============================================================
  // DUPLICATE FILE HANDLING
  // ============================================================

  /**
   * IMPORTANT:
   *
   * This contains the ORIGINAL browser File object.
   *
   * We must keep this object because when the user clicks
   * "Save as New", we need to send the actual file again
   * to n8n as multipart/form-data.
   */
  duplicateFile: File | null = null;

  /**
   * Additional backup reference to the original File.
   *
   * This protects the file from being lost if selectedFile
   * or selectedFiles gets cleared by another UI action.
   */
  pendingDuplicateFile: File | null = null;

  duplicateFileName = '';

  duplicateDocumentId = '';

  duplicateMessage = '';

  showDuplicateDialog = false;

  isHandlingDuplicate = false;

  // ============================================================
  // PLATFORM
  // ============================================================

  private readonly isBrowser: boolean;

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    public auth: AuthService,
    private readonly documentService: DocumentService,
    private readonly sanitizer: DomSanitizer,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // ============================================================
  // INIT
  // ============================================================

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadDocuments();
    }
  }

  // ============================================================
  // FILE SELECTION
  // ============================================================

  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      this.clearSelectedFiles();

      return;
    }

    // ----------------------------------------------------------
    // Store the actual browser File objects.
    // ----------------------------------------------------------

    this.selectedFiles = Array.from(input.files);

    this.selectedFile = this.selectedFiles[0] ?? null;

    // ----------------------------------------------------------
    // A new selection means the previous duplicate operation
    // is no longer relevant.
    // ----------------------------------------------------------

    this.duplicateFile = null;

    this.pendingDuplicateFile = null;

    this.duplicateFileName = '';

    this.duplicateDocumentId = '';

    this.duplicateMessage = '';

    this.showDuplicateDialog = false;

    this.statusMessage = '';

    // ----------------------------------------------------------
    // Debug
    // ----------------------------------------------------------

    console.log('================ FILE SELECTED ================');

    console.log('Selected files:', this.selectedFiles);

    console.log('Selected file:', this.selectedFile);

    console.log('Is File:', this.selectedFile instanceof File);

    console.log('File name:', this.selectedFile?.name);

    console.log('File size:', this.selectedFile?.size);

    console.log('File type:', this.selectedFile?.type);

    console.log('================================================');
  }

  // ============================================================
  // RESET FILE INPUTS
  // ============================================================

  private resetFileInputs(): void {
    if (this.dropzoneInput?.nativeElement) {
      this.dropzoneInput.nativeElement.value = '';
    }

    if (this.summaryInput?.nativeElement) {
      this.summaryInput.nativeElement.value = '';
    }

    this.fileInputs?.forEach((fileInput) => {
      fileInput.nativeElement.value = '';
    });
  }

  // ============================================================
  // UPLOAD DOCUMENT
  // ============================================================

  uploadDocument(): void {
    const filesToUpload: File[] = this.selectedFiles.length
      ? [...this.selectedFiles]
      : this.selectedFile
        ? [this.selectedFile]
        : [];

    if (filesToUpload.length === 0) {
      this.statusMessage = 'Please select at least one file.';

      return;
    }

    this.isUploading = true;

    this.statusMessage = `Uploading 0/${filesToUpload.length}...`;

    const uploadNext = (index: number, successCount: number, failedCount: number): void => {
      // ========================================================
      // ALL FILES COMPLETED
      // ========================================================

      if (index >= filesToUpload.length) {
        this.isUploading = false;

        /*
         * IMPORTANT:
         *
         * Do not clear duplicateFile here.
         *
         * If a duplicate was found, the workflow stops and
         * waits for the user's Save as New decision.
         */

        if (failedCount === 0) {
          this.statusMessage =
            `${successCount} document` + `${successCount === 1 ? '' : 's'} uploaded successfully.`;

          /*
           * Only clear the normal selection if there is
           * no pending duplicate operation.
           */
          if (!this.showDuplicateDialog) {
            this.clearSelectedFiles();
          }
        } else if (successCount === 0) {
          this.statusMessage = `All uploads failed (${failedCount}). Please try again.`;
        } else {
          this.statusMessage = `${successCount} uploaded, ${failedCount} failed.`;
        }

        return;
      }

      // ========================================================
      // CURRENT FILE
      // ========================================================

      const fileToUpload = filesToUpload[index];

      if (!(fileToUpload instanceof File)) {
        console.error('Invalid file object:', fileToUpload);

        uploadNext(index + 1, successCount, failedCount + 1);

        return;
      }

      this.statusMessage = `Uploading ${index + 1}/${filesToUpload.length}: ${fileToUpload.name}`;

      // ========================================================
      // DEBUG
      // ========================================================

      console.group('Uploading File');

      console.log('File:', fileToUpload);

      console.log('Is File:', fileToUpload instanceof File);

      console.log('Name:', fileToUpload.name);

      console.log('Type:', fileToUpload.type);

      console.log('Size:', fileToUpload.size);

      console.groupEnd();

      // ========================================================
      // SEND ACTUAL FILE TO N8N
      // ========================================================

      this.documentService.uploadDocument(fileToUpload).subscribe({
        // ======================================================
        // RESPONSE
        // ======================================================

        next: (response: UploadDocumentResponse) => {
          console.log('UPLOAD RESPONSE:', response);

          // ====================================================
          // DUPLICATE FOUND
          // ====================================================

          if (response.duplicate === true) {
            console.log('================ DUPLICATE FOUND ================');

            console.log('Duplicate response:', response);

            console.log('Original file:', fileToUpload);

            console.log('Original file is File:', fileToUpload instanceof File);

            console.log('Original file name:', fileToUpload.name);

            console.log('=================================================');

            /*
             * VERY IMPORTANT
             *
             * Store the ORIGINAL browser File object in TWO
             * places.
             *
             * We do NOT use the n8n response to reconstruct
             * the file.
             */

            this.duplicateFile = fileToUpload;

            this.pendingDuplicateFile = fileToUpload;

            /*
             * Also keep selectedFile pointing to the same
             * original File.
             */

            this.selectedFile = fileToUpload;

            this.duplicateFileName = response.file_name || fileToUpload.name;

            this.duplicateDocumentId = response.document_id || '';

            this.duplicateMessage = response.message || 'File already exists.';

            this.isUploading = false;

            this.showDuplicateDialog = true;

            this.isHandlingDuplicate = false;

            this.statusMessage = `Duplicate file found: ${fileToUpload.name}`;

            /*
             * STOP HERE.
             *
             * We wait for the user to click:
             *
             * Save as New
             */

            return;
          }

          // ==================================================
          // NORMAL UPLOAD
          // ==================================================

          const document = this.createDocumentFromUploadResponse(response, fileToUpload);

          if (!document?.document_id) {
            console.error('Upload response did not contain document_id:', response);

            uploadNext(index + 1, successCount, failedCount + 1);

            return;
          }

          console.log('UPLOAD SUCCESS:', document);

          this.prependUploadedDocument(document);

          uploadNext(index + 1, successCount + 1, failedCount);
        },

        // ======================================================
        // ERROR
        // ======================================================

        error: (error: unknown) => {
          console.error('UPLOAD ERROR:', error);

          this.statusMessage = this.getUploadErrorMessage(error);

          uploadNext(index + 1, successCount, failedCount + 1);
        },
      });
    };

    uploadNext(0, 0, 0);
  }

  // ============================================================
  // CREATE DOCUMENT FROM RESPONSE
  // ============================================================

  private createDocumentFromUploadResponse(
    response: UploadDocumentResponse,
    file: File,
  ): DocumentSummary | null {
    const documentId = typeof response.document_id === 'string' ? response.document_id : '';

    if (!documentId) {
      return null;
    }

    const fileName = typeof response.file_name === 'string' ? response.file_name : file.name;

    const fileType = typeof response['file_type'] === 'string' ? response['file_type'] : file.type;

    const uploadedAt =
      typeof response['uploaded_at'] === 'string'
        ? response['uploaded_at']
        : new Date().toISOString();

    const status = typeof response['status'] === 'string' ? response['status'] : 'Processed';

    const url = typeof response['url'] === 'string' ? response['url'] : undefined;

    const fileUrl = typeof response['fileUrl'] === 'string' ? response['fileUrl'] : undefined;

    return {
      ...response,

      id: documentId,

      name: fileName,

      type: fileType,

      status,

      uploadedAt,

      document_id: documentId,

      file_name: fileName,

      file_type: fileType,

      uploaded_at: uploadedAt,

      url,

      fileUrl,

      sourceFile: file,
    };
  }

  // ============================================================
  // CLOSE DUPLICATE DIALOG
  // ============================================================

  closeDuplicateDialog(): void {
    this.showDuplicateDialog = false;

    /*
     * IMPORTANT:
     *
     * We clear the duplicate state, but we don't immediately
     * destroy the selected browser File.
     *
     * This prevents the UI from accidentally losing the
     * original file before Save as New is processed.
     */

    this.duplicateFile = null;

    this.pendingDuplicateFile = null;

    this.duplicateFileName = '';

    this.duplicateDocumentId = '';

    this.duplicateMessage = '';

    this.isHandlingDuplicate = false;
  }

  // ============================================================
  // SAVE DUPLICATE AS NEW
  // ============================================================
  saveDuplicateAsNew(): void {
    console.log('========== SAVE AS NEW CLICKED ==========');

    console.log('selectedFile:', this.selectedFile);

    if (!(this.selectedFile instanceof File)) {
      console.error('selectedFile is NOT a File', this.selectedFile);

      alert('Original file is not available. Please select the file again.');

      return;
    }

    this.isHandlingDuplicate = true;

    this.documentService.saveAsNewDocument(this.selectedFile, this.selectedFile.name).subscribe({
      next: (response) => {
        console.log('========== SAVE AS NEW SUCCESS ==========');

        console.log('Response:', response);

        this.isHandlingDuplicate = false;

        this.showDuplicateDialog = false;

        // IMPORTANT:
        // DO NOT call loadDocuments() here for now.
      },

      error: (error) => {
        console.error('========== SAVE AS NEW ERROR ==========');

        console.error(error);

        this.isHandlingDuplicate = false;
      },
    });
  }

  // ============================================================
  // DUPLICATE ACTION ERROR
  // ============================================================

  private getActionErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const nestedError = (
        error as {
          error?: unknown;
        }
      ).error;

      if (typeof nestedError === 'object' && nestedError !== null && 'message' in nestedError) {
        const message = (
          nestedError as {
            message?: unknown;
          }
        ).message;

        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }

      if (typeof nestedError === 'string' && nestedError.trim()) {
        return nestedError;
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  // ============================================================
  // SELECTED FILE PREVIEW
  // ============================================================

  getSelectedFileNamesPreview(): string {
    return this.selectedFiles
      .slice(0, 2)
      .map((file) => file.name)
      .join(', ');
  }

  getRemainingSelectedFileCount(): number {
    return Math.max(this.selectedFiles.length - 2, 0);
  }

  // ============================================================
  // CLEAR SELECTED FILES
  // ============================================================

  private clearSelectedFiles(): void {
    this.selectedFiles = [];

    this.clearSelectedFile();

    this.resetFileInputs();
  }

  private clearSelectedFile(): void {
    this.selectedFile = null;

    this.fileInputs?.forEach((fileInput) => {
      fileInput.nativeElement.value = '';
    });
  }

  // ============================================================
  // UPSERT DOCUMENT
  // ============================================================

  private upsertDocument(
    documents: DocumentSummary[],
    document: DocumentSummary,
  ): DocumentSummary[] {
    return [
      document,

      ...documents.filter((existingDocument) => existingDocument.id !== document.id),
    ];
  }

  // ============================================================
  // MERGE DOCUMENTS
  // ============================================================

  private mergeDocuments(...documentGroups: DocumentSummary[][]): DocumentSummary[] {
    const mergedDocuments: DocumentSummary[] = [];

    const documentIndexes = new Map<string, number>();

    for (const group of documentGroups) {
      for (const document of group) {
        const existingIndex = documentIndexes.get(document.id);

        if (existingIndex === undefined) {
          documentIndexes.set(document.id, mergedDocuments.length);

          mergedDocuments.push(document);

          continue;
        }

        mergedDocuments[existingIndex] = {
          ...mergedDocuments[existingIndex],
          ...document,

          sourceFile: document.sourceFile ?? mergedDocuments[existingIndex].sourceFile,
        };
      }
    }

    return mergedDocuments;
  }

  // ============================================================
  // LOCAL STORAGE
  // ============================================================

  private getPersistedDocuments(): DocumentSummary[] {
    if (!this.isBrowser) {
      return [];
    }

    const storedDocuments = localStorage.getItem(this.uploadedDocumentsStorageKey);

    if (!storedDocuments) {
      return [];
    }

    try {
      const parsedDocuments = JSON.parse(storedDocuments);

      if (!Array.isArray(parsedDocuments)) {
        return [];
      }

      return parsedDocuments.filter(
        (document): document is DocumentSummary =>
          typeof document === 'object' &&
          document !== null &&
          'id' in document &&
          typeof document.id === 'string',
      );
    } catch (error) {
      console.error('Unable to parse persisted documents.', error);

      localStorage.removeItem(this.uploadedDocumentsStorageKey);

      return [];
    }
  }

  private persistDocuments(documents: DocumentSummary[]): void {
    if (!this.isBrowser) {
      return;
    }

    /*
     * File objects cannot be serialized to localStorage.
     */

    const serializableDocuments = documents.map(({ sourceFile, ...document }) => document);

    localStorage.setItem(this.uploadedDocumentsStorageKey, JSON.stringify(serializableDocuments));
  }

  private syncDocuments(documents: DocumentSummary[]): void {
    this.documents = documents;

    if (!this.search.trim()) {
      this.searchResults = [...documents];
    } else {
      this.searchResults = documents.filter((document) => this.matchesSearch(document));
    }

    this.persistDocuments(documents);

    this.cdr.detectChanges();
  }

  private removeDocumentFromState(documentId: string): void {
    const remainingDocuments = this.documents.filter(
      (document) => document.id !== documentId && document.document_id !== documentId,
    );

    this.syncDocuments(remainingDocuments);
  }

  // ============================================================
  // SEARCH
  // ============================================================

  private matchesSearch(document: DocumentSummary): boolean {
    const searchTerm = this.search.trim().toLowerCase();

    if (!searchTerm) {
      return true;
    }

    return [
      document.name,
      document.type,
      document.status,
      document.file_name,
      document.file_type,
    ].some((value) => typeof value === 'string' && value.toLowerCase().includes(searchTerm));
  }

  private prependUploadedDocument(document: DocumentSummary): void {
    this.syncDocuments(this.upsertDocument(this.documents, document));
  }

  // ============================================================
  // UPLOAD ERROR
  // ============================================================

  private getUploadErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const nestedError = (
        error as {
          error?: unknown;
        }
      ).error;

      if (typeof nestedError === 'object' && nestedError !== null && 'message' in nestedError) {
        const message = (
          nestedError as {
            message?: unknown;
          }
        ).message;

        if (typeof message === 'string' && message.trim()) {
          return `Upload failed: ${message}`;
        }
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return `Upload failed: ${error.message}`;
    }

    return 'Document upload failed. Please try again.';
  }

  // ============================================================
  // DOCUMENT ID
  // ============================================================

  private getDocumentIdentifier(document: DocumentSummary): string | null {
    const rawId =
      (typeof document.id === 'string' && document.id.trim() && document.id) ||
      (typeof document.document_id === 'string' &&
        document.document_id.trim() &&
        document.document_id) ||
      '';

    const documentId = rawId.trim();

    return documentId ? documentId : null;
  }

  // ============================================================
  // DELETE ERROR
  // ============================================================

  private getDeleteErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const nestedError = (
        error as {
          error?: unknown;
        }
      ).error;

      if (typeof nestedError === 'object' && nestedError !== null && 'message' in nestedError) {
        const message = (
          nestedError as {
            message?: unknown;
          }
        ).message;

        if (typeof message === 'string' && message.trim()) {
          return `Delete failed: ${message}`;
        }
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return `Delete failed: ${error.message}`;
    }

    return 'Delete failed. Please check n8n webhook method and URL.';
  }

  // ============================================================
  // DELETE / RENAME STATE
  // ============================================================

  isDeletingDocument(document: DocumentSummary): boolean {
    const documentId = this.getDocumentIdentifier(document);

    return documentId !== null && this.isDeletingDocumentId === documentId;
  }

  isRenamingDocument(document: DocumentSummary): boolean {
    const documentId = this.getDocumentIdentifier(document);

    return documentId !== null && this.isRenamingDocumentId === documentId;
  }

  // ============================================================
  // LIST DOCUMENTS
  // ============================================================

  loadDocuments(): void {
    this.isLoading = true;

    this.documentService
      .getDocuments()
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (documents: DocumentSummary[]) => {
          console.log('======================');

          console.log('LIST RESPONSE', documents);

          console.log('======================');

          const mergedDocuments = this.mergeDocuments(this.getPersistedDocuments(), documents);

          this.syncDocuments(mergedDocuments);

          console.log('Documents:', this.documents);

          console.log('Length:', this.documents.length);
        },

        error: (error: unknown) => {
          console.error('LIST ERROR:', error);

          this.statusMessage = 'Unable to load documents.';
        },
      });
  }

  // ============================================================
  // SEARCH
  // ============================================================

  runSearch(): void {
    if (!this.search.trim()) {
      this.searchResults = [...this.documents];

      return;
    }

    this.documentService.searchDocuments(this.search).subscribe({
      next: (documents: DocumentSummary[]) => {
        this.searchResults = documents;

        this.cdr.detectChanges();
      },

      error: (error: unknown) => {
        console.error('SEARCH ERROR:', error);

        this.statusMessage = 'Unable to search documents.';
      },
    });
  }

  // ============================================================
  // VIEW DOCUMENT
  // ============================================================

  viewDocument(document: DocumentSummary): void {
    const existingDocumentUrl = this.getDocumentUrl(document);

    if (existingDocumentUrl) {
      this.openDocumentUrl(existingDocumentUrl);

      return;
    }

    const previewWindow = this.openPendingPreviewWindow();

    this.isLoadingView = true;

    this.viewingDocId = this.getDocumentIdentifier(document);

    this.documentService
      .getDocument(document.id)
      .pipe(
        finalize(() => {
          this.isLoadingView = false;
        }),
      )
      .subscribe({
        next: (response: DocumentSummary) => {
          console.log('VIEW RESPONSE:', response);

          const mergedDocument = {
            ...document,
            ...response,

            sourceFile: document.sourceFile ?? response.sourceFile,
          };

          this.selectedDocument = mergedDocument;

          this.syncDocuments(this.upsertDocument(this.documents, mergedDocument));

          const documentUrl = this.getDocumentUrl(mergedDocument);

          if (documentUrl) {
            this.openDocumentUrl(documentUrl, previewWindow);

            return;
          }

          previewWindow?.close();

          this.statusMessage = 'Document preview is not available yet.';
        },

        error: (error: unknown) => {
          console.error('VIEW ERROR:', error);

          previewWindow?.close();

          this.statusMessage = 'Unable to load document preview.';
        },
      });
  }

  // ============================================================
  // CLOSE VIEW MODAL
  // ============================================================

  closeViewModal(): void {
    this.isViewingModalOpen = false;

    this.selectedDocument = null;

    this.safePdfUrl = null;

    this.viewingDocId = null;

    this.isLoadingView = false;

    this.cdr.detectChanges();
  }

  // ============================================================
  // OPEN PDF EXTERNAL
  // ============================================================

  openPdfExternal(): void {
    const url = this.selectedDocument?.url || this.selectedDocument?.fileUrl;

    if (url) {
      window.open(url, '_blank');
    }
  }

  // ============================================================
  // EDIT / RENAME
  // ============================================================

  editDocument(document: DocumentSummary): void {
    const documentId = this.getDocumentIdentifier(document);

    if (!documentId) {
      this.statusMessage = 'Unable to update document: missing document ID.';

      return;
    }

    const picker = window.document.createElement('input');

    picker.type = 'file';

    picker.accept = '.pdf,.txt,.doc,.docx';

    picker.onchange = () => {
      const newFile = picker.files?.[0] ?? null;

      const newName = prompt(
        'Enter document name:',
        newFile?.name || document.file_name || document.name,
      );

      if (!newName?.trim()) {
        return;
      }

      const trimmedName = newName.trim();

      this.isRenamingDocumentId = documentId;

      this.statusMessage = newFile
        ? `Updating "${document.name}" (content + name)...`
        : `Renaming "${document.name}"...`;

      this.documentService
        .renameDocument(documentId, trimmedName, newFile)
        .pipe(
          finalize(() => {
            this.isRenamingDocumentId = null;
          }),
        )
        .subscribe({
          next: (response: unknown) => {
            console.log('UPDATE SUCCESS:', response);

            const updatedDocuments = this.documents.map((doc) => {
              const id = this.getDocumentIdentifier(doc);

              if (id === documentId) {
                return {
                  ...doc,

                  name: trimmedName,

                  file_name: trimmedName,

                  sourceFile: newFile ?? doc.sourceFile,
                };
              }

              return doc;
            });

            this.syncDocuments(updatedDocuments);

            setTimeout(() => this.loadDocuments(), 1000);

            this.statusMessage = 'Document updated successfully.';
          },

          error: (error: unknown) => {
            console.error('UPDATE ERROR:', error);

            this.statusMessage = this.getActionErrorMessage(
              error,
              'Update failed. Check n8n workflow.',
            );
          },
        });
    };

    picker.click();
  }

  // ============================================================
  // DELETE
  // ============================================================

  deleteDocument(document: DocumentSummary): void {
    const documentId = this.getDocumentIdentifier(document);

    if (!documentId) {
      this.statusMessage = 'Unable to delete document: missing document ID.';

      return;
    }

    if (this.isDeletingDocumentId === documentId) {
      return;
    }

    const confirmed = confirm(`Delete "${document.name}"?`);

    if (!confirmed) {
      return;
    }

    this.isDeletingDocumentId = documentId;

    this.statusMessage = `Deleting "${document.name}"...`;

    this.documentService
      .deleteDocument(documentId)
      .pipe(
        finalize(() => {
          this.isDeletingDocumentId = null;
        }),
      )
      .subscribe({
        next: (response: unknown) => {
          console.log('DELETE RESPONSE:', response);

          this.statusMessage = 'Document deleted successfully.';

          this.removeDocumentFromState(documentId);

          this.loadDocuments();
        },

        error: (error: unknown) => {
          console.error('DELETE ERROR:', error);

          this.statusMessage = this.getDeleteErrorMessage(error);
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

  private getDocumentUrl(document: DocumentSummary): string | null {
    if (typeof document.fileUrl === 'string' && document.fileUrl.trim()) {
      return document.fileUrl;
    }

    if (typeof document.url === 'string' && document.url.trim()) {
      return document.url;
    }

    if (this.isBrowser && document.sourceFile instanceof File) {
      return URL.createObjectURL(document.sourceFile);
    }

    return null;
  }

  // ============================================================
  // PREVIEW WINDOW
  // ============================================================

  private openPendingPreviewWindow(): Window | null {
    if (!this.isBrowser) {
      return null;
    }

    return window.open('', '_blank');
  }

  private openDocumentUrl(documentUrl: string, previewWindow?: Window | null): void {
    if (!this.isBrowser) {
      return;
    }

    let openedWindow = previewWindow;

    if (openedWindow) {
      openedWindow.location.href = documentUrl;
    } else {
      openedWindow = window.open(documentUrl, '_blank', 'noopener,noreferrer');
    }

    if (!openedWindow) {
      this.statusMessage = 'Unable to open document preview.';

      return;
    }

    if (documentUrl.startsWith('blob:')) {
      window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000);
    }
  }
}
