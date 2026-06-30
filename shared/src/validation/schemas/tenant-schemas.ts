import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Tenant name must be at least 2 characters'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric'),
  businessType: z.enum(['retail', 'restaurant', 'hospitality', 'mixed']),
  config: z.object({
    timezone: z.string().default('Asia/Jakarta'),
    currency: z.string().default('IDR'),
    locale: z.string().default('id'),
  }).optional().default({}),
});

export const updateTenantConfigSchema = z.object({
  timezone: z.string().optional(),
  currency: z.string().optional(),
  locale: z.string().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
