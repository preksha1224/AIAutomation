import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { WebhookRequest } from '../models/webhook-request.model';
import { DocumentOperation } from '../models/document-operation.enum';
import { DocumentSummary } from '../models/document.summary.model';

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private readonly webhook =
    'https://intn8n.deenovum.com/webhook-test/4eb0f07a-0b98-4e75-9df3-4454666fdb3a';

  constructor(private readonly http: HttpClient) {}

  /**
   * Generic request to n8n
   */
  private send<T>(request: WebhookRequest): Observable<T> {
    const formData = new FormData();

    formData.append('operation', request.operation);

    if (request.file) {
      formData.append('file', request.file);
    }

    if (request.documentId) {
      formData.append('documentId', request.documentId);
    }

    if (request.name) {
      formData.append('name', request.name);
    }

    if (request.query) {
      formData.append('query', request.query);
    }

    console.log('============================');
    console.log('REQUEST');
    console.log(request);
    console.log('============================');

    return this.http.post<T>(this.webhook, formData);
  }

  /**
   * CREATE - Uploads file and maps the returned document ID & URL details
   */
  uploadDocument(file: File): Observable<DocumentSummary> {
    return this.send<any>({
      operation: DocumentOperation.CREATE,
      file,
    }).pipe(
      map((response: any) => {
        console.log('UPLOAD RAW RESPONSE:', response);
        const item = Array.isArray(response) ? response[0] : response;
        const raw = item?.data ?? item?.item ?? item ?? {};

        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        const pdfUrl = raw.url ?? raw.file_url ?? raw.pdf_url ?? raw.download_url ?? raw.link ?? raw.fileUrl ?? '';

        return {
          id: String(raw.id ?? raw.document_id ?? raw.documentId ?? `doc_${Date.now()}`),
          name: raw.name ?? raw.file_name ?? raw.filename ?? file.name,
          type: raw.type ?? raw.file_type ?? ext,
          status: raw.status ?? 'Processed',
          uploadedAt: raw.uploadedAt ?? raw.uploaded_at ?? raw.created_at ?? new Date().toLocaleDateString(),
          url: pdfUrl,
          fileUrl: pdfUrl,
          content: raw.content ?? raw.text ?? raw.data ?? ''
        };
      })
    );
  }

  /**
   * LIST
   */
  getDocuments(): Observable<DocumentSummary[]> {
    return this.send<any>({
      operation: DocumentOperation.LIST,
    }).pipe(
      map((response: any) => {
        const documents = Array.isArray(response)
          ? response
          : response?.data ?? response?.items ?? (response ? [response] : []);

        return documents
          .filter((doc: any) => doc != null)
          .map((doc: any) => {
            const pdfUrl = doc.url ?? doc.file_url ?? doc.pdf_url ?? doc.download_url ?? doc.link ?? doc.fileUrl ?? '';
            return {
              id: String(doc.document_id ?? doc.id ?? doc.documentId ?? ''),
              name: doc.file_name ?? doc.name ?? doc.filename ?? 'Untitled Document',
              type: doc.file_type ?? doc.type ?? 'Document',
              status: doc.status ?? 'Processed',
              uploadedAt: doc.uploaded_at ?? doc.uploadedAt ?? doc.created_at ?? '',
              url: pdfUrl,
              fileUrl: pdfUrl,
              content: doc.content ?? doc.text ?? ''
            };
          });
      })
    );
  }

  /**
   * READ - Fetch document by ID including PDF url / content
   */
  getDocument(documentId: string): Observable<DocumentSummary> {
    return this.send<any>({
      operation: DocumentOperation.READ,
      documentId,
    }).pipe(
      map((response: any) => {
        console.log('READ DOCUMENT RESPONSE:', response);
        const item = Array.isArray(response) ? response[0] : response;
        const raw = item?.data ?? item?.item ?? item ?? {};

        const pdfUrl = raw.url ?? raw.file_url ?? raw.pdf_url ?? raw.download_url ?? raw.link ?? raw.fileUrl ?? '';

        return {
          id: String(raw.id ?? raw.document_id ?? documentId),
          name: raw.name ?? raw.file_name ?? raw.filename ?? 'Document',
          type: raw.type ?? raw.file_type ?? 'PDF',
          status: raw.status ?? 'Processed',
          uploadedAt: raw.uploaded_at ?? raw.uploadedAt ?? new Date().toLocaleDateString(),
          url: pdfUrl,
          fileUrl: pdfUrl,
          content: raw.content ?? raw.text ?? raw.extracted_text ?? raw.data ?? ''
        };
      })
    );
  }

  /**
   * UPDATE
   */
  updateDocument(documentId: string, name: string): Observable<any> {
    return this.send<any>({
      operation: DocumentOperation.UPDATE,
      documentId,
      name,
    });
  }

  /**
   * DELETE
   */
  deleteDocument(documentId: string): Observable<any> {
    return this.send<any>({
      operation: DocumentOperation.DELETE,
      documentId,
    });
  }

  /**
   * SEARCH
   */
  searchDocuments(query: string): Observable<DocumentSummary[]> {
    return this.send<any[]>({
      operation: DocumentOperation.SEARCH,
      query,
    }).pipe(
      map((documents: any[]) =>
        (documents || []).map((document: any) => {
          const pdfUrl = document.url ?? document.file_url ?? document.pdf_url ?? document.download_url ?? document.link ?? document.fileUrl ?? '';
          return {
            id: String(document.id ?? document.document_id ?? ''),
            name: document.name ?? document.file_name ?? 'Document',
            type: document.type ?? document.file_type ?? 'Document',
            status: document.status ?? 'Processed',
            uploadedAt: document.uploaded_at ?? document.uploadedAt ?? '',
            url: pdfUrl,
            fileUrl: pdfUrl,
            content: document.content ?? document.text ?? ''
          };
        })
      )
    );
  }
}
