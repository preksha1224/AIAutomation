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
  providedIn: 'root',
})
export class DocumentService {

  private readonly webhook =
    'https://intn8n.deenovum.com/webhook-test/4eb0f07a-0b98-4e75-9df3-4454666fdb3a';

  constructor(private http: HttpClient) {}

  private post(formData: FormData): Observable<any> {
    return this.http.post(this.webhook, formData);
  }

  /**
   * CREATE
   */
  uploadDocument(file: File): Observable<any> {

    const formData = new FormData();

    formData.append('operation', 'create');
    formData.append('file', file);

    return this.post(formData);
  }

  /**
   * LIST
   */
  getDocuments(): Observable<DocumentSummary[]> {

    const formData = new FormData();

    formData.append('operation', 'list');

    return this.post(formData);
  }

  /**
   * READ
   */
  getDocument(id: string): Observable<DocumentSummary> {

    const formData = new FormData();

    formData.append('operation', 'read');
    formData.append('documentId', id);

    return this.post(formData);
  }

  /**
   * SEARCH
   */
  searchDocuments(query: string): Observable<any> {

    const formData = new FormData();

    formData.append('operation', 'search');
    formData.append('query', query);

    return this.post(formData);
  }

  /**
   * UPDATE
   */
  updateDocument(id: string, name: string): Observable<any> {

    const formData = new FormData();

    formData.append('operation', 'update');
    formData.append('documentId', id);
    formData.append('name', name);

    return this.post(formData);
  }

  /**
   * DELETE
   */
  deleteDocument(id: string): Observable<any> {

    const formData = new FormData();

    formData.append('operation', 'delete');
    formData.append('documentId', id);

    return this.post(formData);
  }

}
