import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './fees.service.js';

// ── Fee Heads ──────────────────────────────────────────────────────────────

export async function listFeeHeads(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listFeeHeads(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createFeeHead(req: Request, res: Response, next: NextFunction) {
  try {
    const feeHead = await service.createFeeHead(req.user!, req.body);
    await audit(req, 'fees.head.create', 'fee_head', feeHead.id, null, feeHead);
    res.status(201).json({ data: feeHead });
  } catch (e) { next(e); }
}

export async function updateFeeHead(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateFeeHead(req.user!, req.params.id, req.body);
    await audit(req, 'fees.head.update', 'fee_head', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteFeeHead(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteFeeHead(req.user!, req.params.id);
    await audit(req, 'fees.head.delete', 'fee_head', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Invoices ──────────────────────────────────────────────────────────────

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listInvoices(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await service.createInvoice(req.user!, req.body);
    await audit(req, 'fees.invoice.create', 'fee_invoice', invoice.id, null, invoice);
    res.status(201).json({ data: invoice });
  } catch (e) { next(e); }
}

export async function bulkGenerateInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.bulkGenerateInvoices(req.user!, req.body);
    await audit(req, 'fees.invoice.bulk_generate', 'fee_invoice', null, null, result);
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await service.getInvoiceById(req.user!, req.params.id);
    res.json({ data: invoice });
  } catch (e) { next(e); }
}

export async function waiveInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.waiveInvoice(req.user!, req.params.id, req.body);
    await audit(req, 'fees.invoice.waive', 'fee_invoice', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function payInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.payInvoice(req.user!, req.params.id, req.body);
    await audit(req, 'fees.pay', 'fee_invoice', req.params.id, null, result);
    res.json({ data: result });
  } catch (e) { next(e); }
}

// ── Discounts ─────────────────────────────────────────────────────────────

export async function listDiscounts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listDiscounts(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const discount = await service.createDiscount(req.user!, req.body);
    await audit(req, 'fees.discount.create', 'fee_discount', discount.id, null, discount);
    res.status(201).json({ data: discount });
  } catch (e) { next(e); }
}

export async function deleteDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteDiscount(req.user!, req.params.id);
    await audit(req, 'fees.discount.delete', 'fee_discount', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Reports ───────────────────────────────────────────────────────────────

export async function getDefaulters(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getDefaulters(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getCollectionReport(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getCollectionReport(req.user!, req.query as never);
    res.json({ data });
  } catch (e) { next(e); }
}
