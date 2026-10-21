import { z } from 'zod';

// ── Salary Structures ─────────────────────────────────────────────────────

const salaryComponentSchema = z.object({
  name:          z.string().min(1).max(100),
  componentType: z.enum(['allowance', 'deduction']),
  amount:        z.number().int().nonnegative(),
  isPercentage:  z.boolean().optional().default(false),
});
export type SalaryComponentInput = z.infer<typeof salaryComponentSchema>;

export const createStructureSchema = z.object({
  staffId:       z.string().uuid(),
  name:          z.string().min(1).max(120),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  components:    z.array(salaryComponentSchema).min(1),
});
export type CreateStructureInput = z.infer<typeof createStructureSchema>;

export const updateStructureSchema = z.object({
  name:          z.string().min(1).max(120).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  components:    z.array(salaryComponentSchema).min(1).optional(),
});
export type UpdateStructureInput = z.infer<typeof updateStructureSchema>;

export const listStructuresQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
  page:    z.coerce.number().int().positive().default(1),
  limit:   z.coerce.number().int().positive().max(1000).default(20),
});
export type ListStructuresQuery = z.infer<typeof listStructuresQuerySchema>;

// ── Payslips ──────────────────────────────────────────────────────────────

export const listPayslipsQuerySchema = z.object({
  period:  z.string().regex(/^\d{4}-\d{2}$/).optional(),
  staffId: z.string().uuid().optional(),
  status:  z.enum(['draft', 'final']).optional(),
  page:    z.coerce.number().int().positive().default(1),
  limit:   z.coerce.number().int().positive().max(1000).default(20),
});
export type ListPayslipsQuery = z.infer<typeof listPayslipsQuerySchema>;

// ── Payroll Run ───────────────────────────────────────────────────────────

export const runPayrollSchema = z.object({
  period:      z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM'),
  bonusAmount: z.number().int().nonnegative().optional().default(0),
});
export type RunPayrollInput = z.infer<typeof runPayrollSchema>;
