import { z } from 'zod';

// ── Categories ─────────────────────────────────────────────────────────────

export const createInventoryCategorySchema = z.object({
  name:        z.string().min(1).max(120),
  description: z.string().optional(),
});
export type CreateInventoryCategoryInput = z.infer<typeof createInventoryCategorySchema>;

export const updateInventoryCategorySchema = createInventoryCategorySchema.partial();
export type UpdateInventoryCategoryInput = z.infer<typeof updateInventoryCategorySchema>;

export const listInventoryCategoriesQuerySchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
});
export type ListInventoryCategoriesQuery = z.infer<typeof listInventoryCategoriesQuerySchema>;

// ── Vendors ────────────────────────────────────────────────────────────────

export const createVendorSchema = z.object({
  name:          z.string().min(1).max(150),
  contactPerson: z.string().optional(),
  phone:         z.string().optional(),
  email:         z.string().email().optional(),
  address:       z.string().optional(),
});
export type CreateVendorInput = z.infer<typeof createVendorSchema>;

export const updateVendorSchema = createVendorSchema.partial();
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

export const listVendorsQuerySchema = z.object({
  q:     z.string().optional(),
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
});
export type ListVendorsQuery = z.infer<typeof listVendorsQuerySchema>;

// ── Items ──────────────────────────────────────────────────────────────────

export const createInventoryItemSchema = z.object({
  name:             z.string().min(1).max(200),
  categoryId:       z.string().uuid().optional(),
  sku:              z.string().optional(),
  unit:             z.enum(['pcs', 'kg', 'ltr', 'box', 'ream', 'set', 'pair']).optional().default('pcs'),
  quantityInStock:  z.number().int().nonnegative().optional().default(0),
  reorderLevel:     z.number().int().nonnegative().optional().default(10),
  unitCost:         z.number().int().nonnegative().optional().default(0),
  location:         z.string().optional(),
});
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = createInventoryItemSchema.partial();
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

export const listInventoryItemsQuerySchema = z.object({
  q:          z.string().optional(),
  categoryId: z.string().uuid().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(1000).default(20),
});
export type ListInventoryItemsQuery = z.infer<typeof listInventoryItemsQuerySchema>;

export const lowStockQuerySchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
});
export type LowStockQuery = z.infer<typeof lowStockQuerySchema>;

// ── Purchase Orders ────────────────────────────────────────────────────────

export const poLineSchema = z.object({
  itemId:   z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().int().nonnegative(),
});
export type PoLineInput = z.infer<typeof poLineSchema>;

export const createPurchaseOrderSchema = z.object({
  vendorId:          z.string().uuid(),
  poNo:              z.string().optional(),
  expectedDelivery:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:             z.string().optional(),
  lines:             z.array(poLineSchema).min(1),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const updatePoStatusSchema = z.object({
  status: z.enum(['ordered', 'cancelled']),
});
export type UpdatePoStatusInput = z.infer<typeof updatePoStatusSchema>;

export const listOrdersQuerySchema = z.object({
  status: z.enum(['draft', 'ordered', 'received', 'cancelled']).optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(1000).default(20),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// ── Stock Transactions ─────────────────────────────────────────────────────

export const stockOutSchema = z.object({
  itemId:   z.string().uuid(),
  quantity: z.number().int().positive(),
  notes:    z.string().optional(),
});
export type StockOutInput = z.infer<typeof stockOutSchema>;

export const createStockTransactionSchema = z.object({
  itemId:        z.string().uuid(),
  txnType:       z.enum(['in', 'out', 'adjustment']),
  quantity:      z.number().int(),
  notes:         z.string().optional(),
  referenceType: z.string().optional(),
});
export type CreateStockTransactionInput = z.infer<typeof createStockTransactionSchema>;

export const listTransactionsQuerySchema = z.object({
  itemId:  z.string().uuid().optional(),
  txnType: z.enum(['in', 'out', 'adjustment']).optional(),
  page:    z.coerce.number().int().positive().default(1),
  limit:   z.coerce.number().int().positive().max(1000).default(20),
});
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
