export interface DocumentSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  uploadedAt: string;
  document_id?: string;
  file_name?: string;
  file_type?: string;
  uploaded_at?: string;
  url?: string;
  fileUrl?: string;
  sourceFile?: File;
  content?: string;
  [key: string]: unknown;
}

export interface DuplicateFileResponse {
  duplicate: true;
  file_name: string;
  document_id: string;
  message: string;
  options: ('replace' | 'save_as_new')[];
}
export interface UploadDocumentResponse {
  duplicate?: boolean;
  file_name?: string;
  document_id?: string;
  message?: string;
  options?: ('replace' | 'save_as_new')[];
  [key: string]: unknown;
}
