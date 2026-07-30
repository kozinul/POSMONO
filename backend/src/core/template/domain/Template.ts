import { v4 as uuid } from 'uuid';
import { Template as TemplateType, DocumentSection, TemplateMetadata } from '../../document-engine/types/template';
import { PaperPreset, DocumentType } from '../../document-engine/types/index';

export interface ITemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  schemaVersion: number;
  documentType: DocumentType;
  paper: PaperPreset;
  sections: DocumentSection[];
  metadata: TemplateMetadata;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Template {
  private constructor(private props: ITemplate) {}

  static create(input: {
    tenantId: string;
    name: string;
    description?: string;
    documentType: DocumentType;
    paper: PaperPreset;
    sections?: DocumentSection[];
  }): Template {
    const now = new Date();
    return new Template({
      id: uuid(),
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
      schemaVersion: 1,
      documentType: input.documentType,
      paper: input.paper,
      sections: input.sections ?? [],
      metadata: {
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        version: 1,
        createdBy: 'system',
      },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static hydrate(props: ITemplate): Template {
    return new Template(props);
  }

  update(input: Partial<Pick<ITemplate, 'name' | 'description' | 'documentType' | 'paper' | 'sections' | 'isActive'>>): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.description !== undefined) this.props.description = input.description;
    if (input.documentType !== undefined) this.props.documentType = input.documentType;
    if (input.paper !== undefined) this.props.paper = input.paper;
    if (input.sections !== undefined) this.props.sections = input.sections;
    if (input.isActive !== undefined) this.props.isActive = input.isActive;
    this.props.updatedAt = new Date();
    this.props.metadata.updatedAt = new Date().toISOString();
    this.props.metadata.version++;
  }

  publish(): void {
    this.props.metadata.publishedAt = new Date().toISOString();
    this.props.updatedAt = new Date();
  }

  serialize(): ITemplate {
    return { ...this.props };
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get name(): string { return this.props.name; }
  get documentType(): DocumentType { return this.props.documentType; }
  get isActive(): boolean { return this.props.isActive; }
  get sections(): DocumentSection[] { return this.props.sections; }
  get paper(): PaperPreset { return this.props.paper; }
  get metadata(): TemplateMetadata { return this.props.metadata; }
}
