import { ConflictError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { Product, IProduct } from '../../domain/Product';

interface CreateProductInput {
  tenantId: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId: string;
  basePrice: number;
  tags?: string[];
}

interface UpdateProductInput {
  sku?: string;
  barcode?: string;
  name?: string;
  description?: string;
  categoryId?: string;
  basePrice?: number;
  tags?: string[];
  isActive?: boolean;
}

interface ListProductsOptions {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
}

export class ProductService {
  constructor(private readonly productRepository: any) {}

  async create(input: CreateProductInput): Promise<Product> {
    const existing = await this.productRepository.findBySku(input.tenantId, input.sku);
    if (existing) {
      throw new ConflictError('Product with this SKU already exists');
    }

    const product = Product.create({
      tenantId: input.tenantId,
      sku: input.sku,
      barcode: input.barcode || '',
      name: input.name,
      description: input.description || '',
      categoryId: input.categoryId,
      basePrice: input.basePrice,
      imageUrls: [],
      tags: input.tags || [],
      isActive: true,
      metadata: {},
    });

    await this.productRepository.save(product);
    return product;
  }

  async update(id: string, tenantId: string, input: UpdateProductInput): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product');
    }

    if (input.sku && input.sku !== product.serialize().sku) {
      const existing = await this.productRepository.findBySku(tenantId, input.sku);
      if (existing) {
        throw new ConflictError('Product with this SKU already exists');
      }
    }

    product.update(input);
    await this.productRepository.save(product);
    return product;
  }

  async getById(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product');
    }
    return product;
  }

  async list(tenantId: string, options?: ListProductsOptions): Promise<{ products: Product[]; total: number }> {
    return this.productRepository.findByTenant(tenantId, options);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const product = await this.getById(id);
    product.update({ isActive: false });
    await this.productRepository.save(product);
  }
}
