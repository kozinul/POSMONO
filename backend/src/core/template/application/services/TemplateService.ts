import { Template } from '../../domain/Template';
import { MongoTemplateRepository } from '../../infrastructure/persistence/MongoTemplateRepository';
import { DocumentType, PaperPreset, DocumentSection } from '../../../document-engine/types/index';

export class TemplateService {
  constructor(private readonly templateRepository: MongoTemplateRepository) {}

  async create(input: {
    tenantId: string;
    name: string;
    description?: string;
    documentType: DocumentType;
    paper: PaperPreset;
    sections?: DocumentSection[];
    isDefault?: boolean;
  }): Promise<Template> {
    if (input.isDefault) {
      await this.templateRepository.clearDefault(input.tenantId, input.documentType);
    }
    const template = Template.create(input);
    await this.templateRepository.save(template);
    await this.templateRepository.saveVersion(template, 'Initial version');
    return template;
  }

  async update(input: {
    id: string;
    tenantId: string;
    name?: string;
    description?: string;
    documentType?: DocumentType;
    paper?: PaperPreset;
    sections?: DocumentSection[];
    isActive?: boolean;
    isDefault?: boolean;
  }): Promise<Template> {
    const template = await this.templateRepository.findById(input.id);
    if (!template) throw new Error('Template not found');
    if (template.tenantId !== input.tenantId) throw new Error('Template not found');

    if (input.isDefault && input.documentType && input.documentType !== template.documentType) {
      await this.templateRepository.clearDefault(input.tenantId, input.documentType);
    }

    template.update({
      name: input.name,
      description: input.description,
      documentType: input.documentType,
      paper: input.paper,
      sections: input.sections,
      isActive: input.isActive,
      isDefault: input.isDefault,
    });
    if (input.isDefault) {
      await this.templateRepository.clearDefault(input.tenantId, template.documentType);
    }
    await this.templateRepository.save(template);
    await this.templateRepository.saveVersion(template);
    return template;
  }

  async setDefault(input: { id: string; tenantId: string }): Promise<Template> {
    const template = await this.templateRepository.findById(input.id);
    if (!template) throw new Error('Template not found');
    if (template.tenantId !== input.tenantId) throw new Error('Template not found');

    await this.templateRepository.clearDefault(input.tenantId, template.documentType);
    template.update({ isDefault: true });
    await this.templateRepository.save(template);
    await this.templateRepository.saveVersion(template, 'Set as default');
    return template;
  }

  async getDefault(tenantId: string, documentType: DocumentType): Promise<Template | null> {
    const defaultTemplate = await this.templateRepository.findDefault(tenantId, documentType);
    if (defaultTemplate) return defaultTemplate;
    const { templates } = await this.templateRepository.findByTenant(tenantId, { documentType, limit: 1 });
    return templates[0] ?? null;
  }

  async publish(input: { id: string; tenantId: string }): Promise<Template> {
    const template = await this.templateRepository.findById(input.id);
    if (!template) throw new Error('Template not found');
    if (template.tenantId !== input.tenantId) throw new Error('Template not found');
    template.publish();
    await this.templateRepository.save(template);
    await this.templateRepository.saveVersion(template, 'Published');
    return template;
  }

  async getById(tenantId: string, id: string): Promise<Template | null> {
    const template = await this.templateRepository.findById(id);
    if (!template || template.tenantId !== tenantId) return null;
    return template;
  }

  async list(
    tenantId: string,
    options?: { page?: number; limit?: number; documentType?: string },
  ): Promise<{ templates: Template[]; total: number }> {
    return this.templateRepository.findByTenant(tenantId, options);
  }

  async duplicate(input: { id: string; tenantId: string; name?: string }): Promise<Template> {
    const original = await this.getById(input.tenantId, input.id);
    if (!original) throw new Error('Template not found');
    const data = original.serialize();
    const duplicate = Template.create({
      tenantId: input.tenantId,
      name: input.name ?? `${data.name} (Copy)`,
      description: data.description,
      documentType: data.documentType,
      paper: data.paper,
      sections: data.sections,
    });
    await this.templateRepository.save(duplicate);
    await this.templateRepository.saveVersion(duplicate, 'Duplicated');
    return duplicate;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const template = await this.templateRepository.findById(id);
    if (!template || template.tenantId !== tenantId) throw new Error('Template not found');
    await this.templateRepository.delete(id);
  }

  async listVersions(tenantId: string, id: string): Promise<any[]> {
    const template = await this.getById(tenantId, id);
    if (!template) throw new Error('Template not found');
    return this.templateRepository.listVersions(id);
  }

  async rollback(input: { id: string; tenantId: string; version: number }): Promise<Template> {
    const template = await this.getById(input.tenantId, input.id);
    if (!template) throw new Error('Template not found');

    const versionData = await this.templateRepository.findByVersion(input.id, input.version);
    if (!versionData) throw new Error('Version not found');

    template.update({
      name: versionData.name,
      description: versionData.description,
      documentType: versionData.documentType,
      paper: versionData.paper,
      sections: versionData.sections,
    });
    await this.templateRepository.save(template);
    await this.templateRepository.saveVersion(template, `Rolled back to v${input.version}`);
    return template;
  }
}
