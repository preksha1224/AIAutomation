import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

import { WebhookRequest } from '../models/webhook-request.model';
import { DocumentOperation } from '../models/document-operation.enum';
import { DocumentSummary, UploadDocumentResponse } from '../models/document.summary.model';

type DocumentApiResponse = Record<string, unknown>;

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  // ============================================================
  // WEBHOOKS
  // ============================================================

  private readonly webhook =
    'https://intn8n.deenovum.com/webhook/4eb0f07a-0b98-4e75-9df3-4454666fdb3a';

  private readonly deleteWebhook =
    'https://intn8n.deenovum.com/webhook/96a25dc9-1356-4d21-acd4-f746d03b6e18';

  private readonly renameWebhook =
    'https://intn8n.deenovum.com/webhook/bdac33c5-4e3e-4336-82f0-84fd4d3b78d5';

  constructor(private readonly http: HttpClient) {}

  // ============================================================
  // GENERIC REQUEST
  // ============================================================

  private send<T = unknown>(request: WebhookRequest, url: string = this.webhook): Observable<T> {
    const formData = new FormData();

    // Operation
    if (request.operation) {
      formData.append('operation', request.operation);
    }

    // IMPORTANT:
    // Always send the real File object as multipart binary.
    if (request.file instanceof File) {
      formData.append('file', request.file, request.file.name);
    }

    // Document ID
    if (request.documentId) {
      formData.append('documentId', request.documentId);

      formData.append('document_id', request.documentId);

      formData.append('id', request.documentId);
    }

    // Name
    if (request.name) {
      formData.append('name', request.name);
    }

    // Query
    if (request.query) {
      formData.append('query', request.query);
    }

    console.group('DOCUMENT SERVICE REQUEST');
    console.log('URL:', url);
    console.log('Operation:', request.operation);
    console.log('File:', request.file);
    console.log('Document ID:', request.documentId);
    console.log('Name:', request.name);
    console.log('Query:', request.query);
    console.groupEnd();

    // IMPORTANT:
    // Do NOT set Content-Type manually.
    // Browser automatically creates:
    // multipart/form-data; boundary=...
    return this.http.post<T>(url, formData);
  }

  // ============================================================
  // HELPERS
  // ============================================================

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

  // ============================================================
  // CREATE
  // ============================================================

  uploadDocument(file: File): Observable<UploadDocumentResponse> {
    if (!(file instanceof File)) {
      throw new Error('uploadDocument: file is not a valid File object.');
    }

    if (file.size === 0) {
      throw new Error('uploadDocument: file is empty.');
    }

    return this.send<UploadDocumentResponse>({
      operation: DocumentOperation.CREATE,
      file,
    }).pipe(
      map((response) => {
        // ------------------------------------------------------
        // DUPLICATE RESPONSE
        // ------------------------------------------------------

        if (response.duplicate === true) {
          return {
            duplicate: true,

            file_name: response.file_name || file.name,

            document_id: response.document_id || '',

            message:
              response.message || 'File already exists. Would you like to save it as a new file?',

            options: ['save_as_new'],
          };
        }

        // ------------------------------------------------------
        // NORMAL UPLOAD
        // ------------------------------------------------------

        const [document] = this.mapDocuments(response, file);

        if (!document?.document_id) {
          throw new Error('Upload response did not contain document_id.');
        }

        return document;
      }),
    );
  }

  // ============================================================
  // SAVE AS NEW
  // ============================================================

  saveAsNewDocument(file: File, fileName?: string): Observable<unknown> {
    if (!(file instanceof File)) {
      throw new Error('saveAsNewDocument: Invalid File object.');
    }

    if (file.size <= 0) {
      throw new Error('saveAsNewDocument: File is empty.');
    }

    const formData = new FormData();

    // MUST be "file"
    formData.append('file', file, file.name);

    // MUST be save_as_new
    formData.append('operation', 'save_as_new');

    formData.append('file_name', fileName?.trim() || file.name);

    console.log('========== SAVE AS NEW REQUEST ==========');

    console.log('URL:', this.webhook);

    console.log('operation:', 'save_as_new');

    console.log('file:', file);

    console.log('file.name:', file.name);

    console.log('file.type:', file.type);

    console.log('file.size:', file.size);

    console.log('FormData:');

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(key, {
          name: value.name,
          type: value.type,
          size: value.size,
        });
      } else {
        console.log(key, value);
      }
    }

    console.log('==========================================');

    return this.http.post<unknown>(this.webhook, formData);
  }
  // ============================================================
  // LIST
  // ============================================================

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

  // ============================================================
  // READ
  // ============================================================

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

  // ============================================================
  // UPDATE
  // ============================================================

  updateDocument(documentId: string, name: string): Observable<unknown> {
    return this.send({
      operation: DocumentOperation.UPDATE,
      documentId,
      name,
    });
  }

  // ============================================================
  // RENAME
  // ============================================================

  renameDocument(documentId: string, newName: string, file?: File | null): Observable<unknown> {
    const formData = new FormData();

    formData.append('operation', 'update');

    formData.append('documentId', documentId);

    formData.append('document_id', documentId);

    formData.append('id', documentId);

    formData.append('name', newName);

    formData.append('file_name', newName);

    // Send actual file if provided
    if (file instanceof File && file.size > 0) {
      formData.append('file', file, file.name);
    }

    console.log('RENAME DOCUMENT', {
      documentId,
      newName,
      file,
    });

    return this.http.post<unknown>(this.renameWebhook, formData);
  }

  // ============================================================
  // DELETE
  // ============================================================

  deleteDocument(documentId: string): Observable<unknown> {
    const formData = new FormData();

    formData.append('documentId', documentId);

    formData.append('document_id', documentId);

    formData.append('id', documentId);

    console.log('Deleting document:', documentId);

    console.log('Delete webhook:', this.deleteWebhook);

    return this.http.post<unknown>(this.deleteWebhook, formData);
  }

  // ============================================================
  // SEARCH
  // ============================================================

  searchDocuments(query: string): Observable<DocumentSummary[]> {
    return this.send({
      operation: DocumentOperation.SEARCH,
      query,
    }).pipe(map((response) => this.mapDocuments(response)));
  }
}
