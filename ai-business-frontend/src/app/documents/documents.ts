import {
  Component,
  ElementRef,
  Inject,
  OnInit,
  PLATFORM_ID,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { finalize } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { DocumentService } from '../services/document.service';
import { DocumentSummary } from '../models/document.summary.model';

@Component({
  selector: 'app-documents',
  standalone: false,
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class Documents implements OnInit {
  private readonly uploadedDocumentsStorageKey = 'ai-business-frontend.recent-documents';

  documents: DocumentSummary[] = [];
  searchResults: DocumentSummary[] = [];

  selectedDocument: DocumentSummary | null = null;
  selectedFile: File | null = null;

  search = '';

  statusMessage = '';

  isUploading = false;
  isLoading = false;

  @ViewChildren('fileInput')
  private fileInputs?: QueryList<ElementRef<HTMLInputElement>>;

  private readonly isBrowser: boolean;

  constructor(
    public auth: AuthService,
    private readonly documentService: DocumentService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {

    if (this.isBrowser) {
      this.loadDocuments();
    }

  }

  /**
   * Select File
   */
  selectFile(event: Event): void {

    const input = event.target as HTMLInputElement;

    if (input.files?.length) {
      this.selectedFile = input.files[0];
      this.statusMessage = '';
      return;
    }

    this.clearSelectedFile();

  }

  /**
   * Upload
   */
  uploadDocument(): void {

    const fileToUpload = this.selectedFile;

    if (!fileToUpload) {

      this.statusMessage = 'Please select a file.';
      return;

    }

    this.isUploading = true;
    this.statusMessage = 'Uploading...';

    this.documentService
      .uploadDocument(fileToUpload)
      .pipe(
        finalize(() => {
          this.isUploading = false;
        })
      )
      .subscribe({

        next: (document) => {

          console.log('UPLOAD SUCCESS');
          console.log(document);

          this.prependUploadedDocument(document);
          this.statusMessage = 'Document uploaded successfully.';

          this.clearSelectedFile();

        },

        error: (error) => {

          console.error('UPLOAD ERROR');
          console.error(error);

          this.statusMessage = this.getUploadErrorMessage(error);
          this.clearSelectedFile();

        }

      });

  }

  private clearSelectedFile(): void {
    this.selectedFile = null;
    this.fileInputs?.forEach((fileInput) => {
      fileInput.nativeElement.value = '';
    });
  }

  private upsertDocument(
    documents: DocumentSummary[],
    document: DocumentSummary
  ): DocumentSummary[] {
    return [
      document,
      ...documents.filter((existingDocument) => existingDocument.id !== document.id),
    ];
  }

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
          typeof document === 'object'
          && document !== null
          && 'id' in document
          && typeof document.id === 'string'
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

    const serializableDocuments = documents.map(({ sourceFile, ...document }) => document);
    localStorage.setItem(
      this.uploadedDocumentsStorageKey,
      JSON.stringify(serializableDocuments)
    );
  }

  private syncDocuments(documents: DocumentSummary[]): void {
    this.documents = documents;

    if (!this.search.trim()) {
      this.searchResults = [...documents];
    } else {
      this.searchResults = documents.filter((document) => this.matchesSearch(document));
    }

    this.persistDocuments(documents);
  }

  private removeDocumentFromState(documentId: string): void {
    const remainingDocuments = this.documents.filter((document) => document.id !== documentId);
    this.syncDocuments(remainingDocuments);
  }

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
    ].some((value) =>
      typeof value === 'string' && value.toLowerCase().includes(searchTerm)
    );
  }

  private prependUploadedDocument(document: DocumentSummary): void {
    this.syncDocuments(this.upsertDocument(this.documents, document));
  }

  private getUploadErrorMessage(error: unknown): string {
    if (
      typeof error === 'object'
      && error !== null
      && 'error' in error
      && typeof error.error === 'object'
      && error.error !== null
      && 'message' in error.error
      && typeof error.error.message === 'string'
      && error.error.message.trim()
    ) {
      return `Upload failed: ${error.error.message}`;
    }

    if (error instanceof Error && error.message.trim()) {
      return `Upload failed: ${error.message}`;
    }

    return 'Document upload failed. Please try again.';
  }

  /**
   * List Documents
   */
loadDocuments(): void {
 
  this.isLoading = true;
 
  this.documentService.getDocuments().subscribe({
 
    next: (documents: DocumentSummary[]) => {
 
      console.log('======================');
      console.log('LIST RESPONSE');
      console.log(documents);
      console.log('======================');

    const mergedDocuments = this.mergeDocuments(
      this.getPersistedDocuments(),
      documents
    );

    this.syncDocuments(mergedDocuments);

    console.log('Documents:', this.documents);
    console.log('Length:', this.documents.length);

      this.isLoading = false;

    },

    error: (error) => {

      console.error(error);

      this.isLoading = false;
      this.statusMessage = 'Unable to load documents.';

    }

  });

}

  /**
   * Search
   */
  runSearch(): void {

    if (!this.search.trim()) {

      this.searchResults = [...this.documents];
      return;

    }

    this.documentService.searchDocuments(this.search).subscribe({

      next: (documents) => {

        this.searchResults = documents;

      },

      error: (error) => {

        console.error(error);

      }

    });

  }

  /**
   * Read
   */
  viewDocument(document: DocumentSummary): void {
    const existingDocumentUrl = this.getDocumentUrl(document);

    if (existingDocumentUrl) {
      this.openDocumentUrl(existingDocumentUrl);
      return;
    }

    const previewWindow = this.openPendingPreviewWindow();
 
    this.documentService.getDocument(document.id).subscribe({
 
      next: (response) => {
 
        console.log(response);

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

      error: (error) => {

        console.error(error);
        previewWindow?.close();
        this.statusMessage = 'Unable to load document preview.';
 
      }

    });

  }

  /**
   * Update
   */
  editDocument(document: DocumentSummary): void {

    const newName = prompt(
      'Enter new document name',
      document.name
    );

    if (!newName?.trim()) {
      return;
    }

    this.documentService
      .updateDocument(document.id, newName.trim())
      .subscribe({

        next: (response) => {

          console.log(response);

          this.statusMessage = 'Document updated successfully.';

          this.loadDocuments();

        },

        error: (error) => {

          console.error(error);

        }

      });

  }

  /**
   * Delete
   */
  deleteDocument(document: DocumentSummary): void {

    const confirmed = confirm(
      `Delete "${document.name}"?`
    );

    if (!confirmed) {
      return;
    }

    this.documentService.deleteDocument(document.id).subscribe({

      next: (response) => {
 
        console.log(response);
 
        this.statusMessage = 'Document deleted successfully.';
        this.removeDocumentFromState(document.id);
 
        this.loadDocuments();

      },

      error: (error) => {

        console.error(error);

      }

    });

  }

  logout(): void {

    this.auth.logout();

  }

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
    }

    if (documentUrl.startsWith('blob:')) {
      window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000);
    }
  }

}
