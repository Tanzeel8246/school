import { z } from 'zod';

// ── Accounts ──────────────────────────────────────────────────────────────

export const createAccountSchema = z.object({
  code:     z.string().min(1).max(20),
  name:     z.string().min(1).max(120),
  type:     z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parentId: z.string().uuid().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  name:     z.string().min(1).max(120).optional(),
  parentId: z.string().uuid().optional().nullable(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const listAccountsQuerySchema = z.object({
  type:  z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']).optional(),
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(50),
});
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;

// ── Journal Entries ───────────────────────────────────────────────────────

const journalLineInputSchema = z.object({
  accountId:   z.string().uuid(),
  debit:       z.number().int().nonnegative().default(0),
  credit:      z.number().int().nonnegative().default(0),
  description: z.string().optional(),
}).refine(
  (l) => (l.debit > 0 || l.credit > 0) && !(l.debit > 0 && l.credit > 0),
  { message: 'Each line must have exactly one of debit or credit > 0' },
);

export const createJournalSchema = z.object({
  description: z.string().optional(),
  entryDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lines:       z.array(journalLineInputSchema).min(2),
}).refine(
  (b) => {
    const totalDebit  = b.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = b.lines.reduce((s, l) => s + l.credit, 0);
    return totalDebit === totalCredit;
  },
  { message: 'Journal entry must be balanced: SUM(debit) must equal SUM(credit)' },
);
export type CreateJournalInput = z.infer<typeof createJournalSchema>;

export const listJournalsQuerySchema = z.object({
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  accountId: z.string().uuid().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(1000).default(20),
});
export type ListJournalsQuery = z.infer<typeof listJournalsQuerySchema>;

// ── Reports ───────────────────────────────────────────────────────────────

/** Optional export format — same as reports module convention. */
const exportFormat = z.enum(['pdf', 'xlsx', 'csv']).optional();

export const trialBalanceQuerySchema = z.object({
  asOf:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: exportFormat,
});
export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;

export const plQuerySchema = z.object({
  from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: exportFormat,
});
export type PlQuery = z.infer<typeof plQuerySchema>;

export const balanceSheetQuerySchema = z.object({
  asOf:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: exportFormat,
});
export type BalanceSheetQuery = z.infer<typeof balanceSheetQuerySchema>;

export const cashBookQuerySchema = z.object({
  accountId: z.string().uuid().optional(),   // filter to one account; omit = all asset accounts
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format:    exportFormat,
});
export type CashBookQuery = z.infer<typeof cashBookQuerySchema>;

export const generalLedgerQuerySchema = z.object({
  accountId: z.string().uuid(),
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format:    exportFormat,
});
export type GeneralLedgerQuery = z.infer<typeof generalLedgerQuerySchema>;
