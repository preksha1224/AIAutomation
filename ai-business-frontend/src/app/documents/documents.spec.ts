import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { PLATFORM_ID } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';

import { Documents } from './documents';
import { AuthService } from '../services/auth.service';
import { DocumentService } from '../services/document.service';
import { DocumentSummary } from '../models/document.summary.model';

type DocumentServiceMock = {
  uploadDocument: ReturnType<typeof vi.fn>;
  getDocuments: ReturnType<typeof vi.fn>;
  searchDocuments: ReturnType<typeof vi.fn>;
  getDocument: ReturnType<typeof vi.fn>;
  updateDocument: ReturnType<typeof vi.fn>;
  deleteDocument: ReturnType<typeof vi.fn>;
};

describe('Documents', () => {
  let component: Documents;
  let fixture: ComponentFixture<Documents>;
  let documentService: DocumentServiceMock;

  beforeEach(async () => {
    localStorage.clear();

    documentService = {
      uploadDocument: vi.fn(),
      getDocuments: vi.fn(),
      searchDocuments: vi.fn(),
      getDocument: vi.fn(),
      updateDocument: vi.fn(),
      deleteDocument: vi.fn(),
    };

    documentService.getDocuments.mockReturnValue(of([]));
    documentService.searchDocuments.mockReturnValue(of([]));
    documentService.getDocument.mockReturnValue(
      of({
        id: 'document-1',
        name: 'Document 1',
        type: 'application/pdf',
        status: 'Processed',
        uploadedAt: '2026-08-07T10:00:00Z',
      })
    );
    documentService.updateDocument.mockReturnValue(of({}));
    documentService.deleteDocument.mockReturnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [Documents],
      providers: [
        { provide: AuthService, useValue: { logout: vi.fn() } },
        { provide: DocumentService, useValue: documentService as unknown as DocumentService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Documents);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show uploading state and prepend the uploaded document without reloading', () => {
    const uploadResponse$ = new Subject<DocumentSummary>();
    const file = new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' });
    const uploadedDocument: DocumentSummary = {
      id: 'document-2',
      document_id: 'document-2',
      name: 'invoice.pdf',
      file_name: 'invoice.pdf',
      type: 'application/pdf',
      file_type: 'application/pdf',
      status: 'Processed',
      uploadedAt: '2026-08-07T10:00:00Z',
      uploaded_at: '2026-08-07T10:00:00Z',
      url: 'https://example.com/invoice.pdf',
      sourceFile: file,
    };

    component.documents = [
      {
        id: 'document-1',
        name: 'Older document',
        type: 'application/pdf',
        status: 'Processed',
        uploadedAt: '2026-08-06T10:00:00Z',
      },
    ];
    component.searchResults = [...component.documents];
    component.selectedFile = file;

    documentService.uploadDocument.mockReturnValue(uploadResponse$);

    const loadDocumentsSpy = vi.spyOn(component, 'loadDocuments');

    component.uploadDocument();

    expect(component.isUploading).toBe(true);
    expect(component.statusMessage).toBe('Uploading...');
    expect(component.documents[0].id).toBe('document-1');
    expect(loadDocumentsSpy).not.toHaveBeenCalled();

    uploadResponse$.next(uploadedDocument);
    uploadResponse$.complete();

    expect(component.isUploading).toBe(false);
    expect(component.statusMessage).toBe('Document uploaded successfully.');
    expect(component.selectedFile).toBeNull();
    expect(loadDocumentsSpy).not.toHaveBeenCalled();
    expect(component.documents.length).toBe(2);
    expect(component.documents[0]).toEqual(uploadedDocument);
    expect(component.searchResults[0]).toEqual(uploadedDocument);
    expect(localStorage.getItem('ai-business-frontend.recent-documents')).toContain('document-2');
  });

  it('should clear the temporary file reference and avoid adding a document when upload fails', () => {
    const file = new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' });

    component.documents = [
      {
        id: 'document-1',
        name: 'Existing document',
        type: 'application/pdf',
        status: 'Processed',
        uploadedAt: '2026-08-06T10:00:00Z',
      },
    ];
    component.searchResults = [...component.documents];
    component.selectedFile = file;

    documentService.uploadDocument.mockReturnValue(
      throwError(() => new Error('Network unavailable'))
    );

    component.uploadDocument();

    expect(component.isUploading).toBe(false);
    expect(component.selectedFile).toBeNull();
    expect(component.statusMessage).toBe('Upload failed: Network unavailable');
    expect(component.documents.length).toBe(1);
    expect(component.documents[0].id).toBe('document-1');
    expect(component.searchResults.length).toBe(1);
  });

  it('should merge persisted documents when refreshed list does not contain the upload yet', () => {
    localStorage.setItem(
      'ai-business-frontend.recent-documents',
      JSON.stringify([
        {
          id: 'document-2',
          document_id: 'document-2',
          name: 'Persisted upload.pdf',
          file_name: 'Persisted upload.pdf',
          type: 'application/pdf',
          file_type: 'application/pdf',
          status: 'Pending',
          uploadedAt: '2026-08-07T10:00:00Z',
        },
      ])
    );

    documentService.getDocuments.mockReturnValue(
      of([
        {
          id: 'document-1',
          name: 'Existing document',
          type: 'application/pdf',
          status: 'Processed',
          uploadedAt: '2026-08-06T10:00:00Z',
        },
      ])
    );

    component.loadDocuments();

    expect(component.documents.length).toBe(2);
    expect(component.documents[0].id).toBe('document-2');
    expect(component.documents[1].id).toBe('document-1');
  });

  it('should open a local preview immediately for an uploaded file', () => {
    const file = new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(window);
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:test-document');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    component.viewDocument({
      id: 'document-2',
      name: 'invoice.pdf',
      type: 'application/pdf',
      status: 'Pending',
      uploadedAt: '2026-08-07T10:00:00Z',
      sourceFile: file,
    });

    expect(documentService.getDocument).not.toHaveBeenCalled();
    expect(createObjectUrlSpy).toHaveBeenCalledWith(file);
    expect(openSpy).toHaveBeenCalledWith('blob:test-document', '_blank', 'noopener,noreferrer');
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled();
  });
});
