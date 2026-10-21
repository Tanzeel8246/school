/**
 * Payroll service — multi-tenant, all queries scoped to actor.schoolId.
 * Money is BIGINT minor units (paisa) throughout; never floats.
 * Soft-delete via deleted_at; reads filter deleted_at IS NULL.
 * withTransaction for any multi-statement mutation (transactional integrity).
 * Salary structure upsert: soft-delete old components, insert new (blueprint §3).
 */
import { query, withTransaction } from '../../config/db.js';
import type { PoolClient } from 'pg';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, unprocessable } from '../../utils/http-error.js';
import type {
  ListStructuresQuery,
  CreateStructureInput,
  UpdateStructureInput,
  ListPayslipsQuery,
  RunPayrollInput,
} from './payroll.schema.js';

// ── Row types ──────────────────────────────────────────────────────────────

interface StructureRow {
  id: string;
  school_id: string;
  staff_id: string;
  staff_name: string | null;
  name: string;
  effective_from: string;
  created_at: string;
}

interface ComponentRow {
  id: string;
  structure_id: string;
  name: string;
  component_type: string;
  amount: string | number;
  is_percentage: boolean;
}

interface PayslipRow {
  id: string;
  school_id: string;
  staff_id: string;
  staff_name: string | null;
  period_month: string;
  base_salary: string | number;
  allowances: string | number;
  deductions: string | number;
  bonus: string | number;
  net_salary: string | number;
  status: string;
  notes: string | null;
  finalized_at: string | null;
  created_at: string;
}

// ── DTO mappers ────────────────────────────────────────────────────────────

const toComponentDto = (r: ComponentRow) => ({
  id:            r.id,
  name:          r.name,
  componentType: r.component_type,
  amount:        Number(r.amount),
  isPercentage:  r.is_percentage,
});

const toStructureDto = (r: StructureRow, components?: ComponentRow[]) => ({
  id:            r.id,
  schoolId:      r.school_id,
  staffId:       r.staff_id,
  staffName:     r.staff_name,
  name:          r.name,
  effectiveFrom: r.effective_from,
  createdAt:     r.created_at,
  ...(components && { components: components.map(toComponentDto) }),
});

