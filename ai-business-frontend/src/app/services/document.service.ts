import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

import { WebhookRequest } from '../models/webhook-request.model';
import { DocumentOperation } from '../models/document-operation.enum';
import { DocumentSummary } from '../models/document.summary.model';

type DocumentApiResponse = Record<string, unknown>;

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private readonly webhook =
    'https://intn8n.deenovum.com/webhook/4eb0f07a-0b98-4e75-9df3-4454666fdb3a';

  private readonly deleteWebhook =
    'https://automation-crud-ai-ukhvmwc.svc.aped-4627-b74a.pinecone.io/vectors/delete';

  constructor(private readonly http: HttpClient) {}

  /**
   * Generic request to n8n
   */
  private send<T = unknown>(request: WebhookRequest, url: string = this.webhook): Observable<T> {
    const formData = new FormData();

    if (request.operation) {
      formData.append('operation', request.operation);
    }

    if (request.file) {
      formData.append('file', request.file);
    }

    if (request.documentId) {
      formData.append('documentId', request.documentId);
      formData.append('document_id', request.documentId);
      formData.append('id', request.documentId);
    }

    if (request.name) {
      formData.append('name', request.name);
    }

    if (request.query) {
      formData.append('query', request.query);
    }

    console.group('Document Service');
    console.log('URL:', url);
    console.log('Request:', request);
    console.groupEnd();

    return this.http.post<T>(url, formData);
  }

  private isRecord(value: unknown): value is DocumentApiResponse {
    return typeof value === 'object' && value !== null;
  }

  private pickString(document: DocumentApiResponse, ...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = document[key];

      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    return undefined;
  }

  private normalizeDocumentPayload(document: DocumentApiResponse): DocumentApiResponse {
    const metadata = this.isRecord(document['metadata']) ? document['metadata'] : {};

    return {
      ...document,
      ...metadata,
    };
  }

  private findFirstUrl(value: unknown, depth: number = 0): string | undefined {
    if (depth > 4) {
      return undefined;
    }

    if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
      return value;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const candidate = this.findFirstUrl(item, depth + 1);
        if (candidate) {
          return candidate;
        }
      }

      return undefined;
    }

    if (this.isRecord(value)) {
      const preferredKeys = [
        'fileUrl',
        'fileURL',
        'url',
        'file_url',
        'download_url',
        'signedUrl',
        'signed_url',
        'publicUrl',
        'public_url',
      ];

      for (const key of preferredKeys) {
        const candidate = value[key];
        if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim())) {
          return candidate;
        }
      }

      for (const nestedValue of Object.values(value)) {
        const candidate = this.findFirstUrl(nestedValue, depth + 1);
        if (candidate) {
          return candidate;
        }
      }
    }

    return undefined;
  }

  private extractDocumentPayloads(response: unknown): DocumentApiResponse[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is DocumentApiResponse => this.isRecord(item));
    }

    if (!this.isRecord(response)) {
      return [];
    }

    const nestedPayload =
      response['data'] ??
      response['items'] ??
      response['documents'] ??
      response['document'] ??
      response['result'];

    if (Array.isArray(nestedPayload)) {
      return nestedPayload.filter((item): item is DocumentApiResponse => this.isRecord(item));
    }

    if (this.isRecord(nestedPayload)) {
      return [nestedPayload];
    }

    return [response];
  }

  private toDocumentSummary(
    document: DocumentApiResponse,
    sourceFile?: File,
    fallbackId?: string,
  ): DocumentSummary | null {
    const normalizedDocument = this.normalizeDocumentPayload(document);

    const id =
      this.pickString(normalizedDocument, 'document_id', 'id', 'pageContent') ?? fallbackId;

    if (!id) {
      return null;
    }

    const name = this.pickString(normalizedDocument, 'file_name', 'name') ?? sourceFile?.name ?? '';

    const type = this.pickString(normalizedDocument, 'file_type', 'type') ?? sourceFile?.type ?? '';

    const uploadedAt = this.pickString(normalizedDocument, 'uploaded_at', 'uploadedAt') ?? '';
    const resolvedUrl =
      this.pickString(
        normalizedDocument,
        'fileUrl',
        'fileURL',
        'url',
        'file_url',
        'download_url',
        'signedUrl',
        'signed_url',
        'publicUrl',
        'public_url',
      ) ?? this.findFirstUrl(normalizedDocument);

    return {
      ...normalizedDocument,

      id,
      name,
      type,

      status: this.pickString(normalizedDocument, 'status') ?? 'Pending',

      uploadedAt,

      document_id: this.pickString(normalizedDocument, 'document_id') ?? id,

      file_name: this.pickString(normalizedDocument, 'file_name') ?? name,

      file_type: this.pickString(normalizedDocument, 'file_type') ?? type,

      uploaded_at: this.pickString(normalizedDocument, 'uploaded_at', 'uploadedAt') ?? uploadedAt,

      url: resolvedUrl,
      fileUrl: resolvedUrl,

      sourceFile,
    };
  }

  private mapDocuments(
    response: unknown,
    sourceFile?: File,
    fallbackId?: string,
  ): DocumentSummary[] {
    return this.extractDocumentPayloads(response)
      .map((document) => this.toDocumentSummary(document, sourceFile, fallbackId))
      .filter((document): document is DocumentSummary => document !== null);
  }

  /**
   * CREATE - Uploads file and maps the returned document ID & URL details
   */
  uploadDocument(file: File): Observable<DocumentSummary> {
    return this.send({
      operation: DocumentOperation.CREATE,
      file,
    }).pipe(
      map((response) => {
        const [document] = this.mapDocuments(response, file);

        if (!document?.document_id) {
          throw new Error('Upload response did not contain document_id.');
        }

        return document;
      }),
    );
  }

  /**
   * LIST
   */
  getDocuments(): Observable<DocumentSummary[]> {
    return this.send({
      operation: DocumentOperation.LIST,
    }).pipe(
      map((response) => this.mapDocuments(response)),

      catchError((error) => {
        console.warn('No documents found.', error);
        return of([]);
      }),
    );
  }

  /**
   * READ - Fetch document by ID including PDF url / content
   */
  getDocument(documentId: string): Observable<DocumentSummary> {
    return this.send({
      operation: DocumentOperation.READ,
      documentId,
    }).pipe(
      map((response) => {
        const [document] = this.mapDocuments(response, undefined, documentId);

        if (!document) {
          throw new Error('Document response did not contain metadata.');
        }

        return document;
      }),
    );
  }

  /**
   * UPDATE
   */
  updateDocument(documentId: string, name: string): Observable<unknown> {
    return this.send({
      operation: DocumentOperation.UPDATE,
      documentId,
      name,
    });
  }

  /**
   * DELETE
   */
  deleteDocument(documentId: string): Observable<unknown> {
    return this.send(
      {
        operation: DocumentOperation.DELETE,
        documentId,
      },
      this.deleteWebhook,
    );
  }

  /**
   * SEARCH
   */
  searchDocuments(query: string): Observable<DocumentSummary[]> {
    return this.send({
      operation: DocumentOperation.SEARCH,
      query,
    }).pipe(map((response) => this.mapDocuments(response)));
  }
}
