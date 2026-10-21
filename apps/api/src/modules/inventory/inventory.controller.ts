import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './inventory.service.js';

// ── Categories ─────────────────────────────────────────────────────────────

export async function listInventoryCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listInventoryCategories(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createInventoryCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const cat = await service.createInventoryCategory(req.user!, req.body);
    await audit(req, 'inventory.category.create', 'inventory_category', cat.id, null, cat);
    res.status(201).json({ data: cat });
  } catch (e) { next(e); }
}

export async function updateInventoryCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateInventoryCategory(req.user!, req.params.id, req.body);
    await audit(req, 'inventory.category.update', 'inventory_category', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteInventoryCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteInventoryCategory(req.user!, req.params.id);
    await audit(req, 'inventory.category.delete', 'inventory_category', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Vendors ────────────────────────────────────────────────────────────────

export async function listVendors(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listVendors(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const vendor = await service.createVendor(req.user!, req.body);
    await audit(req, 'inventory.vendor.create', 'vendor', vendor.id, null, vendor);
    res.status(201).json({ data: vendor });
  } catch (e) { next(e); }
}

export async function updateVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateVendor(req.user!, req.params.id, req.body);
    await audit(req, 'inventory.vendor.update', 'vendor', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteVendor(req.user!, req.params.id);
    await audit(req, 'inventory.vendor.delete', 'vendor', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Items ──────────────────────────────────────────────────────────────────

export async function listInventoryItems(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listInventoryItems(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createInventoryItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await service.createInventoryItem(req.user!, req.body);
    await audit(req, 'inventory.item.create', 'inventory_item', item.id, null, item);
    res.status(201).json({ data: item });
  } catch (e) { next(e); }
}

export async function updateInventoryItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateInventoryItem(req.user!, req.params.id, req.body);
    await audit(req, 'inventory.item.update', 'inventory_item', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteInventoryItem(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteInventoryItem(req.user!, req.params.id);
    await audit(req, 'inventory.item.delete', 'inventory_item', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

export async function getLowStockItems(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getLowStockItems(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

// ── Purchase Orders ────────────────────────────────────────────────────────

export async function listPurchaseOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listPurchaseOrders(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createPurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const po = await service.createPurchaseOrder(req.user!, req.body);
    await audit(req, 'inventory.po.create', 'purchase_order', po.id, null, po);
    res.status(201).json({ data: po });
  } catch (e) { next(e); }
}

export async function getPurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const po = await service.getPurchaseOrderById(req.user!, req.params.id);
    res.json({ data: po });
  } catch (e) { next(e); }
}

export async function updatePoStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const po = await service.updatePoStatus(req.user!, req.params.id, req.body);
    await audit(req, 'inventory.po.status_update', 'purchase_order', po.id, null, po);
    res.json({ data: po });
  } catch (e) { next(e); }
}

export async function receivePurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const po = await service.receivePurchaseOrder(req.user!, req.params.id);
    await audit(req, 'inventory.po_receive', 'purchase_order', po.id, null, po);
    res.json({ data: po });
  } catch (e) { next(e); }
}

// ── Stock Transactions ─────────────────────────────────────────────────────

export async function listStockTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listStockTransactions(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function stockOut(req: Request, res: Response, next: NextFunction) {
  try {
    const txn = await service.stockOut(req.user!, req.body);
    await audit(req, 'inventory.stock_out', 'stock_transaction', txn.id, null, txn);
    res.status(201).json({ data: txn });
  } catch (e) { next(e); }
}

export async function createStockTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const txn = await service.createStockTransaction(req.user!, req.body);
    await audit(req, 'inventory.stock_adjustment', 'stock_transaction', txn.id, null, txn);
    res.status(201).json({ data: txn });
  } catch (e) { next(e); }
}
