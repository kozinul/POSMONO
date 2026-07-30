import { TemplateService } from './TemplateService';
import { createDefaultEngine } from '../../../document-engine/defaults';
import { DocumentData } from '../../../document-engine/types/document-data';
import { RenderDocument, PreviewResult } from '../../../document-engine/types/layout';

export class RenderService {
  private engine = createDefaultEngine();

  constructor(private readonly templateService: TemplateService) {}

  async render(templateId: string, tenantId: string, data: DocumentData): Promise<RenderDocument> {
    const template = await this.templateService.getById(tenantId, templateId);
    if (!template) throw new Error('Template not found');
    return this.engine.resolve(template.serialize() as any, data);
  }

  async renderPreview(templateId: string, tenantId: string, data: DocumentData): Promise<PreviewResult> {
    const template = await this.templateService.getById(tenantId, templateId);
    if (!template) throw new Error('Template not found');
    return this.engine.renderPreview(template.serialize() as any, data);
  }

  async renderInline(template: unknown, data: DocumentData): Promise<RenderDocument> {
    this.engine.load(template);
    return this.engine.resolve(template as any, data);
  }

  async renderPreviewInline(template: unknown, data: DocumentData): Promise<PreviewResult> {
    this.engine.load(template);
    return this.engine.renderPreview(template as any, data);
  }

  async validate(template: unknown): Promise<{ valid: boolean; errors: string[] }> {
    const result = this.engine.validate(template);
    return {
      valid: result.valid,
      errors: result.errors.map((e) => e.message),
    };
  }
}
