export interface DocumentSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  uploadedAt: string;
  url?: string;
  fileUrl?: string;
  content?: string;
}
