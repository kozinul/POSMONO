import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional().default(''),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  categoryId: z.string().min(1, 'Category is required'),
  basePrice: z.number().positive('Price must be positive'),
  pricingProfileId: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
