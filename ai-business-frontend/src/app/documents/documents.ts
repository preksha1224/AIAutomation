import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

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
    }

  }

  /**
   * Upload
   */
  uploadDocument(): void {

    if (!this.selectedFile) {

      this.statusMessage = 'Please select a file.';
      return;

    }

    this.isUploading = true;
    this.statusMessage = 'Uploading document...';

    this.documentService.uploadDocument(this.selectedFile).subscribe({

      next: (response) => {

        console.log('UPLOAD SUCCESS');
        console.log(response);

        this.isUploading = false;
        this.statusMessage = 'Document uploaded successfully.';

        this.selectedFile = null;

        /**
         * Reload list
         */
        this.loadDocuments();

      },

      error: (error) => {

        console.error('UPLOAD ERROR');
        console.error(error);

        this.isUploading = false;
        this.statusMessage = 'Upload failed.';

      }

    });

  }

  /**
   * List Documents
   */
loadDocuments(): void {

  this.isLoading = true;

  this.documentService.getDocuments().subscribe({

    next: (response: any) => {

      console.log('======================');
      console.log('LIST RESPONSE');
      console.log(response);
      console.log('======================');

      const documents = Array.isArray(response)
        ? response
        : response.data ?? response.items ?? [];

      this.documents = documents;
      this.searchResults = [...documents];

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

    this.documentService.getDocument(document.id).subscribe({

      next: (response) => {

        console.log(response);

        this.selectedDocument = response;

      },

      error: (error) => {

        console.error(error);

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

}
