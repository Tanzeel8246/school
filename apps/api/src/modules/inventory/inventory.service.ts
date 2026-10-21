/**
 * Inventory service — multi-tenant, all queries scoped to actor.schoolId.
 * Money (unit_cost, total_amount) is BIGINT minor units throughout.
 * Soft-delete via deleted_at; all reads filter deleted_at IS NULL.
 * withTransaction for multi-step mutations (PO receive, stock out).
 */
import { query, withTransaction } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, conflict, unprocessable } from '../../utils/http-error.js';
import type {
  ListInventoryCategoriesQuery,
  CreateInventoryCategoryInput,
  UpdateInventoryCategoryInput,
  ListVendorsQuery,
  CreateVendorInput,
  UpdateVendorInput,
  ListInventoryItemsQuery,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  LowStockQuery,
  ListOrdersQuery,
  CreatePurchaseOrderInput,
  UpdatePoStatusInput,
  ListTransactionsQuery,
  StockOutInput,
  CreateStockTransactionInput,
} from './inventory.schema.js';

// ── Row types ──────────────────────────────────────────────────────────────

interface InvCategoryRow {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface VendorRow {
  id: string;
  school_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
}

interface InvItemRow {
  id: string;
  school_id: string;
  category_id: string | null;
  category_name: string | null;
  name: string;
  sku: string | null;
  unit: string;
  quantity_in_stock: number;
  reorder_level: number;
  unit_cost: string | number;
  location: string | null;
  created_at: string;
}

interface PurchaseOrderRow {
  id: string;
  school_id: string;
  vendor_id: string;
  vendor_name: string | null;
  po_no: string;
  order_date: string;
  expected_delivery: string | null;
  status: string;
  notes: string | null;
  total_amount: string | number;
  line_count: number;
  created_at: string;
}

interface PoLineRow {
  id: string;
  item_id: string;
  item_name: string | null;
  quantity: number;
  unit_cost: string | number;
  total: string | number;
}

interface StockTransactionRow {
  id: string;
  school_id: string;
  item_id: string;
  item_name: string | null;
  txn_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  performed_by: string | null;
  txn_at: string;
}

// ── DTO mappers ─────────────────────────────────────────────────────────────

const toInvCategoryDto = (r: InvCategoryRow) => ({
  id:          r.id,
  schoolId:    r.school_id,
  name:        r.name,
  description: r.description,
  createdAt:   r.created_at,
});

const toVendorDto = (r: VendorRow) => ({
  id:            r.id,
  schoolId:      r.school_id,
  name:          r.name,
  contactPerson: r.contact_person,
  phone:         r.phone,
  email:         r.email,
  address:       r.address,
  createdAt:     r.created_at,
});

const toInvItemDto = (r: InvItemRow) => ({
  id:              r.id,
  schoolId:        r.school_id,
  categoryId:      r.category_id,
  categoryName:    r.category_name,
  name:            r.name,
  sku:             r.sku,
  unit:            r.unit,
  quantityInStock: Number(r.quantity_in_stock),
  reorderLevel:    Number(r.reorder_level),
  unitCost:        Number(r.unit_cost),
  location:        r.location,
  isLowStock:      Number(r.quantity_in_stock) <= Number(r.reorder_level),
  createdAt:       r.created_at,
});

const toPoDto = (r: PurchaseOrderRow) => ({
  id:               r.id,
  schoolId:         r.school_id,
  vendorId:         r.vendor_id,
  vendorName:       r.vendor_name,
  poNo:             r.po_no,
  orderDate:        r.order_date,
  expectedDelivery: r.expected_delivery,
  status:           r.status,
  notes:            r.notes,
  totalAmount:      Number(r.total_amount),
  lineCount:        Number(r.line_count),
  createdAt:        r.created_at,
});

const toPoLineDto = (r: PoLineRow) => ({
  id:       r.id,
  itemId:   r.item_id,
  itemName: r.item_name,
  quantity: r.quantity,
  unitCost: Number(r.unit_cost),
  total:    Number(r.total),
});

const toStockTxnDto = (r: StockTransactionRow) => ({
  id:            r.id,
  schoolId:      r.school_id,
  itemId:        r.item_id,
  itemName:      r.item_name,
  txnType:       r.txn_type,
  quantity:      r.quantity,
  referenceType: r.reference_type,
  referenceId:   r.reference_id,
  notes:         r.notes,
  performedBy:   r.performed_by,
  txnAt:         r.txn_at,
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

export async function listInventoryCategories(
  actor: AccessClaims,
  q: ListInventoryCategoriesQuery,
) {
  const offset = (q.page - 1) * q.limit;
  const [dataRes, countRes] = await Promise.all([
    query<InvCategoryRow>(
      `SELECT id, school_id, name, description, created_at
         FROM inventory_categories
        WHERE school_id = $1 AND deleted_at IS NULL
        ORDER BY name
        LIMIT $2 OFFSET $3`,
      [actor.schoolId, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM inventory_categories
        WHERE school_id = $1 AND deleted_at IS NULL`,
      [actor.schoolId],
    ),
  ]);
  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toInvCategoryDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createInventoryCategory(
  actor: AccessClaims,
  input: CreateInventoryCategoryInput,
) {
  const { rows } = await query<InvCategoryRow>(
    `INSERT INTO inventory_categories (school_id, name, description)
     VALUES ($1,$2,$3)
     RETURNING id, school_id, name, description, created_at`,
    [actor.schoolId, input.name, input.description ?? null],
  ).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw conflict('A category with this name already exists');
    }
    throw err;
  });
  return toInvCategoryDto(rows[0]);
}

export async function updateInventoryCategory(
  actor: AccessClaims,
  id: string,
  input: UpdateInventoryCategoryInput,
) {
  const { rows: before } = await query<InvCategoryRow>(
    `SELECT id, school_id, name, description, created_at
       FROM inventory_categories WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Category not found');

  const { rows } = await query<InvCategoryRow>(
    `UPDATE inventory_categories
        SET name = COALESCE($3, name), description = COALESCE($4, description)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, name, description, created_at`,
    [id, actor.schoolId, input.name ?? null, input.description ?? null],
  );
  return { before: toInvCategoryDto(before[0]), after: toInvCategoryDto(rows[0]) };
}

export async function deleteInventoryCategory(actor: AccessClaims, id: string) {
  const { rows } = await query<InvCategoryRow>(
    `UPDATE inventory_categories SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, name, description, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Category not found');
  return toInvCategoryDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// VENDORS
// ═══════════════════════════════════════════════════════════════════════════

export async function listVendors(actor: AccessClaims, q: ListVendorsQuery) {
  const where: string[] = ['school_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`name ILIKE $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<VendorRow>(
      `SELECT id, school_id, name, contact_person, phone, email, address, created_at
         FROM vendors WHERE ${whereSql}
         ORDER BY name
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM vendors WHERE ${whereSql}`,
      params,
    ),
  ]);
  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toVendorDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createVendor(actor: AccessClaims, input: CreateVendorInput) {
  const { rows } = await query<VendorRow>(
    `INSERT INTO vendors (school_id, name, contact_person, phone, email, address)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, school_id, name, contact_person, phone, email, address, created_at`,
    [actor.schoolId, input.name, input.contactPerson ?? null, input.phone ?? null, input.email ?? null, input.address ?? null],
  );
  return toVendorDto(rows[0]);
}

export async function updateVendor(actor: AccessClaims, id: string, input: UpdateVendorInput) {
  const { rows: before } = await query<VendorRow>(
    `SELECT id, school_id, name, contact_person, phone, email, address, created_at
       FROM vendors WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Vendor not found');

  const { rows } = await query<VendorRow>(
    `UPDATE vendors
        SET name           = COALESCE($3, name),
            contact_person = COALESCE($4, contact_person),
            phone          = COALESCE($5, phone),
            email          = COALESCE($6, email),
            address        = COALESCE($7, address)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, name, contact_person, phone, email, address, created_at`,
    [id, actor.schoolId, input.name ?? null, input.contactPerson ?? null, input.phone ?? null, input.email ?? null, input.address ?? null],
  );
  return { before: toVendorDto(before[0]), after: toVendorDto(rows[0]) };
}

export async function deleteVendor(actor: AccessClaims, id: string) {
  const { rows } = await query<VendorRow>(
    `UPDATE vendors SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, name, contact_person, phone, email, address, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Vendor not found');
  return toVendorDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// INVENTORY ITEMS
// ═══════════════════════════════════════════════════════════════════════════

const ITEM_SELECT = `
  i.id, i.school_id, i.category_id, ic.name AS category_name,
  i.name, i.sku, i.unit, i.quantity_in_stock, i.reorder_level,
  i.unit_cost, i.location, i.created_at`;

export async function listInventoryItems(actor: AccessClaims, q: ListInventoryItemsQuery) {
  const where: string[] = ['i.school_id = $1', 'i.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`(i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length})`);
  }
  if (q.categoryId) {
    params.push(q.categoryId);
    where.push(`i.category_id = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<InvItemRow>(
      `SELECT ${ITEM_SELECT}
         FROM inventory_items i
         LEFT JOIN inventory_categories ic ON ic.id = i.category_id
        WHERE ${whereSql}
        ORDER BY i.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM inventory_items i WHERE ${whereSql}`,
      params,
    ),
  ]);
  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toInvItemDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createInventoryItem(actor: AccessClaims, input: CreateInventoryItemInput) {
  const { rows } = await query<InvItemRow>(
    `INSERT INTO inventory_items
       (school_id, category_id, name, sku, unit, quantity_in_stock, reorder_level, unit_cost, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, school_id, category_id, NULL::text AS category_name,
               name, sku, unit, quantity_in_stock, reorder_level, unit_cost, location, created_at`,
    [
      actor.schoolId, input.categoryId ?? null, input.name,
      input.sku ?? null, input.unit ?? 'pcs',
      input.quantityInStock ?? 0, input.reorderLevel ?? 10,
      input.unitCost ?? 0, input.location ?? null,
    ],
  );
  return toInvItemDto(rows[0]);
}

export async function updateInventoryItem(
  actor: AccessClaims,
  id: string,
  input: UpdateInventoryItemInput,
) {
  const { rows: before } = await query<InvItemRow>(
    `SELECT ${ITEM_SELECT}
       FROM inventory_items i
       LEFT JOIN inventory_categories ic ON ic.id = i.category_id
      WHERE i.id = $1 AND i.school_id = $2 AND i.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Item not found');

  const { rows } = await query<InvItemRow>(
    `UPDATE inventory_items
        SET category_id      = COALESCE($3, category_id),
            name             = COALESCE($4, name),
            sku              = COALESCE($5, sku),
            unit             = COALESCE($6, unit),
            reorder_level    = COALESCE($7, reorder_level),
            unit_cost        = COALESCE($8, unit_cost),
            location         = COALESCE($9, location)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, category_id, NULL::text AS category_name,
                name, sku, unit, quantity_in_stock, reorder_level, unit_cost, location, created_at`,
    [
      id, actor.schoolId,
      input.categoryId ?? null, input.name ?? null,
      input.sku ?? null, input.unit ?? null,
      input.reorderLevel ?? null, input.unitCost ?? null,
      input.location ?? null,
    ],
  );
  const after = { ...rows[0], category_name: before[0].category_name };
  return { before: toInvItemDto(before[0]), after: toInvItemDto(after) };
}

export async function deleteInventoryItem(actor: AccessClaims, id: string) {
  // Reject if quantity > 0 (items in stock must be cleared first).
  const { rows: itemRows } = await query<{ quantity_in_stock: number }>(
    `SELECT quantity_in_stock FROM inventory_items
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!itemRows[0]) throw notFound('Item not found');
  if (Number(itemRows[0].quantity_in_stock) > 0) {
    throw unprocessable('Cannot delete item with stock remaining. Adjust to zero first.');
  }

  const { rows } = await query<InvItemRow>(
    `UPDATE inventory_items SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, category_id, NULL::text AS category_name,
                name, sku, unit, quantity_in_stock, reorder_level, unit_cost, location, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Item not found');
  return toInvItemDto(rows[0]);
}

export async function getLowStockItems(actor: AccessClaims, q: LowStockQuery) {
  // Items where quantity_in_stock <= reorder_level, ordered by quantity ASC (most critical first).
  const offset = (q.page - 1) * q.limit;
  const [dataRes, countRes] = await Promise.all([
    query<InvItemRow>(
      `SELECT ${ITEM_SELECT}
         FROM inventory_items i
         LEFT JOIN inventory_categories ic ON ic.id = i.category_id
        WHERE i.school_id = $1 AND i.deleted_at IS NULL
          AND i.quantity_in_stock <= i.reorder_level
        ORDER BY i.quantity_in_stock ASC
        LIMIT $2 OFFSET $3`,
      [actor.schoolId, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM inventory_items i
        WHERE i.school_id = $1 AND i.deleted_at IS NULL
          AND i.quantity_in_stock <= i.reorder_level`,
      [actor.schoolId],
    ),
  ]);
  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toInvItemDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════════════

const PO_SELECT = `
  po.id, po.school_id, po.vendor_id, v.name AS vendor_name,
  po.po_no, po.order_date, po.expected_delivery, po.status, po.notes,
  po.total_amount,
  (SELECT count(*) FROM po_lines pl WHERE pl.po_id = po.id)::int AS line_count,
  po.created_at`;

/** Generate PO number: PO-{YYYY}-{seq 4-padded}. Multi-tenant safe. */
async function generatePoNo(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await query<{ cnt: string }>(
    `SELECT count(*)::int AS cnt FROM purchase_orders
      WHERE school_id = $1 AND EXTRACT(YEAR FROM order_date) = $2`,
    [schoolId, year],
  );
  const seq = (Number(rows[0]?.cnt ?? 0) + 1).toString().padStart(4, '0');
  return `PO-${year}-${seq}`;
}

export async function listPurchaseOrders(actor: AccessClaims, q: ListOrdersQuery) {
  const where: string[] = ['po.school_id = $1', 'po.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.status) {
    params.push(q.status);
    where.push(`po.status = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<PurchaseOrderRow>(
      `SELECT ${PO_SELECT}
         FROM purchase_orders po
         JOIN vendors v ON v.id = po.vendor_id
        WHERE ${whereSql}
        ORDER BY po.order_date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM purchase_orders po WHERE ${whereSql}`,
      params,
    ),
  ]);
  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toPoDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createPurchaseOrder(actor: AccessClaims, input: CreatePurchaseOrderInput) {
  return withTransaction(async (client) => {
    // Verify vendor belongs to this school.
    const { rows: vendorRows } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM vendors WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.vendorId, actor.schoolId],
    );
    if (!vendorRows[0]) throw notFound('Vendor not found');

    const poNo = input.poNo ?? await generatePoNo(actor.schoolId);

    // Compute total: sum of all line totals.
    let totalAmount = 0;
    const computedLines = input.lines.map((l) => ({
      ...l,
      total: l.quantity * l.unitCost,
    }));
    totalAmount = computedLines.reduce((sum, l) => sum + l.total, 0);

    const { rows: poRows } = await client.query<PurchaseOrderRow>(
      `INSERT INTO purchase_orders
         (school_id, vendor_id, po_no, expected_delivery, notes, total_amount, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7)
       RETURNING id, school_id, vendor_id, $8::text AS vendor_name,
                 po_no, order_date, expected_delivery, status, notes, total_amount, 0 AS line_count, created_at`,
      [
        actor.schoolId, input.vendorId, poNo,
        input.expectedDelivery ?? null, input.notes ?? null,
        totalAmount, actor.sub, vendorRows[0].name,
      ],
    ).catch((err: unknown) => {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw conflict('A PO with this number already exists');
      }
      throw err;
    });
    const po = poRows[0];

    // Insert po_lines.
    for (const line of computedLines) {
      await client.query(
        `INSERT INTO po_lines (po_id, item_id, quantity, unit_cost, total)
         VALUES ($1,$2,$3,$4,$5)`,
        [po.id, line.itemId, line.quantity, line.unitCost, line.total],
      );
    }

    return toPoDto({ ...po, line_count: computedLines.length });
  });
}

export async function getPurchaseOrderById(actor: AccessClaims, id: string) {
  const { rows } = await query<PurchaseOrderRow>(
    `SELECT ${PO_SELECT}
       FROM purchase_orders po JOIN vendors v ON v.id = po.vendor_id
      WHERE po.id = $1 AND po.school_id = $2 AND po.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Purchase order not found');

  const { rows: lines } = await query<PoLineRow>(
    `SELECT pl.id, pl.item_id, ii.name AS item_name, pl.quantity, pl.unit_cost, pl.total
       FROM po_lines pl JOIN inventory_items ii ON ii.id = pl.item_id
      WHERE pl.po_id = $1`,
    [id],
  );

  return { ...toPoDto(rows[0]), lines: lines.map(toPoLineDto) };
}

export async function updatePoStatus(
  actor: AccessClaims,
  id: string,
  input: UpdatePoStatusInput,
) {
  const { rows: before } = await query<{ id: string; status: string }>(
    `SELECT id, status FROM purchase_orders WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Purchase order not found');
  if (before[0].status === 'received') throw unprocessable('Received orders cannot be changed');
  if (before[0].status === 'cancelled') throw unprocessable('Order already cancelled');

  const { rows } = await query<PurchaseOrderRow>(
    `UPDATE purchase_orders SET status = $3
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, vendor_id, NULL::text AS vendor_name,
                po_no, order_date, expected_delivery, status, notes, total_amount, 0 AS line_count, created_at`,
    [id, actor.schoolId, input.status],
  );
  return toPoDto(rows[0]);
}

export async function receivePurchaseOrder(actor: AccessClaims, id: string) {
  // SET status='received'; for each line INSERT stock_transaction + UPDATE quantity. Transactional.
  return withTransaction(async (client) => {
    const { rows: poRows } = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM purchase_orders
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [id, actor.schoolId],
    );
    if (!poRows[0]) throw notFound('Purchase order not found');
    if (poRows[0].status === 'received') throw unprocessable('Order already received');
    if (poRows[0].status === 'cancelled') throw unprocessable('Cannot receive a cancelled order');

    // Fetch lines.
    const { rows: lines } = await client.query<{ item_id: string; quantity: number }>(
      `SELECT item_id, quantity FROM po_lines WHERE po_id = $1`,
      [id],
    );

    // SET PO status='received'.
    await client.query(
      `UPDATE purchase_orders SET status = 'received' WHERE id = $1`,
      [id],
    );

    // For each line: INSERT stock_transaction + UPDATE inventory_items.quantity_in_stock.
    for (const line of lines) {
      await client.query(
        `INSERT INTO stock_transactions
           (school_id, item_id, txn_type, quantity, reference_type, reference_id, performed_by)
         VALUES ($1,$2,'in',$3,'purchase_order',$4,$5)`,
        [actor.schoolId, line.item_id, line.quantity, id, actor.sub],
      );
      await client.query(
        `UPDATE inventory_items
            SET quantity_in_stock = quantity_in_stock + $2
          WHERE id = $1 AND school_id = $3`,
        [line.item_id, line.quantity, actor.schoolId],
      );
    }

    const { rows } = await client.query<PurchaseOrderRow>(
      `SELECT ${PO_SELECT}
         FROM purchase_orders po JOIN vendors v ON v.id = po.vendor_id
        WHERE po.id = $1`,
      [id],
    );
    return toPoDto(rows[0]);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STOCK TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listStockTransactions(actor: AccessClaims, q: ListTransactionsQuery) {
  const where: string[] = ['st.school_id = $1'];
  const params: unknown[] = [actor.schoolId];

  if (q.itemId) {
    params.push(q.itemId);
    where.push(`st.item_id = $${params.length}`);
  }
  if (q.txnType) {
    params.push(q.txnType);
    where.push(`st.txn_type = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<StockTransactionRow>(
      `SELECT st.id, st.school_id, st.item_id, ii.name AS item_name,
              st.txn_type, st.quantity, st.reference_type, st.reference_id,
              st.notes, st.performed_by, st.txn_at
         FROM stock_transactions st
         JOIN inventory_items ii ON ii.id = st.item_id
        WHERE ${whereSql}
        ORDER BY st.txn_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM stock_transactions st WHERE ${whereSql}`,
      params,
    ),
  ]);
  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toStockTxnDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function stockOut(actor: AccessClaims, input: StockOutInput) {
  // Validate quantity <= stock; INSERT transaction; DECREMENT. Transactional.
  return withTransaction(async (client) => {
    const { rows: itemRows } = await client.query<{ id: string; quantity_in_stock: number }>(
      `SELECT id, quantity_in_stock FROM inventory_items
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [input.itemId, actor.schoolId],
    );
    if (!itemRows[0]) throw notFound('Item not found');
    if (Number(itemRows[0].quantity_in_stock) < input.quantity) {
      throw unprocessable('Insufficient stock', {
        available: Number(itemRows[0].quantity_in_stock),
        requested: input.quantity,
      });
    }

    const { rows } = await client.query<StockTransactionRow>(
      `INSERT INTO stock_transactions
         (school_id, item_id, txn_type, quantity, reference_type, notes, performed_by)
       VALUES ($1,$2,'out',$3,'direct',$4,$5)
       RETURNING id, school_id, item_id, NULL::text AS item_name, txn_type, quantity,
                 reference_type, reference_id, notes, performed_by, txn_at`,
      [actor.schoolId, input.itemId, input.quantity, input.notes ?? null, actor.sub],
    );

    await client.query(
      `UPDATE inventory_items SET quantity_in_stock = quantity_in_stock - $2 WHERE id = $1`,
      [input.itemId, input.quantity],
    );

    return toStockTxnDto(rows[0]);
  });
}

export async function createStockTransaction(
  actor: AccessClaims,
  input: CreateStockTransactionInput,
) {
  // Generic adjustment: in=+qty, out=-qty, adjustment=+/- signed qty. Transactional.
  return withTransaction(async (client) => {
    const { rows: itemRows } = await client.query<{ id: string; quantity_in_stock: number }>(
      `SELECT id, quantity_in_stock FROM inventory_items
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [input.itemId, actor.schoolId],
    );
    if (!itemRows[0]) throw notFound('Item not found');

    const { rows } = await client.query<StockTransactionRow>(
      `INSERT INTO stock_transactions
         (school_id, item_id, txn_type, quantity, reference_type, notes, performed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, school_id, item_id, NULL::text AS item_name, txn_type, quantity,
                 reference_type, reference_id, notes, performed_by, txn_at`,
      [actor.schoolId, input.itemId, input.txnType, input.quantity,
       input.referenceType ?? null, input.notes ?? null, actor.sub],
    );

    // Determine stock delta based on txn_type.
    let delta = 0;
    if (input.txnType === 'in')         delta = Math.abs(input.quantity);
    else if (input.txnType === 'out')   delta = -Math.abs(input.quantity);
    else                                 delta = input.quantity; // adjustment: signed

    await client.query(
      `UPDATE inventory_items
          SET quantity_in_stock = GREATEST(0, quantity_in_stock + $2)
        WHERE id = $1`,
      [input.itemId, delta],
    );

    return toStockTxnDto(rows[0]);
  });
}
