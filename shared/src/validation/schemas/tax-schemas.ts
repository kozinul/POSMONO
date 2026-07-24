import { z } from 'zod';

export const taxRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  type: z.enum(['percentage', 'compound', 'category_based', 'product_based', 'exemption']),
  rate: z.number().min(0).max(100),
  compoundOrder: z.number().int().min(0).default(0),
  calculationStrategy: z.enum(['standard_percentage', 'indonesia_tax_2025', 'compound']).default('standard_percentage'),
  taxBaseModifier: z.string().nullable().default(null),
  applyTo: z.enum(['all', 'categories', 'products', 'exempt']).default('all'),
  categoryIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
  exemptProductIds: z.array(z.string()).default([]),
  exemptCustomerTags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
});

export const createTaxConfigurationSchema = z.object({
  taxEnabled: z.boolean().default(true),
  pricingMode: z.enum(['inclusive', 'exclusive']).default('exclusive'),
  countryCode: z.string().default('ID'),
  currency: z.string().default('IDR'),
  rules: z.array(taxRuleSchema).default([]),
});

export const updateTaxConfigurationSchema = z.object({
  taxEnabled: z.boolean().optional(),
  pricingMode: z.enum(['inclusive', 'exclusive']).optional(),
  countryCode: z.string().optional(),
  currency: z.string().optional(),
  rules: z.array(taxRuleSchema).optional(),
});

export const createTaxRuleSchema = taxRuleSchema;

export const updateTaxRuleSchema = taxRuleSchema.partial();

export const taxCalculateSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    productName: z.string().default(''),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    categoryId: z.string().default(''),
  })).min(1),
  discount: z.number().nonnegative().default(0),
  discountType: z.enum(['percentage', 'nominal']).default('nominal'),
  customerTags: z.array(z.string()).default([]),
});
