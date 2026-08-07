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
  [key: string]: unknown;
}
