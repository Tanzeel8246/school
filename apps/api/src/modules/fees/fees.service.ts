/**
 * Fees service — multi-tenant, all queries scoped to actor.schoolId.
 * Money is BIGINT minor units (paisa) throughout; never floats.
 * Soft-delete via deleted_at; all reads filter deleted_at IS NULL.
 * withTransaction used for any multi-statement mutation (transactional integrity).
 */
import { query, withTransaction } from '../../config/db.js';
import type { PoolClient } from 'pg';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, conflict, unprocessable } from '../../utils/http-error.js';
import type {
  ListFeeHeadsQuery,
  CreateFeeHeadInput,
  UpdateFeeHeadInput,
  CreateInvoiceInput,
  BulkGenerateInput,
  ListInvoicesQuery,
  WaiveInvoiceInput,
  PayInvoiceInput,
  CreateDiscountInput,
  ListDiscountsQuery,
  DefaultersQuery,
  CollectionReportQuery,
} from './fees.schema.js';

// ── Row types ──────────────────────────────────────────────────────────────

interface FeeHeadRow {
  id: string;
  school_id: string;
  name: string;
  amount: string | number;
  is_recurring: boolean;
  applicable_to: string;
  display_order: number;
  deleted_at: string | null;
}

interface InvoiceRow {
  id: string;
  school_id: string;
  student_id: string;
  student_name: string | null;
  challan_no: string;
  billing_month: string | null;
  subtotal: string | number;
  discount: string | number;
  fine: string | number;
  total: string | number;
  paid: string | number;
  due_date: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface InvoiceLineRow {
  id: string;
  fee_head_id: string;
  fee_head_name: string;
  amount: string | number;
}

interface PaymentRow {
  id: string;
  amount: string | number;
  method: string;
  reference_no: string | null;
  paid_at: string;
}

interface DiscountRow {
  id: string;
  school_id: string;
  student_id: string;
  student_name: string | null;
  name: string;
  discount_type: string;
  value: string | number;
  applied_month: string | null;
  reason: string | null;
  created_at: string;
}

// ── DTO mappers (snake_case row → camelCase DTO) ───────────────────────────

const toFeeHeadDto = (r: FeeHeadRow) => ({
  id:           r.id,
  schoolId:     r.school_id,
  name:         r.name,
  amount:       Number(r.amount),
  isRecurring:  r.is_recurring,
  applicableTo: r.applicable_to,
  displayOrder: r.display_order,
  deletedAt:    r.deleted_at ?? undefined,
});

const toInvoiceDto = (r: InvoiceRow, lines?: InvoiceLineRow[], payments?: PaymentRow[]) => ({
  id:           r.id,
  schoolId:     r.school_id,
  studentId:    r.student_id,
  studentName:  r.student_name,
  challanNo:    r.challan_no,
  billingMonth: r.billing_month,
  subtotal:     Number(r.subtotal),
  discount:     Number(r.discount),
  fine:         Number(r.fine),
  total:        Number(r.total),
  paid:         Number(r.paid),
  outstanding:  Number(r.total) - Number(r.paid),
  dueDate:      r.due_date,
  status:       r.status,
  notes:        r.notes,
  createdAt:    r.created_at,
  ...(lines && {
    lines: lines.map((l) => ({
      feeHeadId:   l.fee_head_id,
      feeHeadName: l.fee_head_name,
      amount:      Number(l.amount),
    })),
  }),
  ...(payments && {
    payments: payments.map((p) => ({
      id:          p.id,
      amount:      Number(p.amount),
      method:      p.method,
      referenceNo: p.reference_no,
      paidAt:      p.paid_at,
    })),
  }),
});

const toDiscountDto = (r: DiscountRow) => ({
  id:           r.id,
  schoolId:     r.school_id,
  studentId:    r.student_id,
  studentName:  r.student_name,
  name:         r.name,
  discountType: r.discount_type,
  value:        Number(r.value),
  appliedMonth: r.applied_month,
  reason:       r.reason,
  createdAt:    r.created_at,
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Generate challan number: CH-{schoolCode}-{YYYYMM}-{seq 4-padded}. Multi-tenant safe. */
async function generateChallanNo(
  client: PoolClient,
  schoolId: string,
  billingMonth: string, // YYYY-MM
): Promise<string> {
  const { rows: schoolRows } = await client.query<{ code: string }>(
    `SELECT code FROM schools WHERE id = $1`,
    [schoolId],
  );
  const schoolCode = schoolRows[0]?.code ?? 'SCH';
  const yyyymm = billingMonth.replace('-', '');

  const { rows } = await client.query<{ cnt: string }>(
    `SELECT count(*)::int AS cnt FROM fee_invoices
      WHERE school_id = $1 AND billing_month = date_trunc('month', ($2 || '-01')::date)`,
    [schoolId, billingMonth],
  );
  const seq = (Number(rows[0]?.cnt ?? 0) + 1).toString().padStart(4, '0');
  return `CH-${schoolCode}-${yyyymm}-${seq}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FEE HEADS
// ═══════════════════════════════════════════════════════════════════════════

export async function listFeeHeads(actor: AccessClaims, q: ListFeeHeadsQuery) {
  const where: string[] = ['school_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`name ILIKE $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<FeeHeadRow>(
      `SELECT id, school_id, name, amount, is_recurring, applicable_to, display_order, deleted_at
         FROM fee_heads
        WHERE ${whereSql}
        ORDER BY display_order, name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM fee_heads WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toFeeHeadDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createFeeHead(actor: AccessClaims, input: CreateFeeHeadInput) {
  const { rows } = await query<FeeHeadRow>(
    `INSERT INTO fee_heads
       (school_id, name, amount, is_recurring, applicable_to, display_order)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, school_id, name, amount, is_recurring, applicable_to, display_order, deleted_at`,
    [actor.schoolId, input.name, input.amount, input.isRecurring ?? true,
     input.applicableTo ?? 'all', input.displayOrder ?? 0],
  );
  return toFeeHeadDto(rows[0]);
}

export async function updateFeeHead(actor: AccessClaims, id: string, input: UpdateFeeHeadInput) {
  // Guard: cannot patch a soft-deleted fee head (multi-tenant scope enforced).
  const { rows: before } = await query<FeeHeadRow>(
    `SELECT id, school_id, name, amount, is_recurring, applicable_to, display_order, deleted_at
       FROM fee_heads WHERE id = $1 AND school_id = $2`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Fee head not found');
  if (before[0].deleted_at) throw unprocessable('Fee head has been deleted');

  const { rows } = await query<FeeHeadRow>(
    `UPDATE fee_heads
        SET name          = COALESCE($3, name),
            amount        = COALESCE($4, amount),
            is_recurring  = COALESCE($5, is_recurring),
            applicable_to = COALESCE($6, applicable_to),
            display_order = COALESCE($7, display_order)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, name, amount, is_recurring, applicable_to, display_order, deleted_at`,
    [id, actor.schoolId, input.name ?? null, input.amount ?? null,
     input.isRecurring ?? null, input.applicableTo ?? null, input.displayOrder ?? null],
  );
  return { before: toFeeHeadDto(before[0]), after: toFeeHeadDto(rows[0]) };
}

export async function deleteFeeHead(actor: AccessClaims, id: string) {
  // Soft-delete (blueprint §3). Multi-tenant scope via school_id.
  const { rows } = await query<FeeHeadRow>(
    `UPDATE fee_heads SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, name, amount, is_recurring, applicable_to, display_order, deleted_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Fee head not found');
  return toFeeHeadDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════════════════

export async function listInvoices(actor: AccessClaims, q: ListInvoicesQuery) {
  const where: string[] = ['fi.school_id = $1', 'fi.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.studentId) {
    params.push(q.studentId);
    where.push(`fi.student_id = $${params.length}`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`fi.status = $${params.length}`);
  }
  if (q.month) {
    params.push(`${q.month}-01`);
    where.push(`fi.billing_month = date_trunc('month', $${params.length}::date)`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<InvoiceRow>(
      `SELECT fi.id, fi.school_id, fi.student_id, st.full_name AS student_name,
              fi.challan_no, fi.billing_month, fi.subtotal, fi.discount, fi.fine,
              fi.total, fi.paid, fi.due_date, fi.status, fi.notes, fi.created_at
         FROM fee_invoices fi
         JOIN students st ON st.id = fi.student_id
        WHERE ${whereSql}
        ORDER BY fi.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM fee_invoices fi WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map((r) => toInvoiceDto(r)),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createInvoice(actor: AccessClaims, input: CreateInvoiceInput) {
  return withTransaction(async (client) => {
    // Multi-tenant: verify student belongs to this school.
    const { rows: stuRows } = await client.query<{ id: string }>(
      `SELECT id FROM students WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.studentId, actor.schoolId],
    );
    if (!stuRows[0]) throw notFound('Student not found');

    // Load fee heads — multi-tenant scope enforced.
    const { rows: headRows } = await client.query<{ id: string; name: string; amount: string }>(
      `SELECT id, name, amount FROM fee_heads
        WHERE id = ANY($1::uuid[]) AND school_id = $2 AND deleted_at IS NULL`,
      [input.feeHeadIds, actor.schoolId],
    );
    if (headRows.length !== input.feeHeadIds.length) {
      throw unprocessable('One or more fee heads not found or belong to another tenant');
    }

    const subtotal = headRows.reduce((sum, h) => sum + Number(h.amount), 0);
    const discount = input.discount ?? 0;
    const fine     = input.fine ?? 0;
    const total    = subtotal - discount + fine;

    const billingDate = `${input.billingMonth}-01`;
    const challanNo   = await generateChallanNo(client, actor.schoolId, input.billingMonth);

    const { rows: invRows } = await client.query<InvoiceRow & { student_name: string }>(
      `WITH ins AS (
         INSERT INTO fee_invoices
           (school_id, student_id, challan_no, billing_month, subtotal, discount, fine,
            total, due_date, notes, created_by)
         VALUES ($1,$2,$3,date_trunc('month',$4::date),$5,$6,$7,$8,$9,$10,$11)
         RETURNING *
       )
       SELECT ins.*, st.full_name AS student_name
         FROM ins JOIN students st ON st.id = ins.student_id`,
      [actor.schoolId, input.studentId, challanNo, billingDate, subtotal, discount, fine,
       total, input.dueDate, input.notes ?? null, actor.sub],
    ).catch((err: unknown) => {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw conflict('Challan number already exists for this school/month');
      }
      throw err;
    });

    const inv = invRows[0];

    // Insert invoice lines (one per fee head).
    for (const head of headRows) {
      await client.query(
        `INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount)
         VALUES ($1,$2,$3,$4)`,
        [inv.id, head.id, head.name, Number(head.amount)],
      );
    }

    // Accrual Journal Entry posting
    await postInvoiceAccrual(
      client,
      actor.schoolId,
      inv.id,
      Number(inv.total),
      inv.challan_no,
      billingDate,
      actor.sub
    );

    return toInvoiceDto(
      inv,
      headRows.map((h) => ({ id: '', fee_head_id: h.id, fee_head_name: h.name, amount: h.amount })),
    );
  });
}

export async function bulkGenerateInvoices(actor: AccessClaims, input: BulkGenerateInput) {
  return withTransaction(async (client) => {
    // Load fee heads — multi-tenant, soft-delete filtered.
    const { rows: headRows } = await client.query<{ id: string; name: string; amount: string }>(
      `SELECT id, name, amount FROM fee_heads
        WHERE id = ANY($1::uuid[]) AND school_id = $2 AND deleted_at IS NULL`,
      [input.feeHeadIds, actor.schoolId],
    );
    if (headRows.length !== input.feeHeadIds.length) {
      throw unprocessable('One or more fee heads not found');
    }

    const subtotal  = headRows.reduce((sum, h) => sum + Number(h.amount), 0);
    const billingDate = `${input.billingMonth}-01`;

    // Ensure System Fee Heads exist for dynamic dues
    const ensureFeeHead = async (name: string) => {
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM fee_heads WHERE school_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [actor.schoolId, name]
      );
      if (rows[0]) return rows[0].id;
      const { rows: newRows } = await client.query<{ id: string }>(
        `INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to, display_order)
         VALUES ($1, $2, 0, false, 'all', 99) RETURNING id`,
        [actor.schoolId, name]
      );
      return newRows[0].id;
    };

    const transportHeadId = await ensureFeeHead('Transport Fee');
    const hostelHeadId = await ensureFeeHead('Hostel Fee');
    const libraryHeadId = await ensureFeeHead('Library Fine');

    // Fetch all active students in the class (via sections → students). Multi-tenant.
    const { rows: students } = await client.query<{ id: string; user_id: string }>(
      `SELECT DISTINCT s.id, s.user_id
         FROM students s
         JOIN sections sec ON sec.id = s.section_id
         JOIN classes c ON c.id = sec.class_id
        WHERE c.id = $1
          AND s.school_id = $2
          AND s.status = 'active'
          AND s.deleted_at IS NULL`,
      [input.classId, actor.schoolId],
    );

    const studentIds = students.map(s => s.id);
    const userIds = students.map(s => s.user_id).filter(id => id != null);

    // Prefetch Transport assignments
    const { rows: transportRows } = await client.query<{ student_id: string; monthly_fee: string }>(
      `SELECT student_id, monthly_fee FROM student_transport
        WHERE school_id = $1 AND student_id = ANY($2::uuid[]) AND is_active = true AND deleted_at IS NULL`,
      [actor.schoolId, studentIds]
    );
    const transportMap = new Map(transportRows.map(r => [r.student_id, Number(r.monthly_fee)]));

    // Prefetch Hostel assignments
    const { rows: hostelRows } = await client.query<{ student_id: string; monthly_fee: string }>(
      `SELECT student_id, monthly_fee FROM hostel_allocations
        WHERE school_id = $1 AND student_id = ANY($2::uuid[]) AND status = 'active' AND deleted_at IS NULL`,
      [actor.schoolId, studentIds]
    );
    const hostelMap = new Map(hostelRows.map(r => [r.student_id, Number(r.monthly_fee)]));

    // Prefetch Library Fines (borrower_id is user_id)
    const libraryMap = new Map<string, number>();
    if (userIds.length > 0) {
      const { rows: libraryRows } = await client.query<{ borrower_id: string; total_fine: string }>(
        `SELECT borrower_id, sum(fine_amount) as total_fine FROM book_issues
          WHERE school_id = $1 AND borrower_id = ANY($2::uuid[]) AND fine_paid = false AND fine_amount > 0 AND status = 'returned'
          GROUP BY borrower_id`,
        [actor.schoolId, userIds]
      );
      for (const r of libraryRows) libraryMap.set(r.borrower_id, Number(r.total_fine));
    }

    // Find which students already have an invoice for this billing month.
    const { rows: existing } = await client.query<{ student_id: string }>(
      `SELECT DISTINCT student_id FROM fee_invoices
        WHERE school_id = $1
          AND billing_month = date_trunc('month', $2::date)
          AND deleted_at IS NULL`,
      [actor.schoolId, billingDate],
    );
    const existingSet = new Set(existing.map((r) => r.student_id));

    let generated = 0;
    let skipped   = 0;

    for (const stu of students) {
      if (existingSet.has(stu.id)) {
        skipped++;
        continue;
      }

      let dynamicSubtotal = 0;
      const dynamicLines = [];

      const tFee = transportMap.get(stu.id);
      if (tFee && tFee > 0) {
        dynamicSubtotal += tFee;
        dynamicLines.push({ id: transportHeadId, name: 'Transport Fee', amount: tFee });
      }

      const hFee = hostelMap.get(stu.id);
      if (hFee && hFee > 0) {
        dynamicSubtotal += hFee;
        dynamicLines.push({ id: hostelHeadId, name: 'Hostel Fee', amount: hFee });
      }

      const lFine = stu.user_id ? libraryMap.get(stu.user_id) : undefined;
      if (lFine && lFine > 0) {
        dynamicSubtotal += lFine;
        dynamicLines.push({ id: libraryHeadId, name: 'Library Fine', amount: lFine });
        
        // Mark library fines as invoiced/paid conceptually so they aren't billed twice
        await client.query(
          `UPDATE book_issues SET fine_paid = true 
            WHERE school_id = $1 AND borrower_id = $2 AND fine_paid = false AND fine_amount > 0 AND status = 'returned'`,
          [actor.schoolId, stu.user_id]
        );
      }

      const finalSubtotal = subtotal + dynamicSubtotal;

      const challanNo = await generateChallanNo(client, actor.schoolId, input.billingMonth);
      const { rows: invRows } = await client.query<{ id: string }>(
        `INSERT INTO fee_invoices
           (school_id, student_id, challan_no, billing_month, subtotal, discount, fine,
            total, due_date, created_by)
         VALUES ($1,$2,$3,date_trunc('month',$4::date),$5,0,0,$6,$7,$8)
         RETURNING id`,
        [actor.schoolId, stu.id, challanNo, billingDate, finalSubtotal,
         finalSubtotal, input.dueDate, actor.sub],
      );
      const invId = invRows[0].id;
      
      // Standard fee heads
      for (const head of headRows) {
        await client.query(
          `INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount)
           VALUES ($1,$2,$3,$4)`,
          [invId, head.id, head.name, Number(head.amount)],
        );
      }
      
      // Dynamic fee heads
      for (const line of dynamicLines) {
        await client.query(
          `INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount)
           VALUES ($1,$2,$3,$4)`,
          [invId, line.id, line.name, line.amount],
        );
      }

      // Accrual Journal Entry posting
      await postInvoiceAccrual(
        client,
        actor.schoolId,
        invId,
        finalSubtotal,
        challanNo,
        billingDate,
        actor.sub
      );
      
      generated++;
    }

    return { generated, skipped };
  });
}

export async function getInvoiceById(actor: AccessClaims, id: string) {
  // Multi-tenant scope: school_id = actor.schoolId. Soft-delete filtered.
  const { rows } = await query<InvoiceRow>(
    `SELECT fi.id, fi.school_id, fi.student_id, st.full_name AS student_name,
            fi.challan_no, fi.billing_month, fi.subtotal, fi.discount, fi.fine,
            fi.total, fi.paid, fi.due_date, fi.status, fi.notes, fi.created_at
       FROM fee_invoices fi
       JOIN students st ON st.id = fi.student_id
      WHERE fi.id = $1 AND fi.school_id = $2 AND fi.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Invoice not found');

  const [linesRes, paymentsRes] = await Promise.all([
    query<InvoiceLineRow>(
      `SELECT id, fee_head_id, fee_head_name, amount FROM fee_invoice_lines WHERE invoice_id = $1`,
      [id],
    ),
    query<PaymentRow>(
      `SELECT id, amount, method, reference_no, paid_at FROM fee_payments
        WHERE invoice_id = $1 ORDER BY paid_at`,
      [id],
    ),
  ]);

  return toInvoiceDto(rows[0], linesRes.rows, paymentsRes.rows);
}

export async function waiveInvoice(actor: AccessClaims, id: string, input: WaiveInvoiceInput) {
  const { rows: before } = await query<InvoiceRow>(
    `SELECT fi.id, fi.school_id, fi.student_id, st.full_name AS student_name,
            fi.challan_no, fi.billing_month, fi.subtotal, fi.discount, fi.fine,
            fi.total, fi.paid, fi.due_date, fi.status, fi.notes, fi.created_at
       FROM fee_invoices fi JOIN students st ON st.id = fi.student_id
      WHERE fi.id = $1 AND fi.school_id = $2 AND fi.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Invoice not found');
  if (before[0].status === 'waived') throw unprocessable('Invoice already waived');
  if (before[0].status === 'paid') throw unprocessable('Invoice already paid');

  const notes = input.reason
    ? `[Waived] ${input.reason}`
    : '[Waived]';

  const { rows } = await query<InvoiceRow>(
    `UPDATE fee_invoices
        SET status = 'waived', notes = COALESCE($3, notes)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, student_id, challan_no, billing_month, subtotal,
                discount, fine, total, paid, due_date, status, notes, created_at`,
    [id, actor.schoolId, notes],
  );
  // student_name not in RETURNING; carry from before row.
  return { before: toInvoiceDto(before[0]), after: toInvoiceDto({ ...rows[0], student_name: before[0].student_name }) };
}

/**
 * Record a fee payment. Transactional + idempotent:
 *  - row-locks the invoice (FOR UPDATE) to avoid double-credit on concurrent posts
 *  - rejects overpayment
 *  - updates invoice status from the new paid total
 * Multi-tenant: invoice loaded by id AND school_id.
 */
export async function payInvoice(
  actor: AccessClaims,
  invoiceId: string,
  input: PayInvoiceInput,
) {
  return withTransaction(async (client) => {
    // FOR UPDATE row-lock prevents concurrent double-payment (transactional integrity).
    const { rows } = await client.query(
      `SELECT id, school_id, total, paid, status
         FROM fee_invoices
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
        FOR UPDATE`,
      [invoiceId, actor.schoolId],
    );
    const inv = rows[0];
    if (!inv) throw notFound('Invoice not found');
    if (inv.status === 'paid' || inv.status === 'waived') {
      throw unprocessable('Invoice already settled');
    }

    const outstanding = Number(inv.total) - Number(inv.paid);
    if (input.amount <= 0 || input.amount > outstanding) {
      throw unprocessable('amount exceeds outstanding balance', { outstanding });
    }

    await client.query(
      `INSERT INTO fee_payments (invoice_id, amount, method, received_by, reference_no)
       VALUES ($1,$2,$3,$4,$5)`,
      [invoiceId, input.amount, input.method, actor.sub, input.referenceNo ?? null],
    );

    const newPaid   = Number(inv.paid) + input.amount;
    const newStatus = newPaid >= Number(inv.total) ? 'paid' : 'partial';
    await client.query(
      `UPDATE fee_invoices SET paid = $1, status = $2 WHERE id = $3`,
      [newPaid, newStatus, invoiceId],
    );

    // ── Automatic Journal Entry (double-entry accounting: Cash vs Receivable) ─────────────────
    // Debit:  Cash in Hand (1001)       — asset, debit-normal → balance increases
    // Credit: Accounts Receivable (1003) — asset, debit-normal → credit decreases balance
    const { rows: cashRows } = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE school_id = $1 AND code = '1001' AND deleted_at IS NULL`,
      [actor.schoolId],
    );
    const { rows: recRows } = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE school_id = $1 AND code = '1003' AND deleted_at IS NULL`,
      [actor.schoolId],
    );

    if (cashRows[0] && recRows[0]) {
      const cashAccountId = cashRows[0].id;
      const recAccountId  = recRows[0].id;
      const year  = new Date().getFullYear();
      const seq   = invoiceId.replace(/-/g, '').slice(0, 5).toUpperCase();
      const refNo = `FEE-PAY-${year}-${seq}`;

      const { rows: jeRows } = await client.query<{ id: string }>(
        `INSERT INTO journal_entries (school_id, ref_no, description, entry_date, status, created_by)
         VALUES ($1, $2, $3, current_date, 'posted', $4)
         RETURNING id`,
        [
          actor.schoolId,
          refNo,
          `Fee payment for invoice ${invoiceId}`,
          actor.sub,
        ],
      );
      const journalId = jeRows[0].id;

      // Debit line: Cash in Hand
      await client.query(
        `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
         VALUES ($1, $2, $3, 0, $4)`,
        [journalId, cashAccountId, input.amount, 'Fee collection - cash received'],
      );

      // Credit line: Accounts Receivable
      await client.query(
        `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
         VALUES ($1, $2, 0, $3, $4)`,
        [journalId, recAccountId, input.amount, 'Fee collection - Accounts Receivable credited'],
      );

      // Update account balances:
      // Cash in Hand (asset, debit-normal): debit increases balance
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [input.amount, cashAccountId],
      );
      // Accounts Receivable (asset, debit-normal): credit decreases balance
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [input.amount, recAccountId],
      );
    }

    const receiptNo = `RCV-${new Date().getFullYear()}-${invoiceId.slice(0, 6)}`;
    return { invoiceId, paid: newPaid, total: Number(inv.total), status: newStatus, receiptNo };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCOUNTS / SCHOLARSHIPS
// ═══════════════════════════════════════════════════════════════════════════

export async function listDiscounts(actor: AccessClaims, q: ListDiscountsQuery) {
  const where: string[] = ['fd.school_id = $1', 'fd.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.studentId) {
    params.push(q.studentId);
    where.push(`fd.student_id = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<DiscountRow>(
      `SELECT fd.id, fd.school_id, fd.student_id, st.full_name AS student_name,
              fd.name, fd.discount_type, fd.value, fd.applied_month, fd.reason, fd.created_at
         FROM fee_discounts fd
         JOIN students st ON st.id = fd.student_id
        WHERE ${whereSql}
        ORDER BY fd.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM fee_discounts fd WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toDiscountDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createDiscount(actor: AccessClaims, input: CreateDiscountInput) {
  return withTransaction(async (client) => {
    // Multi-tenant: verify student belongs to this school.
    const { rows: stuRows } = await client.query<{ id: string }>(
      `SELECT id FROM students WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.studentId, actor.schoolId],
    );
    if (!stuRows[0]) throw notFound('Student not found');

    const { rows } = await client.query<DiscountRow>(
      `WITH ins AS (
         INSERT INTO fee_discounts
           (school_id, student_id, name, discount_type, value, applied_month, reason, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *
       )
       SELECT ins.*, st.full_name AS student_name
         FROM ins JOIN students st ON st.id = ins.student_id`,
      [
        actor.schoolId, input.studentId, input.name, input.discountType, input.value,
        input.appliedMonth ? `${input.appliedMonth}-01` : null,
        input.reason ?? null, actor.sub,
      ],
    );

    const discount = rows[0];

    // Auto-apply to unpaid invoices in the given month if appliedMonth is set.
    if (input.appliedMonth) {
      const billingDate = `${input.appliedMonth}-01`;
      const { rows: unpaidInvs } = await client.query<{ id: string; total: string; discount: string; subtotal: string }>(
        `SELECT id, total, discount, subtotal FROM fee_invoices
          WHERE school_id = $1 AND student_id = $2
            AND billing_month = date_trunc('month', $3::date)
            AND status IN ('unpaid','partial')
            AND deleted_at IS NULL`,
        [actor.schoolId, input.studentId, billingDate],
      );

      for (const inv of unpaidInvs) {
        let discountAmt: number;
        if (input.discountType === 'percentage') {
          discountAmt = Math.floor((Number(inv.subtotal) * input.value) / 100);
        } else {
          discountAmt = input.value;
        }
        const newDiscount = Number(inv.discount) + discountAmt;
        const newTotal    = Math.max(0, Number(inv.total) - discountAmt);
        await client.query(
          `UPDATE fee_invoices SET discount = $1, total = $2 WHERE id = $3`,
          [newDiscount, newTotal, inv.id],
        );
      }
    }

    return toDiscountDto(discount);
  });
}

export async function deleteDiscount(actor: AccessClaims, id: string) {
  // Soft-delete; multi-tenant scope enforced.
  const { rows } = await query<DiscountRow>(
    `WITH upd AS (
       UPDATE fee_discounts SET deleted_at = now()
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
        RETURNING *
     )
     SELECT upd.*, st.full_name AS student_name
       FROM upd JOIN students st ON st.id = upd.student_id`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Discount not found');
  return toDiscountDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════

export async function getDefaulters(actor: AccessClaims, q: DefaultersQuery) {
  const where: string[] = [
    'fi.school_id = $1',
    "fi.status IN ('unpaid','partial','overdue')",
    'fi.deleted_at IS NULL',
    's.deleted_at IS NULL',
  ];
  const params: unknown[] = [actor.schoolId];

  if (q.classId) {
    params.push(q.classId);
    where.push(
      `s.section_id IN (SELECT id FROM sections WHERE class_id = $${params.length})`,
    );
  }

  const whereSql = where.join(' AND ');
  const offset   = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<{
      student_id: string;
      student_name: string;
      admission_no: string;
      total_outstanding: string;
      invoice_count: string;
    }>(
      `SELECT s.id AS student_id, s.full_name AS student_name, s.admission_no,
              SUM(fi.total - fi.paid) AS total_outstanding,
              count(fi.id)::int AS invoice_count
         FROM fee_invoices fi
         JOIN students s ON s.id = fi.student_id
        WHERE ${whereSql}
        GROUP BY s.id, s.full_name, s.admission_no
       HAVING SUM(fi.total - fi.paid) > 0
        ORDER BY total_outstanding DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(DISTINCT fi.student_id)::int AS total
         FROM fee_invoices fi
         JOIN students s ON s.id = fi.student_id
        WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map((r) => ({
      studentId:        r.student_id,
      studentName:      r.student_name,
      admissionNo:      r.admission_no,
      totalOutstanding: Number(r.total_outstanding),
      invoiceCount:     Number(r.invoice_count),
    })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function getCollectionReport(actor: AccessClaims, q: CollectionReportQuery) {
  // Multi-tenant, grouped by day or month.
  const where: string[] = ['fi.school_id = $1', 'fi.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.period) {
    params.push(`${q.period}-01`);
    where.push(`date_trunc('month', fp.paid_at) = date_trunc('month', $${params.length}::date)`);
  }

  const groupExpr = q.groupBy === 'month'
    ? `to_char(date_trunc('month', fp.paid_at), 'YYYY-MM')`
    : `to_char(fp.paid_at, 'YYYY-MM-DD')`;

  const { rows } = await query<{ period: string; total_collected: string; payment_count: string }>(
    `SELECT ${groupExpr} AS period,
            SUM(fp.amount)::bigint AS total_collected,
            count(fp.id)::int AS payment_count
       FROM fee_payments fp
       JOIN fee_invoices fi ON fi.id = fp.invoice_id
      WHERE ${where.join(' AND ')}
      GROUP BY 1
      ORDER BY 1`,
    params,
  );

  return rows.map((r) => ({
    period:         r.period,
    totalCollected: Number(r.total_collected),
    paymentCount:   Number(r.payment_count),
  }));
}

async function postInvoiceAccrual(
  client: any,
  schoolId: string,
  invoiceId: string,
  totalAmount: number,
  challanNo: string,
  billingMonthStr: string,
  createdBy: string
) {
  if (totalAmount <= 0) return;

  const { rows: recRows } = await client.query(
    `SELECT id FROM accounts WHERE school_id = $1 AND code = '1003' AND deleted_at IS NULL`,
    [schoolId],
  );
  const { rows: revenueRows } = await client.query(
    `SELECT id FROM accounts WHERE school_id = $1 AND code = '4001' AND deleted_at IS NULL`,
    [schoolId],
  );

  if (recRows[0] && revenueRows[0]) {
    const recAccountId = recRows[0].id;
    const revenueAccountId = revenueRows[0].id;
    const year = new Date().getFullYear();
    const seq = invoiceId.replace(/-/g, '').slice(0, 5).toUpperCase();
    const refNo = `FEE-INV-${year}-${seq}`;

    const { rows: jeRows } = await client.query(
      `INSERT INTO journal_entries (school_id, ref_no, description, entry_date, status, created_by)
       VALUES ($1, $2, $3, $4::date, 'posted', $5)
       RETURNING id`,
      [
        schoolId,
        refNo,
        `Fee invoice generated - Challan: ${challanNo}`,
        billingMonthStr,
        createdBy,
      ],
    );
    const journalId = jeRows[0].id;

    // Debit line: Accounts Receivable
    await client.query(
      `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
       VALUES ($1, $2, $3, 0, $4)`,
      [journalId, recAccountId, totalAmount, `Accounts Receivable - invoice ${challanNo}`],
    );

    // Credit line: Tuition Fee Revenue
    await client.query(
      `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
       VALUES ($1, $2, 0, $3, $4)`,
      [journalId, revenueAccountId, totalAmount, `Tuition Revenue - invoice ${challanNo}`],
    );

    // Update account balances
    await client.query(
      `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
      [totalAmount, recAccountId],
    );
    await client.query(
      `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
      [totalAmount, revenueAccountId],
    );
  }
}
