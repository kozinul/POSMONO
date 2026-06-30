import { z } from 'zod';

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable(),
  quantity: z.number().int().positive(),
  modifiers: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })).optional().default([]),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Order must have at least 1 item'),
  customerId: z.string().nullable().optional(),
  notes: z.string().optional().default(''),
  source: z.enum(['pos', 'waiter', 'online']),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
