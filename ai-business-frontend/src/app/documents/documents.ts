import { Component, Inject, OnInit, PLATFORM_ID, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
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
  @ViewChild('dropzoneInput') dropzoneInput!: ElementRef<HTMLInputElement>;
  @ViewChild('summaryInput') summaryInput!: ElementRef<HTMLInputElement>;

  documents: DocumentSummary[] = [];
  searchResults: DocumentSummary[] = [];

  selectedDocument: DocumentSummary | null = null;
  selectedFile: File | null = null;

  search = '';
  statusMessage = '';

  isUploading = false;
  isLoading = false;

  private readonly isBrowser: boolean;

  constructor(
    public auth: AuthService,
    private readonly documentService: DocumentService,
    private readonly cdr: ChangeDetectorRef,
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
      this.cdr.detectChanges();
    }
  }

  /**
   * Reset file inputs in DOM
   */
  private resetFileInputs(): void {
    if (this.dropzoneInput?.nativeElement) {
      this.dropzoneInput.nativeElement.value = '';
    }
    if (this.summaryInput?.nativeElement) {
      this.summaryInput.nativeElement.value = '';
    }
  }

  /**
   * Upload & Process Document
   */
  uploadDocument(): void {
    if (!this.selectedFile || this.isUploading) {
      if (!this.selectedFile) {
        this.statusMessage = 'Please select a file to upload.';
      }
      return;
    }

    this.isUploading = true;
    this.statusMessage = 'Uploading document...';
    this.cdr.detectChanges();

    this.documentService
      .uploadDocument(this.selectedFile)
      .pipe(
        finalize(() => {
          // ALWAYS reset uploading state when HTTP response returns
          this.isUploading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          console.log('UPLOAD SUCCESS', response);
          this.statusMessage = 'Document uploaded successfully.';
          this.selectedFile = null;
          this.resetFileInputs();
          this.loadDocuments();

          // Clear success status after 4 seconds
          setTimeout(() => {
            if (this.statusMessage === 'Document uploaded successfully.') {
              this.statusMessage = '';
              this.cdr.detectChanges();
            }
          }, 4000);
        },

        error: (error) => {
          console.error('UPLOAD ERROR', error);
          this.statusMessage = 'Upload failed. Please try again.';
          this.resetFileInputs();
        },
      });
  }

  /**
   * List Documents
   */
  loadDocuments(): void {
    this.isLoading = true;

    this.documentService.getDocuments().subscribe({
      next: (response: any) => {
        console.log('LIST RESPONSE:', response);

        const documents = Array.isArray(response)
          ? response
          : response.data ?? response.items ?? [];

        this.documents = documents;
        this.searchResults = [...documents];
        this.isLoading = false;
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('LIST ERROR:', error);
        this.isLoading = false;
        this.statusMessage = 'Unable to load documents.';
        this.cdr.detectChanges();
      },
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
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error(error);
      },
    });
  }

  /**
   * Read
   */
  viewDocument(document: DocumentSummary): void {
    this.documentService.getDocument(document.id).subscribe({
      next: (response) => {
        this.selectedDocument = response;
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error(error);
      },
    });
  }

  /**
   * Update
   */
  editDocument(document: DocumentSummary): void {
    const newName = prompt('Enter new document name', document.name);

    if (!newName?.trim()) {
      return;
    }

    this.documentService
      .updateDocument(document.id, newName.trim())
      .subscribe({
        next: () => {
          this.statusMessage = 'Document updated successfully.';
          this.loadDocuments();
        },

        error: (error) => {
          console.error(error);
        },
      });
  }

  /**
   * Delete
   */
  deleteDocument(document: DocumentSummary): void {
    const confirmed = confirm(`Delete "${document.name}"?`);

    if (!confirmed) {
      return;
    }

    this.documentService.deleteDocument(document.id).subscribe({
      next: () => {
        this.statusMessage = 'Document deleted successfully.';
        this.loadDocuments();
      },

      error: (error) => {
        console.error(error);
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
