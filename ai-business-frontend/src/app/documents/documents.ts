import { Component, Inject, OnInit, PLATFORM_ID, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
  safePdfUrl: SafeResourceUrl | null = null;
  isViewingModalOpen = false;
  isLoadingView = false;
  viewingDocId: string | null = null;

  selectedFile: File | null = null;

  search = '';
  statusMessage = '';

  isUploading = false;
  isLoading = false;

  private readonly isBrowser: boolean;

  constructor(
    public auth: AuthService,
    private readonly documentService: DocumentService,
    private readonly sanitizer: DomSanitizer,
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
   * Upload & Process Document (stores & integrates with returned ID & URL)
   */
  uploadDocument(): void {
    if (!this.selectedFile || this.isUploading) {
      if (!this.selectedFile) {
        this.statusMessage = 'Please select a file to upload.';
      }
      return;
    }

    const currentFile = this.selectedFile;
    this.isUploading = true;
    this.statusMessage = `Uploading "${currentFile.name}"...`;
    this.cdr.detectChanges();

    this.documentService
      .uploadDocument(currentFile)
      .pipe(
        finalize(() => {
          this.isUploading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (newDoc: DocumentSummary) => {
          console.log('UPLOAD SUCCESS & INTEGRATED WITH ID:', newDoc);

          const index = this.documents.findIndex((d) => d.id === newDoc.id);
          if (index >= 0) {
            this.documents[index] = newDoc;
          } else {
            this.documents = [newDoc, ...this.documents];
          }
          this.searchResults = [...this.documents];

          this.statusMessage = `Document uploaded & saved! (ID: ${newDoc.id})`;
          this.selectedFile = null;
          this.resetFileInputs();
          this.cdr.detectChanges();

          // Sync with server list
          this.loadDocuments();

          // Clear status after 6 seconds
          setTimeout(() => {
            if (this.statusMessage.includes('uploaded & saved')) {
              this.statusMessage = '';
              this.cdr.detectChanges();
            }
          }, 6000);
        },

        error: (error) => {
          console.error('UPLOAD ERROR', error);
          this.statusMessage = 'Upload failed. Please try again.';
          this.resetFileInputs();
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * List Documents
   */
  loadDocuments(): void {
    this.isLoading = true;

    this.documentService.getDocuments().subscribe({
      next: (documents: DocumentSummary[]) => {
        console.log('LIST RESPONSE:', documents);

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
   * Read / View PDF & Document Details
   */
  viewDocument(document: DocumentSummary): void {
    this.viewingDocId = document.id;
    this.isLoadingView = true;
    this.selectedDocument = document;
    this.safePdfUrl = null;
    this.isViewingModalOpen = true;

    const initialUrl = document.url || document.fileUrl;
    if (initialUrl) {
      this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(initialUrl);
    }

    this.documentService.getDocument(document.id).subscribe({
      next: (fullDoc) => {
        console.log('VIEW DOCUMENT SUCCESS:', fullDoc);
        this.selectedDocument = { ...document, ...fullDoc };

        const targetUrl = fullDoc.url || fullDoc.fileUrl || document.url || document.fileUrl;
        if (targetUrl) {
          this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(targetUrl);
        }

        this.isLoadingView = false;
        this.viewingDocId = null;
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Error fetching document view details:', error);
        this.isLoadingView = false;
        this.viewingDocId = null;
        this.cdr.detectChanges();
      },
    });
  }

  closeViewModal(): void {
    this.isViewingModalOpen = false;
    this.selectedDocument = null;
    this.safePdfUrl = null;
    this.cdr.detectChanges();
  }

  /**
   * Open PDF URL in a new browser window/tab
   */
  openPdfExternal(): void {
    const url = this.selectedDocument?.url || this.selectedDocument?.fileUrl;
    if (url) {
      window.open(url, '_blank');
    }
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
