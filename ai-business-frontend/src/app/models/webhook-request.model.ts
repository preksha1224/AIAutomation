import { DocumentOperation } from "./document-operation.enum";

export interface WebhookRequest {
  operation: DocumentOperation;
  file?: File;
  documentId?: string;
  name?: string;
  query?: string;
}
