import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { TemplateService } from '../../../application/services/TemplateService';
import { RenderService } from '../../../application/services/RenderService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { DocumentType, PaperPreset, DocumentSection } from '../../../../document-engine/types/index';

const paperSchema = z.object({
  type: z.enum(['thermal58', 'thermal80', 'a4-portrait', 'a4-landscape']),
  width: z.number(),
  height: z.union([z.number(), z.literal('auto')]),
  margin: z.object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() }),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  documentType: z.enum(['receipt', 'invoice', 'kot', 'label', 'report', 'slip']),
  paper: paperSchema,
  sections: z.array(z.record(z.unknown())).optional().default([]),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  documentType: z.enum(['receipt', 'invoice', 'kot', 'label', 'report', 'slip']).optional(),
  paper: paperSchema.optional(),
  sections: z.array(z.record(z.unknown())).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

const renderSchema = z.object({
  templateId: z.string().optional(),
  template: z.record(z.unknown()).optional(),
  data: z.record(z.unknown()),
}).refine(
  (d) => d.templateId || d.template,
  { message: 'Either templateId or template must be provided' },
);

type CreateInput = z.infer<typeof createSchema>;
type UpdateInput = z.infer<typeof updateSchema>;

export class TemplateController extends BaseController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly renderService?: RenderService,
  ) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    const data = parsed.data as CreateInput;
    const template = await this.templateService.create({
      tenantId: req.tenantId,
      name: data.name,
      description: data.description,
      documentType: data.documentType as DocumentType,
      paper: data.paper as PaperPreset,
      sections: data.sections as unknown as DocumentSection[],
    });
    this.created(res, template.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    const data = parsed.data as UpdateInput;
    const template = await this.templateService.update({
      id: req.params.id,
      tenantId: req.tenantId,
      name: data.name,
      description: data.description,
      documentType: data.documentType as DocumentType | undefined,
      paper: data.paper as PaperPreset | undefined,
      sections: data.sections as unknown as DocumentSection[] | undefined,
      isActive: data.isActive,
    });
    this.ok(res, template.serialize());
  }

  async getById(req: Request, res: Response): Promise<void> {
    const template = await this.templateService.getById(req.tenantId, req.params.id);
    if (!template) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }
    this.ok(res, template.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const documentType = req.query.documentType as string | undefined;
    const result = await this.templateService.list(req.tenantId, { page, limit, documentType });
    this.ok(res, result.templates.map((t) => t.serialize()), { total: result.total, page, limit });
  }

  async publish(req: Request, res: Response): Promise<void> {
    const template = await this.templateService.publish({ id: req.params.id, tenantId: req.tenantId });
    this.ok(res, template.serialize());
  }

  async duplicate(req: Request, res: Response): Promise<void> {
    const name = req.body.name as string | undefined;
    const template = await this.templateService.duplicate({ id: req.params.id, tenantId: req.tenantId, name });
    this.created(res, template.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.templateService.delete(req.tenantId, req.params.id);
    this.noContent(res);
  }

  async render(req: Request, res: Response): Promise<void> {
    if (!this.renderService) throw new Error('RenderService not available');
    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    const { templateId, template, data } = parsed.data as any;
    const result = templateId && templateId !== 'new'
      ? await this.renderService.render(templateId, req.tenantId, data)
      : await this.renderService.renderInline(template, data);
    this.ok(res, result);
  }

  async renderPreview(req: Request, res: Response): Promise<void> {
    if (!this.renderService) throw new Error('RenderService not available');
    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    const { templateId, template, data } = parsed.data as any;
    const result = templateId && templateId !== 'new'
      ? await this.renderService.renderPreview(templateId, req.tenantId, data)
      : await this.renderService.renderPreviewInline(template, data);
    this.ok(res, result);
  }

  async validate(req: Request, res: Response): Promise<void> {
    if (!this.renderService) throw new Error('RenderService not available');
    const parsed = z.object({ template: z.record(z.unknown()) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('template is required');
    const result = await this.renderService.validate(parsed.data.template);
    this.ok(res, result);
  }

  async exportTemplate(req: Request, res: Response): Promise<void> {
    const template = await this.templateService.getById(req.tenantId, req.params.id);
    if (!template) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${template.name}.kuire-template.json"`);
    this.ok(res, template.serialize());
  }

  async importTemplate(req: Request, res: Response): Promise<void> {
    const parsed = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      template: z.record(z.unknown()),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    const importData = parsed.data;
    const templateData = importData.template as any;
    const template = await this.templateService.create({
      tenantId: req.tenantId,
      name: importData.name ?? templateData.name ?? 'Imported Template',
      description: importData.description ?? templateData.description,
      documentType: templateData.documentType ?? 'receipt',
      paper: templateData.paper ?? { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
      sections: templateData.sections ?? [],
    });
    this.created(res, template.serialize());
  }

  async listVersions(req: Request, res: Response): Promise<void> {
    const versions = await this.templateService.listVersions(req.tenantId, req.params.id);
    this.ok(res, versions);
  }

  async rollback(req: Request, res: Response): Promise<void> {
    const version = parseInt(req.params.versionId, 10);
    if (isNaN(version)) throw new ValidationError('Invalid version');
    const template = await this.templateService.rollback({
      id: req.params.id,
      tenantId: req.tenantId,
      version,
    });
    this.ok(res, template.serialize());
  }
}
