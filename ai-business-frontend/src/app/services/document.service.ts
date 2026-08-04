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
   * CREATE
   */
  uploadDocument(file: File): Observable<any> {
    return this.send<any>({
      operation: DocumentOperation.CREATE,
      file,
    });
  }

  /**
   * LIST
   */
  getDocuments(): Observable<DocumentSummary[]> {
    return this.send<any>({
      operation: DocumentOperation.LIST,
    }).pipe(
      map((response: any) => {
        const documents = Array.isArray(response) ? response : [response];

        return documents.map((doc: any) => ({
          id: doc.document_id,
          name: doc.file_name,
          type: doc.file_type,
          status: doc.status,
          uploadedAt: doc.uploaded_at,
        }));
      }),
    );
  }

  /**
   * READ
   */
  getDocument(documentId: string): Observable<DocumentSummary> {
    return this.send<any>({
      operation: DocumentOperation.READ,
      documentId,
    }).pipe(
      map((document) => ({
        id: document.id,
        name: document.name,
        type: document.type,
        status: document.status,
        uploadedAt: document.uploaded_at,
      })),
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
        documents.map((document) => ({
          id: document.id,
          name: document.name,
          type: document.type,
          status: document.status,
          uploadedAt: document.uploaded_at,
        })),
      ),
    );
  }
}
