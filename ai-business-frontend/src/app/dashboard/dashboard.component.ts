import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { DocumentService } from '../services/document.service';

interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  status: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  documents: UploadedDocument[] = [];
  searchResults: UploadedDocument[] = [];

  selectedDocument: UploadedDocument | null = null;
  selectedFile: File | null = null;

  search = '';
  statusMessage = '';

  private isBrowser = false;

  constructor(
    public auth: AuthService,
    private documentService: DocumentService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadDocuments();
    }
  }

  selectFile(event: Event): void {

    const input = event.target as HTMLInputElement;

    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }

  }

  uploadDocument(): void {

    if (!this.selectedFile) {

      this.statusMessage = 'Please select a file.';
      return;

    }

    this.statusMessage = 'Uploading...';

    this.documentService.uploadDocument(this.selectedFile).subscribe({

      next: () => {

        this.statusMessage = 'Upload successful';

        this.selectedFile = null;

        this.loadDocuments();

      },

      error: (err: any) => {

        console.error(err);

        this.statusMessage = 'Upload failed';

      }

    });

  }

  loadDocuments(): void {

    this.documentService.getDocuments().subscribe({

      next: (docs) => {

        this.documents = docs;

        this.searchResults = docs;

      },

      error: (err: any) => {

        console.error(err);

      }

    });

  }

  runSearch(): void {

    this.documentService.searchDocuments(this.search).subscribe({

      next: (results: any) => {

        this.searchResults = results;

      },

      error: (err: any) => {

        console.error(err);

      }

    });

  }

  viewDocument(document: UploadedDocument): void {

    this.documentService.getDocument(document.id).subscribe({

      next: (doc) => {

        this.selectedDocument = doc;

      },

      error: (err: any) => {

        console.error(err);

      }

    });

  }

  editDocument(document: UploadedDocument): void {

    const newName = prompt('Enter new document name', document.name);

    if (!newName) {
      return;
    }

    this.documentService.updateDocument(document.id, newName).subscribe({

      next: () => {

        this.statusMessage = 'Document updated';

        this.loadDocuments();

      },

      error: (err: any) => {

        console.error(err);

      }

    });

  }

  deleteDocument(document: UploadedDocument): void {

    if (!confirm(`Delete ${document.name}?`)) {
      return;
    }

    this.documentService.deleteDocument(document.id).subscribe({

      next: () => {

        this.statusMessage = 'Document deleted';

        this.loadDocuments();

      },

      error: (err: any) => {

        console.error(err);

      }

    });

  }

  logout(): void {

    this.auth.logout();

  }

}