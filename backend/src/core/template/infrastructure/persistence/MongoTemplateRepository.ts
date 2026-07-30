import { Model, FlattenMaps } from 'mongoose';
import { Template, ITemplate } from '../../domain/Template';

interface TemplateDoc {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  schemaVersion: number;
  documentType: string;
  paper: any;
  sections: any[];
  metadata: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoTemplateRepository {
  constructor(
    private readonly model: Model<any>,
    private readonly versionModel?: Model<any>,
  ) {}

  toDomain(doc: TemplateDoc): Template {
    return Template.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      description: doc.description,
      schemaVersion: doc.schemaVersion,
      documentType: doc.documentType as ITemplate['documentType'],
      paper: doc.paper,
      sections: doc.sections,
      metadata: doc.metadata,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(template: Template): Record<string, unknown> {
    const data = template.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      description: data.description,
      schemaVersion: data.schemaVersion,
      documentType: data.documentType,
      paper: data.paper,
      sections: data.sections,
      metadata: data.metadata,
      isActive: data.isActive,
    };
  }

  async save(template: Template): Promise<void> {
    const data = this.toPersistence(template);
    await this.model.findOneAndUpdate(
      { _id: template.id },
      { $set: data },
      { upsert: true },
    );
  }

  async findById(id: string): Promise<Template | null> {
    const doc = await this.model.findById(id).lean();
    if (!doc) return null;
    return this.toDomain(doc as unknown as TemplateDoc);
  }

  async findByTenant(
    tenantId: string,
    options?: { page?: number; limit?: number; documentType?: string },
  ): Promise<{ templates: Template[]; total: number }> {
    const query: Record<string, unknown> = { tenantId };
    if (options?.documentType) query.documentType = options.documentType;
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.model.countDocuments(query),
    ]);
    return {
      templates: docs.map((d) => this.toDomain(d as unknown as TemplateDoc)),
      total,
    };
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: id });
  }

  async saveVersion(template: Template, changeDescription?: string): Promise<void> {
    if (!this.versionModel) return;
    const data = template.serialize();
    const version = template.metadata.version;
    await this.versionModel.findOneAndUpdate(
      { templateId: template.id, version },
      {
        $set: {
          _id: `${template.id}_v${version}`,
          templateId: template.id,
          version,
          template: data,
          changeDescription: changeDescription ?? '',
          createdBy: data.metadata.createdBy,
          status: data.metadata.publishedAt ? 'published' : 'draft',
        },
      },
      { upsert: true },
    );
  }

  async findByVersion(templateId: string, version: number): Promise<ITemplate | null> {
    if (!this.versionModel) return null;
    const doc = await this.versionModel.findOne(
      { templateId, version },
    ).lean();
    if (!doc) return null;
    return (doc as any).template as ITemplate;
  }

  async listVersions(templateId: string): Promise<{ version: number; status: string; createdAt: string; changeDescription: string }[]> {
    if (!this.versionModel) return [];
    const docs = await this.versionModel.find(
      { templateId },
    ).sort({ version: -1 }).lean();
    return docs.map((d: any) => ({
      version: d.version,
      status: d.status,
      createdAt: d.createdAt?.toISOString?.() ?? d.createdAt,
      changeDescription: d.changeDescription ?? '',
    }));
  }
}
