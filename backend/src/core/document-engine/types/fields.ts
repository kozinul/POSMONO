import type { DocumentType } from './template';

export type FieldCategory =
  | 'store' | 'order' | 'customer' | 'item' | 'payment' | 'promotion' | 'summary';

export interface FieldDefinition {
  path: string;
  type: 'string' | 'number' | 'image' | 'boolean';
  label: string;
  category: FieldCategory;
  documentTypes: DocumentType[];
  sampleValue: unknown;
}
