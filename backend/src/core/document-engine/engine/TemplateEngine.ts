import { Template } from '../types/template';
import { DocumentData } from '../types/document-data';
import { RenderDocument, PreviewResult } from '../types/layout';
import { ValidationResult } from '../validation/TemplateValidator';
import { FieldDefinition } from '../types/fields';
import { DocumentType, PaperPreset } from '../types/index';
import { TemplateValidator } from '../validation/TemplateValidator';
import { DocumentRenderer } from '../renderer/DocumentRenderer';
import { FieldRegistry } from '../registry/FieldRegistry';
import { ComponentRegistry } from '../registry/ComponentRegistry';
import { PaperRegistry } from '../registry/PaperRegistry';

export class TemplateEngine {
  readonly fields: FieldRegistry;
  readonly components: ComponentRegistry;
  readonly papers: PaperRegistry;
  private readonly validator: TemplateValidator;
  private readonly renderer: DocumentRenderer;

  constructor(registries?: {
    fields?: FieldRegistry;
    components?: ComponentRegistry;
    papers?: PaperRegistry;
  }) {
    this.fields = registries?.fields ?? new FieldRegistry();
    this.components = registries?.components ?? new ComponentRegistry();
    this.papers = registries?.papers ?? new PaperRegistry();
    this.validator = new TemplateValidator();
    this.renderer = new DocumentRenderer(this.fields, this.components, this.papers);
  }

  load(json: unknown): Template {
    const result = this.validate(json);
    if (!result.valid) {
      throw new Error(`Invalid template: ${result.errors.map((e) => e.message).join(', ')}`);
    }
    return json as Template;
  }

  resolve(template: Template, data: DocumentData): RenderDocument {
    return this.renderer.render(template, data);
  }

  renderThermal(template: Template, data: DocumentData): Buffer {
    return this.renderer.renderThermal(template, data);
  }

  renderPdf(template: Template, data: DocumentData): Promise<Buffer> {
    return this.renderer.renderPdf(template, data);
  }

  renderPreview(template: Template, data: DocumentData): PreviewResult {
    return this.renderer.renderPreview(template, data);
  }

  validate(template: unknown): ValidationResult {
    return this.validator.validate(template);
  }

  getAvailableFields(documentType: DocumentType): FieldDefinition[] {
    return this.fields.getAll(documentType);
  }

  getPaperPresets(): PaperPreset[] {
    return this.papers.getAll();
  }
}
