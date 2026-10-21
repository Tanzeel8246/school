/**
 * Accounting router — double-entry bookkeeping, multi-tenant.
 * Literal paths (trial-balance, pl, balance-sheet) declared BEFORE /:id
 * so Express resolves them first (blueprint §routing).
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createAccountSchema,
  updateAccountSchema,
  listAccountsQuerySchema,
  createJournalSchema,
  listJournalsQuerySchema,
  trialBalanceQuerySchema,
  plQuerySchema,
  balanceSheetQuerySchema,
  cashBookQuerySchema,
  generalLedgerQuerySchema,
} from './accounting.schema.js';
import * as ctrl from './accounting.controller.js';

export const accountingRouter = Router();
accountingRouter.use(authenticate);

// ── Accounts ──────────────────────────────────────────────────────────────
accountingRouter.get('/accounts', requirePermission('accounting:read'), validate(listAccountsQuerySchema, 'query'), ctrl.listAccounts);
accountingRouter.post('/accounts', requirePermission('accounting:post'), validate(createAccountSchema), ctrl.createAccount);
accountingRouter.patch('/accounts/:id', requirePermission('accounting:post'), validate(updateAccountSchema), ctrl.updateAccount);
accountingRouter.delete('/accounts/:id', requirePermission('accounting:post'), ctrl.deleteAccount);

// ── Journal Entries — literal paths first ─────────────────────────────────
accountingRouter.get('/journals', requirePermission('accounting:read'), validate(listJournalsQuerySchema, 'query'), ctrl.listJournals);
accountingRouter.post('/journals', requirePermission('accounting:post'), validate(createJournalSchema), ctrl.createJournal);
accountingRouter.get('/journals/:id', requirePermission('accounting:read'), ctrl.getJournal);
// DELETE marks as reversed (soft-delete); no balance re-adjustment here.
accountingRouter.delete('/journals/:id', requirePermission('accounting:post'), ctrl.reverseJournal);

// ── Reports — literal paths declared before dynamic segments ──────────────
// All four report endpoints accept ?format=pdf|xlsx|csv to stream a file export
// instead of JSON (reuses reports.export.ts streaming helpers).
accountingRouter.get('/reports/trial-balance', requirePermission('accounting:read'), validate(trialBalanceQuerySchema, 'query'), ctrl.getTrialBalance);
accountingRouter.get('/reports/pl',            requirePermission('accounting:read'), validate(plQuerySchema,           'query'), ctrl.getPLReport);
accountingRouter.get('/reports/balance-sheet', requirePermission('accounting:read'), validate(balanceSheetQuerySchema, 'query'), ctrl.getBalanceSheet);
accountingRouter.get('/reports/cash-book',     requirePermission('accounting:read'), validate(cashBookQuerySchema,     'query'), ctrl.getCashBook);
accountingRouter.get('/reports/general-ledger', requirePermission('accounting:read'), validate(generalLedgerQuerySchema, 'query'), ctrl.getGeneralLedger);
