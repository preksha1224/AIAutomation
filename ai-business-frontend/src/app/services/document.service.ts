import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface DocumentSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  uploadedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentService {

  private readonly webhook =
    'https://intn8n.deenovum.com/webhook-test/4eb0f07a-0b98-4e75-9df3-4454666fdb3a';

  constructor(private http: HttpClient) {}

  /**
   * CREATE
   */
  uploadDocument(file: File): Observable<any> {

    const formData = new FormData();

    formData.append('operation', 'create');
    formData.append('file', file);

    return this.http.post(this.webhook, formData);

  }

  /**
   * READ ALL DOCUMENTS
   */
  getDocuments(): Observable<DocumentSummary[]> {

    return this.http.post<DocumentSummary[]>(this.webhook, {
      operation: 'list'
    });

  }

  /**
   * READ SINGLE DOCUMENT
   */
  getDocument(id: string): Observable<DocumentSummary> {

    return this.http.post<DocumentSummary>(this.webhook, {
      operation: 'read',
      documentId: id
    });

  }

  /**
   * SEARCH DOCUMENTS
   */
  searchDocuments(query: string): Observable<DocumentSummary[]> {

    return this.http.post<DocumentSummary[]>(this.webhook, {
      operation: 'search',
      query: query
    });

  }

  /**
   * UPDATE DOCUMENT
   */
  updateDocument(id: string, name: string): Observable<any> {

    return this.http.post(this.webhook, {
      operation: 'update',
      documentId: id,
      name: name
    });

  }

  /**
   * DELETE DOCUMENT
   */
  deleteDocument(id: string): Observable<any> {

    return this.http.post(this.webhook, {
      operation: 'delete',
      documentId: id
    });

  }

}