export interface DocumentSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  uploadedAt: string;
<<<<<<< HEAD
  document_id?: string;
  file_name?: string;
  file_type?: string;
  uploaded_at?: string;
  url?: string;
  fileUrl?: string;
  sourceFile?: File;
  [key: string]: unknown;
=======
  url?: string;
  fileUrl?: string;
  content?: string;
>>>>>>> 97641a2858a858b7aefeec9da1bdc7b23b1fb0e8
}
