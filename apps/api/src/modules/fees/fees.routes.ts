/**
 * Fees router — all routes require authentication.
 * Literal paths (bulk-generate, defaulters, collection-report) declared BEFORE /:id
 * so Express resolves them first (blueprint §routing).
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createFeeHeadSchema,
  updateFeeHeadSchema,
  listFeeHeadsQuerySchema,
  createInvoiceSchema,
  bulkGenerateSchema,
  listInvoicesQuerySchema,
  waiveInvoiceSchema,
  payInvoiceSchema,
  createDiscountSchema,
  listDiscountsQuerySchema,
  defaultersQuerySchema,
  collectionReportQuerySchema,
} from './fees.schema.js';
import * as ctrl from './fees.controller.js';

export const feesRouter = Router();
feesRouter.use(authenticate);

// ── Fee Heads ──────────────────────────────────────────────────────────────
feesRouter.get('/heads', requirePermission('fees:read'), validate(listFeeHeadsQuerySchema, 'query'), ctrl.listFeeHeads);
feesRouter.post('/heads', requirePermission('fees:write'), validate(createFeeHeadSchema), ctrl.createFeeHead);
feesRouter.patch('/heads/:id', requirePermission('fees:write'), validate(updateFeeHeadSchema), ctrl.updateFeeHead);
feesRouter.delete('/heads/:id', requirePermission('fees:write'), ctrl.deleteFeeHead);

// ── Invoices — literal paths first ────────────────────────────────────────
feesRouter.get('/invoices', requirePermission('fees:read'), validate(listInvoicesQuerySchema, 'query'), ctrl.listInvoices);
feesRouter.post('/invoices', requirePermission('fees:write'), validate(createInvoiceSchema), ctrl.createInvoice);

// /invoices/bulk-generate must be declared BEFORE /invoices/:id
feesRouter.post('/invoices/bulk-generate', requirePermission('fees:write'), validate(bulkGenerateSchema), ctrl.bulkGenerateInvoices);

feesRouter.get('/invoices/:id', requirePermission('fees:read'), ctrl.getInvoice);
feesRouter.patch('/invoices/:id/waive', requirePermission('fees:write'), validate(waiveInvoiceSchema), ctrl.waiveInvoice);
feesRouter.post('/invoices/:id/pay', requirePermission('fees:collect'), validate(payInvoiceSchema), ctrl.payInvoice);

// ── Discounts ─────────────────────────────────────────────────────────────
feesRouter.get('/discounts', requirePermission('fees:read'), validate(listDiscountsQuerySchema, 'query'), ctrl.listDiscounts);
feesRouter.post('/discounts', requirePermission('fees:write'), validate(createDiscountSchema), ctrl.createDiscount);
feesRouter.delete('/discounts/:id', requirePermission('fees:write'), ctrl.deleteDiscount);

// ── Reports — literal paths declared before any /:id in parent router ─────
feesRouter.get('/defaulters', requirePermission('fees:read'), validate(defaultersQuerySchema, 'query'), ctrl.getDefaulters);
feesRouter.get('/collection-report', requirePermission('fees:read'), validate(collectionReportQuerySchema, 'query'), ctrl.getCollectionReport);
