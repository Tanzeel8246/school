/**
 * Reports module — Zod query-param schemas for all five report types.
 * format=pdf|xlsx|csv triggers file export on the same /:type route.
 */
import { z } from 'zod';

// ── Shared base ────────────────────────────────────────────────────────────

/** Export format — when present the route streams a file instead of JSON. */
export const exportFormatSchema = z.enum(['pdf', 'xlsx', 'csv']).optional();

/** All report types recognised by the router. */
export const reportTypeSchema = z.enum([
  'students',
  'attendance',
  'fees',
  'payroll',
  'accounting',
]);
export type ReportType = z.infer<typeof reportTypeSchema>;

/** Base pagination (excluded for accounting which returns monthly rows). */
const basePaginationSchema = z.object({
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(500).default(50),
  format: exportFormatSchema,
});

// ── Per-type query schemas ─────────────────────────────────────────────────

export const studentsQuerySchema = basePaginationSchema.extend({
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  status:    z.string().optional(),
  sectionId: z.string().uuid().optional(),
});
export type StudentsQuery = z.infer<typeof studentsQuerySchema>;

export const attendanceQuerySchema = basePaginationSchema.extend({
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sectionId: z.string().uuid().optional(),
});
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

export const feesQuerySchema = basePaginationSchema.extend({
  from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['unpaid', 'partial', 'paid', 'overdue', 'waived']).optional(),
});
export type FeesQuery = z.infer<typeof feesQuerySchema>;

export const payrollQuerySchema = basePaginationSchema.extend({
  period:    z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM').optional(),
  staffType: z.string().optional(),
});
export type PayrollQuery = z.infer<typeof payrollQuerySchema>;

export const accountingQuerySchema = z.object({
  from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: exportFormatSchema,
});
export type AccountingQuery = z.infer<typeof accountingQuerySchema>;

/**
 * Union schema used by validate() middleware on the /:type route.
 * All fields from every type are merged as optional so a single Zod parse
 * can coerce page/limit/format regardless of type. Type-specific service
 * functions then re-use the validated values.
 */
export const reportQuerySchema = z.object({
  // pagination
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(500).default(50),
  // export
  format:    exportFormatSchema,
  // students + attendance
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sectionId: z.string().uuid().optional(),
  // students
  status:    z.string().optional(),
  // payroll
  period:    z.string().regex(/^\d{4}-\d{2}$/).optional(),
  staffType: z.string().optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
