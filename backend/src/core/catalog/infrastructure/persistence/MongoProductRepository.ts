import { Model, Document } from 'mongoose';
import { Product, IProduct } from '../../domain/Product';

interface ProductDoc extends Document<string> {
  _id: string;
  tenantId: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  imageUrls: string[];
  tags: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoProductRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: ProductDoc): Product {
    return Product.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      sku: doc.sku,
      barcode: doc.barcode,
      name: doc.name,
      description: doc.description,
      categoryId: doc.categoryId,
      basePrice: doc.basePrice,
      imageUrls: doc.imageUrls,
      tags: doc.tags,
      isActive: doc.isActive,
      metadata: doc.metadata || {},
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IProduct);
  }

  toPersistence(product: Product): Partial<ProductDoc> {
    const data = product.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      sku: data.sku,
      barcode: data.barcode,
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      basePrice: data.basePrice,
      imageUrls: data.imageUrls,
      tags: data.tags,
      isActive: data.isActive,
      metadata: data.metadata,
    } as unknown as Partial<ProductDoc>;
  }

  async save(product: Product): Promise<void> {
    const data = this.toPersistence(product);
    await this.model.findOneAndUpdate({ _id: product.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    product.clearEvents();
  }

  async findById(id: string): Promise<Product | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findBySku(tenantId: string, sku: string): Promise<Product | null> {
    const doc = await this.model.findOne({ tenantId, sku }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
    if (!barcode) return null;
    const doc = await this.model.findOne({ tenantId, barcode }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string, options?: { page?: number; limit?: number; categoryId?: string; search?: string }): Promise<{ products: Product[]; total: number }> {
    const filter: any = { tenantId };
    if (options?.categoryId) filter.categoryId = options.categoryId;
    if (options?.search) {
      filter.$or = [
        { name: { $regex: options.search, $options: 'i' } },
        { sku: { $regex: options.search, $options: 'i' } },
        { barcode: options.search },
      ];
    }

    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 50, 100);
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter),
    ]);

    return { products: docs.map((d: ProductDoc) => this.toDomain(d)), total };
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}
