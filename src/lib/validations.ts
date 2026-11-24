import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidField = z.string().regex(uuidRegex, { message: 'Must be a valid UUID' });

/**
 * 1. Billing API Schemas
 */
export const BillingItemSchema = z.object({
  product_id: uuidField,
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(10000, 'Quantity cannot exceed 10,000 units per line'),
  unit_price: z
    .number()
    .min(0, 'Unit price cannot be negative')
    .max(10000000, 'Unit price exceeds limit')
    .optional(),
});

export const BillingPayloadSchema = z.object({
  shop_id: uuidField,
  user_id: z.string().max(100).optional(),
  items: z
    .array(BillingItemSchema)
    .min(1, 'At least 1 item is required')
    .max(200, 'Maximum 200 items allowed per bill'),
  subtotal: z.number().min(0).max(100000000).optional(),
  tax: z.number().min(0).max(10000000).optional(),
  discount: z.number().min(0).max(10000000).optional(),
  final_total: z.number().min(0).max(100000000).optional(),
  idempotency_key: z.string().min(1).max(255).optional(),
  customer_name: z.string().max(100).optional(),
  customer_phone: z.string().max(30).optional(),
});

export type BillingPayload = z.infer<typeof BillingPayloadSchema>;

/**
 * 2. AI Chat Endpoint Schemas
 */
export const AIChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .min(1, 'Message content cannot be empty')
    .max(2000, 'Message content cannot exceed 2,000 characters'),
});

export const AIChatPayloadSchema = z.object({
  messages: z
    .array(AIChatMessageSchema)
    .min(1, 'At least one message is required')
    .max(30, 'Conversation history cannot exceed 30 messages per request'),
  context: z
    .object({
      customerLat: z.number().min(-90).max(90).optional(),
      customerLon: z.number().min(-180).max(180).optional(),
      radiusKm: z.number().min(0.5).max(100).optional(),
    })
    .optional(),
});

export type AIChatPayload = z.infer<typeof AIChatPayloadSchema>;

/**
 * 3. Shopkeeper Insights Schemas
 */
export const ShopkeeperInsightsPayloadSchema = z.object({
  shopId: uuidField,
});

export type ShopkeeperInsightsPayload = z.infer<typeof ShopkeeperInsightsPayloadSchema>;

/**
 * 4. Product Search Endpoint Schemas
 */
export const ProductSearchQuerySchema = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(100).optional(),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val !== 'false'),
  sortBy: z.enum(['relevance', 'distance', 'price_low', 'price_high']).optional(),
});

export type ProductSearchQuery = z.infer<typeof ProductSearchQuerySchema>;
