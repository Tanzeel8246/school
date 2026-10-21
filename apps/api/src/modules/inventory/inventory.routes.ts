/**
 * Inventory router — all routes require authentication.
 * Literal paths (/low-stock, /orders, /transactions, /stock-out) declared
 * BEFORE /:id routes (blueprint §routing).
 * Permissions: inventory:read, inventory:write, inventory:manage.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listInventoryCategoriesQuerySchema,
  createInventoryCategorySchema,
  updateInventoryCategorySchema,
  listVendorsQuerySchema,
  createVendorSchema,
  updateVendorSchema,
  listInventoryItemsQuerySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  lowStockQuerySchema,
  listOrdersQuerySchema,
  createPurchaseOrderSchema,
  updatePoStatusSchema,
  listTransactionsQuerySchema,
  stockOutSchema,
  createStockTransactionSchema,
} from './inventory.schema.js';
import * as ctrl from './inventory.controller.js';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

// ── Categories ─────────────────────────────────────────────────────────────
inventoryRouter.get('/categories', requirePermission('inventory:read'), validate(listInventoryCategoriesQuerySchema, 'query'), ctrl.listInventoryCategories);
inventoryRouter.post('/categories', requirePermission('inventory:write'), validate(createInventoryCategorySchema), ctrl.createInventoryCategory);
inventoryRouter.patch('/categories/:id', requirePermission('inventory:write'), validate(updateInventoryCategorySchema), ctrl.updateInventoryCategory);
inventoryRouter.delete('/categories/:id', requirePermission('inventory:write'), ctrl.deleteInventoryCategory);

// ── Vendors ────────────────────────────────────────────────────────────────
inventoryRouter.get('/vendors', requirePermission('inventory:read'), validate(listVendorsQuerySchema, 'query'), ctrl.listVendors);
inventoryRouter.post('/vendors', requirePermission('inventory:write'), validate(createVendorSchema), ctrl.createVendor);
inventoryRouter.patch('/vendors/:id', requirePermission('inventory:write'), validate(updateVendorSchema), ctrl.updateVendor);
inventoryRouter.delete('/vendors/:id', requirePermission('inventory:write'), ctrl.deleteVendor);

// ── Literal paths BEFORE /:id ──────────────────────────────────────────────

// Low stock (before /items/:id)
inventoryRouter.get('/low-stock', requirePermission('inventory:read'), validate(lowStockQuerySchema, 'query'), ctrl.getLowStockItems);

// Purchase orders
inventoryRouter.get('/orders', requirePermission('inventory:manage'), validate(listOrdersQuerySchema, 'query'), ctrl.listPurchaseOrders);
inventoryRouter.post('/orders', requirePermission('inventory:manage'), validate(createPurchaseOrderSchema), ctrl.createPurchaseOrder);
inventoryRouter.get('/orders/:id', requirePermission('inventory:manage'), ctrl.getPurchaseOrder);
inventoryRouter.patch('/orders/:id/status', requirePermission('inventory:manage'), validate(updatePoStatusSchema), ctrl.updatePoStatus);
inventoryRouter.patch('/orders/:id/receive', requirePermission('inventory:manage'), ctrl.receivePurchaseOrder);

// Stock transactions
inventoryRouter.get('/transactions', requirePermission('inventory:read'), validate(listTransactionsQuerySchema, 'query'), ctrl.listStockTransactions);
inventoryRouter.post('/transactions', requirePermission('inventory:manage'), validate(createStockTransactionSchema), ctrl.createStockTransaction);

// Stock out (direct)
inventoryRouter.post('/stock-out', requirePermission('inventory:write'), validate(stockOutSchema), ctrl.stockOut);

// ── Items CRUD ─────────────────────────────────────────────────────────────
inventoryRouter.get('/items', requirePermission('inventory:read'), validate(listInventoryItemsQuerySchema, 'query'), ctrl.listInventoryItems);
inventoryRouter.post('/items', requirePermission('inventory:write'), validate(createInventoryItemSchema), ctrl.createInventoryItem);
inventoryRouter.patch('/items/:id', requirePermission('inventory:write'), validate(updateInventoryItemSchema), ctrl.updateInventoryItem);
inventoryRouter.delete('/items/:id', requirePermission('inventory:write'), ctrl.deleteInventoryItem);