const toPayslipDto = (r: PayslipRow, components?: ComponentRow[]) => ({
  id:           r.id,
  schoolId:     r.school_id,
  staffId:      r.staff_id,
  staffName:    r.staff_name,
  periodMonth:  r.period_month,
  baseSalary:   Number(r.base_salary),
  allowances:   Number(r.allowances),
  deductions:   Number(r.deductions),
  bonus:        Number(r.bonus),
  netSalary:    Number(r.net_salary),
  status:       r.status,
  notes:        r.notes,
  finalizedAt:  r.finalized_at,
  createdAt:    r.created_at,
  ...(components && { components: components.map(toComponentDto) }),
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Insert salary components for a structure inside a transaction. */
async function insertComponents(
  client: PoolClient,
  structureId: string,
  components: CreateStructureInput['components'],
): Promise<ComponentRow[]> {
  const rows: ComponentRow[] = [];
  for (const c of components) {
    const { rows: r } = await client.query<ComponentRow>(
      `INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, structure_id, name, component_type, amount, is_percentage`,
      [structureId, c.name, c.componentType, c.amount, c.isPercentage ?? false],
    );
    rows.push(r[0]);
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// SALARY STRUCTURES
// ═══════════════════════════════════════════════════════════════════════════

export async function listStructures(actor: AccessClaims, q: ListStructuresQuery) {
  const where: string[] = ['ss.school_id = $1', 'ss.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.staffId) {
    params.push(q.staffId);
    where.push(`ss.staff_id = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<StructureRow>(
      `SELECT ss.id, ss.school_id, ss.staff_id, st.full_name AS staff_name,
              ss.name, ss.effective_from, ss.created_at
         FROM salary_structures ss
         JOIN staff st ON st.id = ss.staff_id
        WHERE ${whereSql}
        ORDER BY ss.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM salary_structures ss WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map((r) => toStructureDto(r)),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createStructure(actor: AccessClaims, input: CreateStructureInput) {
  return withTransaction(async (client) => {
    // Multi-tenant: verify staff belongs to this school.
    const { rows: staffRows } = await client.query<{ id: string }>(
      `SELECT id FROM staff WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.staffId, actor.schoolId],
    );
    if (!staffRows[0]) throw notFound('Staff not found');

    // Upsert: soft-delete any existing structure for this staff (unique partial index).
    await client.query(
      `UPDATE salary_structures SET deleted_at = now()
        WHERE staff_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.staffId, actor.schoolId],
    );

    const effectiveFrom = input.effectiveFrom ?? new Date().toISOString().slice(0, 10);
    const { rows } = await client.query<StructureRow>(
      `WITH ins AS (
         INSERT INTO salary_structures (school_id, staff_id, name, effective_from)
         VALUES ($1,$2,$3,$4)
         RETURNING *
       )
       SELECT ins.*, st.full_name AS staff_name
         FROM ins JOIN staff st ON st.id = ins.staff_id`,
      [actor.schoolId, input.staffId, input.name, effectiveFrom],
    );
    const structure = rows[0];
    const components = await insertComponents(client, structure.id, input.components);

    return toStructureDto(structure, components);
  });
}

export async function getStructureById(actor: AccessClaims, id: string) {
  const { rows } = await query<StructureRow>(
    `SELECT ss.id, ss.school_id, ss.staff_id, st.full_name AS staff_name,
            ss.name, ss.effective_from, ss.created_at
       FROM salary_structures ss
       JOIN staff st ON st.id = ss.staff_id
      WHERE ss.id = $1 AND ss.school_id = $2 AND ss.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Salary structure not found');

  const { rows: compRows } = await query<ComponentRow>(
    `SELECT id, structure_id, name, component_type, amount, is_percentage
       FROM salary_components
      WHERE structure_id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return toStructureDto(rows[0], compRows);
}

export async function updateStructure(actor: AccessClaims, id: string, input: UpdateStructureInput) {
  return withTransaction(async (client) => {
    const { rows: beforeRows } = await client.query<StructureRow>(
      `SELECT ss.id, ss.school_id, ss.staff_id, st.full_name AS staff_name,
              ss.name, ss.effective_from, ss.created_at
         FROM salary_structures ss
         JOIN staff st ON st.id = ss.staff_id
        WHERE ss.id = $1 AND ss.school_id = $2 AND ss.deleted_at IS NULL`,
      [id, actor.schoolId],
    );
    if (!beforeRows[0]) throw notFound('Salary structure not found');

    const { rows } = await client.query<StructureRow>(
      `WITH upd AS (
         UPDATE salary_structures
            SET name           = COALESCE($3, name),
                effective_from = COALESCE($4, effective_from)
          WHERE id = $1 AND school_id = $2
          RETURNING *
       )
       SELECT upd.*, st.full_name AS staff_name
         FROM upd JOIN staff st ON st.id = upd.staff_id`,
      [id, actor.schoolId, input.name ?? null, input.effectiveFrom ?? null],
    );

    let components: ComponentRow[] | undefined;
    if (input.components) {
      // Soft-delete old components, insert new ones (transactional integrity).
      await client.query(
        `UPDATE salary_components SET deleted_at = now()
          WHERE structure_id = $1 AND deleted_at IS NULL`,
        [id],
      );
      components = await insertComponents(client, id, input.components);
    }

    return { before: toStructureDto(beforeRows[0]), after: toStructureDto(rows[0], components) };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYSLIPS
// ═══════════════════════════════════════════════════════════════════════════

export async function listPayslips(actor: AccessClaims, q: ListPayslipsQuery) {
  const where: string[] = ['p.school_id = $1'];
  const params: unknown[] = [actor.schoolId];

  if (q.period) {
    params.push(`${q.period}-01`);
    where.push(`p.period_month = date_trunc('month', $${params.length}::date)::date`);
  }
  if (q.staffId) {
    params.push(q.staffId);
    where.push(`p.staff_id = $${params.length}`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`p.status = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<PayslipRow>(
      `SELECT p.id, p.school_id, p.staff_id, st.full_name AS staff_name,
              p.period_month, p.base_salary, p.allowances, p.deductions, p.bonus,
              p.net_salary, p.status, p.notes, p.finalized_at, p.created_at
         FROM payslips p
         JOIN staff st ON st.id = p.staff_id
        WHERE ${whereSql}
        ORDER BY p.period_month DESC, st.full_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM payslips p WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map((r) => toPayslipDto(r)),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function getPayslipById(actor: AccessClaims, id: string) {
  const { rows } = await query<PayslipRow>(
    `SELECT p.id, p.school_id, p.staff_id, st.full_name AS staff_name,
            p.period_month, p.base_salary, p.allowances, p.deductions, p.bonus,
            p.net_salary, p.status, p.notes, p.finalized_at, p.created_at
       FROM payslips p
       JOIN staff st ON st.id = p.staff_id
      WHERE p.id = $1 AND p.school_id = $2`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Payslip not found');

  // Fetch salary structure components linked via the structure for this staff.
  const { rows: compRows } = await query<ComponentRow>(
    `SELECT sc.id, sc.structure_id, sc.name, sc.component_type, sc.amount, sc.is_percentage
       FROM salary_components sc
       JOIN salary_structures ss ON ss.id = sc.structure_id
      WHERE ss.staff_id = $1 AND ss.school_id = $2
        AND ss.deleted_at IS NULL AND sc.deleted_at IS NULL`,
    [rows[0].staff_id, actor.schoolId],
  );
  return toPayslipDto(rows[0], compRows);
}

export async function finalizePayslip(actor: AccessClaims, id: string) {
  return withTransaction(async (client) => {
    const { rows: before } = await client.query<PayslipRow>(
      `SELECT p.id, p.school_id, p.staff_id, st.full_name AS staff_name,
              p.period_month, p.base_salary, p.allowances, p.deductions, p.bonus,
              p.net_salary, p.status, p.notes, p.finalized_at, p.created_at
         FROM payslips p JOIN staff st ON st.id = p.staff_id
        WHERE p.id = $1 AND p.school_id = $2`,
      [id, actor.schoolId],
    );
    if (!before[0]) throw notFound('Payslip not found');
    if (before[0].status === 'final') throw unprocessable('Payslip already finalised');
    if (before[0].status !== 'approved') throw unprocessable('Payslip must be approved before finalising');

    const { rows } = await client.query<PayslipRow>(
      `WITH upd AS (
         UPDATE payslips
            SET status = 'final', finalized_at = now()
          WHERE id = $1 AND school_id = $2
          RETURNING *
       )
       SELECT upd.*, st.full_name AS staff_name
         FROM upd JOIN staff st ON st.id = upd.staff_id`,
      [id, actor.schoolId],
    );

    // ── Automatic Journal Entry (double-entry accounting: Payable vs Cash) ─────────────────
    // Debit:  Accounts Payable (2001) — liability, credit-normal → debit decreases balance
    // Credit: Cash in Hand (1001)      — asset, debit-normal → credit decreases balance
    const netSalary = Number(before[0].net_salary);

    const { rows: payableRows } = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE school_id = $1 AND code = '2001' AND deleted_at IS NULL`,
      [actor.schoolId],
    );
    const { rows: cashRows } = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE school_id = $1 AND code = '1001' AND deleted_at IS NULL`,
      [actor.schoolId],
    );

    if (payableRows[0] && cashRows[0]) {
      const payableAccountId = payableRows[0].id;
      const cashAccountId    = cashRows[0].id;
      const year = new Date().getFullYear();
      const seq  = id.replace(/-/g, '').slice(0, 5).toUpperCase();
      const refNo = `SAL-PAY-${year}-${seq}`;

      const { rows: jeRows } = await client.query<{ id: string }>(
        `INSERT INTO journal_entries (school_id, ref_no, description, entry_date, status, created_by)
         VALUES ($1, $2, $3, current_date, 'posted', $4)
         RETURNING id`,
        [
          actor.schoolId,
          refNo,
          `Salary payment for payslip ${id} — ${before[0].staff_name ?? 'staff'}`,
          actor.sub,
        ],
      );
      const journalId = jeRows[0].id;

      // Debit line: Accounts Payable
      await client.query(
        `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
         VALUES ($1, $2, $3, 0, $4)`,
        [journalId, payableAccountId, netSalary, 'Salary payable paid'],
      );

      // Credit line: Cash in Hand
      await client.query(
        `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
         VALUES ($1, $2, 0, $3, $4)`,
        [journalId, cashAccountId, netSalary, 'Salary payment - cash disbursed'],
      );

      // Update account balances:
      // Accounts Payable (liability, credit-normal): debit decreases balance
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [netSalary, payableAccountId],
      );
      // Cash in Hand (asset, debit-normal): credit decreases balance
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [netSalary, cashAccountId],
      );
    }

    return { before: toPayslipDto(before[0]), after: toPayslipDto(rows[0]) };
  });
}

export async function approvePayslip(actor: AccessClaims, id: string) {
  return withTransaction(async (client) => {
    const { rows: before } = await client.query<PayslipRow>(
      `SELECT p.id, p.school_id, p.staff_id, st.full_name AS staff_name,
              p.period_month, p.base_salary, p.allowances, p.deductions, p.bonus,
              p.net_salary, p.status, p.notes, p.finalized_at, p.created_at
         FROM payslips p JOIN staff st ON st.id = p.staff_id
        WHERE p.id = $1 AND p.school_id = $2`,
      [id, actor.schoolId],
    );
    if (!before[0]) throw notFound('Payslip not found');
    if (before[0].status !== 'draft') throw unprocessable('Only draft payslips can be approved');

    const { rows } = await client.query<PayslipRow>(
      `WITH upd AS (
         UPDATE payslips
            SET status = 'approved'
          WHERE id = $1 AND school_id = $2
          RETURNING *
       )
       SELECT upd.*, st.full_name AS staff_name
         FROM upd JOIN staff st ON st.id = upd.staff_id`,
      [id, actor.schoolId],
    );

    // ── Automatic Journal Entry (Accrual basis: Salary Expense vs Payable) ─────────────────
    // Debit:  Staff Salary Expense (5001) — expense, debit-normal → balance increases
    // Credit: Accounts Payable (2001)      — liability, credit-normal → balance increases
    const netSalary = Number(before[0].net_salary);

    const { rows: salaryExpRows } = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE school_id = $1 AND code = '5001' AND deleted_at IS NULL`,
      [actor.schoolId],
    );
    const { rows: payableRows } = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE school_id = $1 AND code = '2001' AND deleted_at IS NULL`,
      [actor.schoolId],
    );

    if (salaryExpRows[0] && payableRows[0]) {
      const salaryAccountId = salaryExpRows[0].id;
      const payableAccountId = payableRows[0].id;
      const year = new Date().getFullYear();
      const seq  = id.replace(/-/g, '').slice(0, 5).toUpperCase();
      const refNo = `SAL-EXP-${year}-${seq}`;

      const { rows: jeRows } = await client.query<{ id: string }>(
        `INSERT INTO journal_entries (school_id, ref_no, description, entry_date, status, created_by)
         VALUES ($1, $2, $3, current_date, 'posted', $4)
         RETURNING id`,
        [
          actor.schoolId,
          refNo,
          `Salary accrual for payslip ${id} — ${before[0].staff_name ?? 'staff'}`,
          actor.sub,
        ],
      );
      const journalId = jeRows[0].id;

      // Debit line: Staff Salary Expense
      await client.query(
        `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
         VALUES ($1, $2, $3, 0, $4)`,
        [journalId, salaryAccountId, netSalary, 'Salary expense accrued'],
      );

      // Credit line: Accounts Payable
      await client.query(
        `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
         VALUES ($1, $2, 0, $3, $4)`,
        [journalId, payableAccountId, netSalary, 'Salary payable recognized'],
      );

      // Update account balances:
      // Staff Salary Expense (expense, debit-normal): debit increases balance
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [netSalary, salaryAccountId],
      );
      // Accounts Payable (liability, credit-normal): credit increases balance
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [netSalary, payableAccountId],
      );
    }

    return { before: toPayslipDto(before[0]), after: toPayslipDto(rows[0]) };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYROLL RUN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run payroll for a period:
 *   1. Find active staff with no payslip for the period.
 *   2. For each: load salary structure components if present.
 *   3. Compute allowances/deductions (absolute + percentage of base).
 *   4. net = base + allowances - deductions + bonus.
 *   5. INSERT ON CONFLICT DO NOTHING (idempotent runs).
 * Multi-tenant: all queries scoped to actor.schoolId.
 */
export async function runPayroll(actor: AccessClaims, input: RunPayrollInput) {
  const periodDate = `${input.period}-01`;
  const bonus      = input.bonusAmount ?? 0;

  return withTransaction(async (client) => {
    // All active, non-deleted staff for this tenant.
    const { rows: staffList } = await client.query<{
      id: string;
      base_salary: string;
    }>(
      `SELECT id, base_salary FROM staff
        WHERE school_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [actor.schoolId],
    );

    let generated = 0;
    let skipped   = 0;

    for (const staff of staffList) {
      const baseSalary = Number(staff.base_salary);

      // Load active salary structure components (if any).
      const { rows: comps } = await client.query<{
        component_type: string;
        amount: string;
        is_percentage: boolean;
      }>(
        `SELECT sc.component_type, sc.amount, sc.is_percentage
           FROM salary_components sc
           JOIN salary_structures ss ON ss.id = sc.structure_id
          WHERE ss.staff_id = $1 AND ss.school_id = $2
            AND ss.deleted_at IS NULL AND sc.deleted_at IS NULL`,
        [staff.id, actor.schoolId],
      );

      let allowances = 0;
      let deductions = 0;

      for (const c of comps) {
        const amt = c.is_percentage
          ? Math.floor((baseSalary * Number(c.amount)) / 100)
          : Number(c.amount);
        if (c.component_type === 'allowance') allowances += amt;
        else deductions += amt;
      }

      // ── Tax Calculation ──
      // Simple logic: 5% tax on taxable income (base + allowances) exceeding 50,000 PKR (5,000,000 paisa)
      const taxableIncome = baseSalary + allowances;
      const TAX_THRESHOLD = 5000000;
      let taxAmount = 0;
      let notes = null;
      if (taxableIncome > TAX_THRESHOLD) {
        taxAmount = Math.floor((taxableIncome - TAX_THRESHOLD) * 0.05);
        deductions += taxAmount;
        notes = `Includes 5% tax on income over 50,000 PKR: ${taxAmount / 100} PKR`;
      }

      const netSalary = baseSalary + allowances - deductions + bonus;

      // ── Net Salary Validation ──
      const finalNetSalary = Math.max(0, netSalary);

      const { rowCount } = await client.query(
        `INSERT INTO payslips
           (school_id, staff_id, period_month, base_salary, allowances, deductions, bonus, net_salary, status, notes)
         VALUES ($1,$2,date_trunc('month',$3::date)::date,$4,$5,$6,$7,$8,'draft',$9)
         ON CONFLICT (staff_id, period_month) DO NOTHING`,
        [actor.schoolId, staff.id, periodDate, baseSalary, allowances, deductions, bonus, finalNetSalary, notes],
      );

      if ((rowCount ?? 0) > 0) generated++;
      else skipped++;
    }

    return { generated, skipped };
  });
}
