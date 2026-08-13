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
  taxRate: z.number().min(0).max(1).optional(),
  taxName: z.string().optional(),
  ppnEnabled: z.boolean().optional(),
  ppnRate: z.number().min(0).max(1).optional(),
  serviceChargeEnabled: z.boolean().optional(),
  serviceChargeRate: z.number().min(0).max(1).optional(),
  serviceChargeName: z.string().optional(),
  discountMaxPercent: z.number().min(0).max(100).optional(),
  discountMaxNominal: z.number().min(0).optional(),
  receiptFooter: z.string().optional(),
  receiptLogo: z.string().optional(),
  roundingEnabled: z.boolean().optional(),
  roundingMode: z.enum(['nearest', 'up', 'down']).optional(),
  roundingDenomination: z.union([z.literal(0), z.literal(100), z.literal(500), z.literal(1000)]).optional(),
}).refine(
  (cfg) => {
    if (cfg.roundingEnabled === true) {
      return cfg.roundingMode !== undefined && cfg.roundingDenomination !== undefined && cfg.roundingDenomination > 0;
    }
    return true;
  },
  { message: 'roundingMode dan roundingDenomination wajib saat roundingEnabled' },
);

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
