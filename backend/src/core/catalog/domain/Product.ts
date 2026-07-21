import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { ProductId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export interface IProduct {
  id: string;
  tenantId: string;
  sku: string;
  barcode: string;
  bc: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  pricingProfileId?: string;
  imageUrls: string[];
  tags: string[];
  country: string;
  region: string;
  currency: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Product extends AggregateRoot<ProductId> {
  private tenantId: string;
  private sku: string;
  private barcode: string;
  private bc: string;
  private name: string;
  private description: string;
  private categoryId: string;
  private basePrice: number;
  private pricingProfileId?: string;
  private imageUrls: string[];
  private tags: string[];
  private country: string;
  private region: string;
  private currency: string;
  private isActive: boolean;
  private metadata: Record<string, unknown>;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IProduct) {
    super(new ProductId(props.id));
    this.tenantId = props.tenantId;
    this.sku = props.sku;
    this.barcode = props.barcode;
    this.bc = props.bc ?? '';
    this.name = props.name;
    this.description = props.description;
    this.categoryId = props.categoryId;
    this.basePrice = props.basePrice;
    this.pricingProfileId = props.pricingProfileId;
    this.imageUrls = [...props.imageUrls];
    this.tags = [...props.tags];
    this.country = props.country ?? '';
    this.region = props.region ?? '';
    this.currency = props.currency ?? '';
    this.isActive = props.isActive;
    this.metadata = { ...props.metadata };
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IProduct, 'id' | 'createdAt' | 'updatedAt'>): Product {
    const product = new Product({
      ...props,
      id: new ProductId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    product.addDomainEvent(
      new DomainEvent({
        eventName: 'catalog.product.created',
        aggregateId: product.id.toValue(),
        aggregateType: 'Product',
        tenantId: product.tenantId,
        payload: {
          productId: product.id.toValue(),
          sku: product.sku,
          name: product.name,
        },
      }),
    );

    return product;
  }

  static hydrate(props: IProduct): Product {
    return new Product(props);
  }

  update(data: Partial<Pick<IProduct, 'name' | 'description' | 'categoryId' | 'basePrice' | 'barcode' | 'sku' | 'tags' | 'imageUrls' | 'isActive' | 'pricingProfileId' | 'bc' | 'country' | 'region' | 'currency'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.categoryId !== undefined) this.categoryId = data.categoryId;
    if (data.basePrice !== undefined) this.basePrice = data.basePrice;
    if (data.barcode !== undefined) this.barcode = data.barcode;
    if (data.sku !== undefined) this.sku = data.sku;
    if (data.tags !== undefined) this.tags = [...data.tags];
    if (data.imageUrls !== undefined) this.imageUrls = [...data.imageUrls];
    if (data.isActive !== undefined) this.isActive = data.isActive;
    if (data.pricingProfileId !== undefined) this.pricingProfileId = data.pricingProfileId;
    if (data.bc !== undefined) this.bc = data.bc;
    if (data.country !== undefined) this.country = data.country;
    if (data.region !== undefined) this.region = data.region;
    if (data.currency !== undefined) this.currency = data.currency;
    this.updatedAt = new Date();
  }

  serialize(): IProduct {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      sku: this.sku,
      barcode: this.barcode,
      bc: this.bc,
      name: this.name,
      description: this.description,
      categoryId: this.categoryId,
      basePrice: this.basePrice,
      pricingProfileId: this.pricingProfileId,
      imageUrls: [...this.imageUrls],
      tags: [...this.tags],
      country: this.country,
      region: this.region,
      currency: this.currency,
      isActive: this.isActive,
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
