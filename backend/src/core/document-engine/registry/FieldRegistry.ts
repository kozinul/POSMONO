import { FieldDefinition } from '../types/fields';
import { DocumentType } from '../types/template';

export class FieldRegistry {
  private fields = new Map<string, FieldDefinition>();

  register(field: FieldDefinition): void {
    this.fields.set(field.path, field);
  }

  get(path: string): FieldDefinition | undefined {
    return this.fields.get(path);
  }

  getAll(documentType?: DocumentType): FieldDefinition[] {
    const all = Array.from(this.fields.values());
    if (!documentType) return all;
    return all.filter((f) => f.documentTypes.includes(documentType));
  }

  remove(path: string): void {
    this.fields.delete(path);
  }

  clear(): void {
    this.fields.clear();
  }
}
