import { z } from 'zod';

// ── Fee Heads ──────────────────────────────────────────────────────────────

export const createFeeHeadSchema = z.object({
  name:          z.string().min(1).max(120),
  amount:        z.number().int().nonnegative(),
  isRecurring:   z.boolean().optional().default(true),
  applicableTo:  z.string().optional().default('all'),
  displayOrder:  z.number().int().nonnegative().optional().default(0),
});
export type CreateFeeHeadInput = z.infer<typeof createFeeHeadSchema>;

export const updateFeeHeadSchema = createFeeHeadSchema.partial();
export type UpdateFeeHeadInput = z.infer<typeof updateFeeHeadSchema>;

export const listFeeHeadsQuerySchema = z.object({
  q:     z.string().optional(),
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
});
export type ListFeeHeadsQuery = z.infer<typeof listFeeHeadsQuerySchema>;

// ── Invoices ──────────────────────────────────────────────────────────────

export const createInvoiceSchema = z.object({
  studentId:    z.string().uuid(),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM'),
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  feeHeadIds:   z.array(z.string().uuid()).min(1),
  discount:     z.number().int().nonnegative().optional().default(0),
  fine:         z.number().int().nonnegative().optional().default(0),
  notes:        z.string().optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const bulkGenerateSchema = z.object({
  classId:      z.string().uuid(),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM'),
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  feeHeadIds:   z.array(z.string().uuid()).min(1),
});
export type BulkGenerateInput = z.infer<typeof bulkGenerateSchema>;

export const listInvoicesQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  status:    z.enum(['unpaid','partial','paid','overdue','waived']).optional(),
  month:     z.string().regex(/^\d{4}-\d{2}$/).optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(1000).default(20),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

export const waiveInvoiceSchema = z.object({
  reason: z.string().optional(),
});
export type WaiveInvoiceInput = z.infer<typeof waiveInvoiceSchema>;

export const payInvoiceSchema = z.object({
  amount:      z.number().int().positive(),
  method:      z.enum(['cash', 'bank', 'online']),
  referenceNo: z.string().optional(),
});
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;

// ── Discounts ─────────────────────────────────────────────────────────────

export const createDiscountSchema = z.object({
  studentId:    z.string().uuid(),
  name:         z.string().min(1).max(120),
  discountType: z.enum(['percentage', 'fixed']),
  value:        z.number().int().positive(),
  appliedMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  reason:       z.string().optional(),
});
export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;

export const listDiscountsQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(1000).default(20),
});
export type ListDiscountsQuery = z.infer<typeof listDiscountsQuerySchema>;

// ── Reports ───────────────────────────────────────────────────────────────

export const defaultersQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  page:    z.coerce.number().int().positive().default(1),
  limit:   z.coerce.number().int().positive().max(1000).default(20),
});
export type DefaultersQuery = z.infer<typeof defaultersQuerySchema>;

export const collectionReportQuerySchema = z.object({
  period:  z.string().regex(/^\d{4}-\d{2}$/).optional(),
  groupBy: z.enum(['day', 'month']).default('day'),
});
export type CollectionReportQuery = z.infer<typeof collectionReportQuerySchema>;
