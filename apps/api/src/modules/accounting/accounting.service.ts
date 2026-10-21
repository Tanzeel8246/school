/**
 * Accounting service — double-entry bookkeeping, multi-tenant.
 * RULES:
 *   - Every journal must balance: SUM(debit lines) = SUM(credit lines). Reject 422 if not.
 *   - Balance update on post: asset/expense debit-normal; liability/equity/revenue credit-normal.
 *   - All queries scoped to actor.schoolId (multi-tenant).
 *   - Soft-delete via deleted_at; reads filter deleted_at IS NULL.
 *   - withTransaction for all multi-statement mutations (transactional integrity).
 *   - Reports derive from journal_lines for accuracy; balance column is a cached snapshot.
 */
import { query, withTransaction } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, conflict, unprocessable } from '../../utils/http-error.js';
import type {
  ListAccountsQuery,
  CreateAccountInput,
  UpdateAccountInput,
  CreateJournalInput,
  ListJournalsQuery,
  TrialBalanceQuery,
  PlQuery,
  BalanceSheetQuery,
  CashBookQuery,
  GeneralLedgerQuery,
} from './accounting.schema.js';

// ── Row types ──────────────────────────────────────────────────────────────

interface AccountRow {
  id: string;
  school_id: string;
  code: string;
  name: string;
  type: string;
  parent_id: string | null;
  balance: string | number;
  is_system: boolean;
  created_at: string;
}

interface JournalRow {
  id: string;
  school_id: string;
  ref_no: string;
  description: string | null;
  entry_date: string;
  status: string;
  created_by: string | null;
  created_at: string;
}

interface JournalLineRow {
  id: string;
  journal_id: string;
  account_id: string;
  account_name: string | null;
  debit: string | number;
  credit: string | number;
  description: string | null;
}

// ── DTO mappers ────────────────────────────────────────────────────────────

const toAccountDto = (r: AccountRow) => ({
  id:        r.id,
  schoolId:  r.school_id,
  code:      r.code,
  name:      r.name,
  type:      r.type,
  parentId:  r.parent_id,
  balance:   Number(r.balance),
  isSystem:  r.is_system,
  createdAt: r.created_at,
});

const toJournalDto = (r: JournalRow, lines?: JournalLineRow[]) => ({
  id:          r.id,
  schoolId:    r.school_id,
  refNo:       r.ref_no,
  description: r.description,
  entryDate:   r.entry_date,
  status:      r.status,
  createdBy:   r.created_by,
  createdAt:   r.created_at,
  ...(lines && {
    lines: lines.map((l) => ({
      id:          l.id,
      accountId:   l.account_id,
      accountName: l.account_name,
      debit:       Number(l.debit),
      credit:      Number(l.credit),
      description: l.description,
    })),
  }),
});

// ── Reference sequence for ref_no ─────────────────────────────────────────

async function nextRefNo(schoolId: string, entryDate: string): Promise<string> {
  const yyyy = entryDate.slice(0, 4);
  const { rows } = await query<{ cnt: string }>(
    `SELECT count(*)::int AS cnt FROM journal_entries
      WHERE school_id = $1 AND entry_date >= ($2 || '-01-01')::date
        AND entry_date <  (($2::int + 1) || '-01-01')::date`,
    [schoolId, yyyy],
  );
  const seq = (Number(rows[0]?.cnt ?? 0) + 1).toString().padStart(5, '0');
  return `JE-${yyyy}-${seq}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════

export async function listAccounts(actor: AccessClaims, q: ListAccountsQuery) {
  const where: string[] = ['school_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.type) {
    params.push(q.type);
    where.push(`type = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<AccountRow>(
      `SELECT id, school_id, code, name, type, parent_id, balance, is_system, created_at
         FROM accounts
        WHERE ${whereSql}
        ORDER BY code
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM accounts WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toAccountDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createAccount(actor: AccessClaims, input: CreateAccountInput) {
  // Reject duplicate code within tenant (multi-tenant unique constraint).
  const { rows } = await query<AccountRow>(
    `INSERT INTO accounts (school_id, code, name, type, parent_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, school_id, code, name, type, parent_id, balance, is_system, created_at`,
    [actor.schoolId, input.code, input.name, input.type, input.parentId ?? null],
  ).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw conflict(`Account code '${input.code}' already exists in this school`);
    }
    throw err;
  });
  return toAccountDto(rows[0]);
}

export async function updateAccount(actor: AccessClaims, id: string, input: UpdateAccountInput) {
  const { rows: beforeRows } = await query<AccountRow>(
    `SELECT id, school_id, code, name, type, parent_id, balance, is_system, created_at
       FROM accounts WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!beforeRows[0]) throw notFound('Account not found');

  const { rows } = await query<AccountRow>(
    `UPDATE accounts
        SET name      = COALESCE($3, name),
            parent_id = COALESCE($4, parent_id)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, code, name, type, parent_id, balance, is_system, created_at`,
    [id, actor.schoolId, input.name ?? null, input.parentId ?? null],
  );
  return { before: toAccountDto(beforeRows[0]), after: toAccountDto(rows[0]) };
}

export async function deleteAccount(actor: AccessClaims, id: string) {
  // Reject if account has journal lines (soft-delete blocked for accounts with history).
  const { rows: lineCheck } = await query<{ cnt: number }>(
    `SELECT count(*)::int AS cnt FROM journal_lines WHERE account_id = $1`,
    [id],
  );
  if (Number(lineCheck[0]?.cnt ?? 0) > 0) {
    throw unprocessable('Cannot delete account: it has journal entries. Create a closing entry instead.');
  }

  const { rows } = await query<AccountRow>(
    `UPDATE accounts SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, code, name, type, parent_id, balance, is_system, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Account not found');
  return toAccountDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES
// ═══════════════════════════════════════════════════════════════════════════

export async function listJournals(actor: AccessClaims, q: ListJournalsQuery) {
  const where: string[] = ['je.school_id = $1', 'je.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.from) {
    params.push(q.from);
    where.push(`je.entry_date >= $${params.length}`);
  }
  if (q.to) {
    params.push(q.to);
    where.push(`je.entry_date <= $${params.length}`);
  }
  if (q.accountId) {
    params.push(q.accountId);
    where.push(
      `je.id IN (SELECT journal_id FROM journal_lines WHERE account_id = $${params.length})`,
    );
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<JournalRow>(
      `SELECT id, school_id, ref_no, description, entry_date, status, created_by, created_at
         FROM journal_entries je
        WHERE ${whereSql}
        ORDER BY je.entry_date DESC, je.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM journal_entries je WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map((r) => toJournalDto(r)),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createJournal(actor: AccessClaims, input: CreateJournalInput) {
  // Double-entry: Zod schema already validated balance; re-confirm here for safety.
  const totalDebit  = input.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = input.lines.reduce((s, l) => s + l.credit, 0);
  if (totalDebit !== totalCredit) {
    throw unprocessable('Journal entry is unbalanced', { totalDebit, totalCredit });
  }

  return withTransaction(async (client) => {
    const entryDate = input.entryDate ?? new Date().toISOString().slice(0, 10);
    const refNo     = await nextRefNo(actor.schoolId, entryDate);

    const { rows: jeRows } = await client.query<JournalRow>(
      `INSERT INTO journal_entries (school_id, ref_no, description, entry_date, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, school_id, ref_no, description, entry_date, status, created_by, created_at`,
      [actor.schoolId, refNo, input.description ?? null, entryDate, actor.sub],
    );
    const je = jeRows[0];

    const lineRows: JournalLineRow[] = [];
    for (const line of input.lines) {
      // Verify account belongs to this tenant (multi-tenant).
      const { rows: accRows } = await client.query<{ id: string; type: string; name: string }>(
        `SELECT id, type, name FROM accounts
          WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
        [line.accountId, actor.schoolId],
      );
      if (!accRows[0]) throw notFound(`Account ${line.accountId} not found`);
      const acc = accRows[0];

      const { rows: lineInsert } = await client.query<JournalLineRow>(
        `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, journal_id, account_id, $6::text AS account_name, debit, credit, description`,
        [je.id, line.accountId, line.debit, line.credit, line.description ?? null, acc.name],
      );
      lineRows.push(lineInsert[0]);

      /**
       * Update cached account balance (double-entry convention):
       *   asset/expense = debit-normal: debit increases (+), credit decreases (-).
       *   liability/equity/revenue = credit-normal: credit increases (+), debit decreases (-).
       */
      const isDebitNormal = acc.type === 'asset' || acc.type === 'expense';
      const balanceDelta  = isDebitNormal
        ? line.debit - line.credit
        : line.credit - line.debit;

      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [balanceDelta, line.accountId],
      );
    }

    return toJournalDto(je, lineRows);
  });
}

export async function getJournalById(actor: AccessClaims, id: string) {
  const { rows } = await query<JournalRow>(
    `SELECT id, school_id, ref_no, description, entry_date, status, created_by, created_at
       FROM journal_entries
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Journal entry not found');

  const { rows: lineRows } = await query<JournalLineRow>(
    `SELECT jl.id, jl.journal_id, jl.account_id, a.name AS account_name,
            jl.debit, jl.credit, jl.description
       FROM journal_lines jl
       JOIN accounts a ON a.id = jl.account_id
      WHERE jl.journal_id = $1`,
    [id],
  );
  return toJournalDto(rows[0], lineRows);
}

export async function reverseJournal(actor: AccessClaims, id: string) {
  /**
   * Soft-delete: mark status='reversed'. DO NOT re-adjust balances here —
   * reversal is accomplished by posting a new opposite journal entry.
   * This keeps the audit trail intact and preserves double-entry integrity.
   */
  const { rows: before } = await query<JournalRow>(
    `SELECT id, school_id, ref_no, description, entry_date, status, created_by, created_at
       FROM journal_entries WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Journal entry not found');
  if (before[0].status === 'reversed') throw unprocessable('Journal entry already reversed');

  const { rows } = await query<JournalRow>(
    `UPDATE journal_entries SET status = 'reversed', deleted_at = now()
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, ref_no, description, entry_date, status, created_by, created_at`,
    [id, actor.schoolId],
  );
  return { before: toJournalDto(before[0]), after: toJournalDto(rows[0]) };
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS (derive from journal_lines for accuracy)
// ═══════════════════════════════════════════════════════════════════════════

export async function getTrialBalance(actor: AccessClaims, q: TrialBalanceQuery) {
  const asOf = q.asOf ?? new Date().toISOString().slice(0, 10);

  const { rows } = await query<{
    id: string;
    code: string;
    name: string;
    type: string;
    total_debit: string;
    total_credit: string;
  }>(
    `SELECT a.id, a.code, a.name, a.type,
            COALESCE(SUM(jl.debit),  0)::bigint AS total_debit,
            COALESCE(SUM(jl.credit), 0)::bigint AS total_credit
       FROM accounts a
       LEFT JOIN journal_lines jl  ON jl.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jl.journal_id
                                   AND je.school_id = $1
                                   AND je.status = 'posted'
                                   AND je.entry_date <= $2
                                   AND je.deleted_at IS NULL
      WHERE a.school_id = $1
        AND a.deleted_at IS NULL
      GROUP BY a.id, a.code, a.name, a.type
      ORDER BY a.code`,
    [actor.schoolId, asOf],
  );

  return {
    asOf,
    accounts: rows.map((r) => ({
      id:          r.id,
      code:        r.code,
      name:        r.name,
      type:        r.type,
      totalDebit:  Number(r.total_debit),
      totalCredit: Number(r.total_credit),
    })),
  };
}

export async function getPLReport(actor: AccessClaims, q: PlQuery) {
  const { rows } = await query<{
    account_id: string;
    name: string;
    type: string;
    net: string;
  }>(
    `SELECT a.id AS account_id, a.name, a.type,
            CASE
              WHEN a.type = 'revenue' THEN
                COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
              ELSE
                COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
            END::bigint AS net
       FROM accounts a
       JOIN journal_lines jl  ON jl.account_id = a.id
       JOIN journal_entries je ON je.id = jl.journal_id
                              AND je.school_id = $1
                              AND je.status = 'posted'
                              AND je.entry_date BETWEEN $2 AND $3
                              AND je.deleted_at IS NULL
      WHERE a.school_id = $1
        AND a.type IN ('revenue','expense')
        AND a.deleted_at IS NULL
      GROUP BY a.id, a.name, a.type
      ORDER BY a.type DESC, a.name`,
    [actor.schoolId, q.from, q.to],
  );

  const revenue  = rows.filter((r) => r.type === 'revenue').map((r) => ({ accountId: r.account_id, name: r.name, amount: Number(r.net) }));
  const expenses = rows.filter((r) => r.type === 'expense').map((r) => ({ accountId: r.account_id, name: r.name, amount: Number(r.net) }));
  const totalRevenue  = revenue.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);

  return {
    from: q.from,
    to:   q.to,
    revenue,
    totalRevenue,
    expenses,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}

// ── Cash Book / Bank Book ──────────────────────────────────────────────────

/**
 * Returns chronological transaction lines for one or all asset/cash accounts,
 * with a running balance computed via a PostgreSQL window function.
 *
 * Structure:
 *   openingBalance  — sum of all movements on the account(s) BEFORE `from`
 *   rows            — each line carries entryDate, refNo, description,
 *                     debit, credit, runningBalance (minor units throughout)
 *   closingBalance  — last running-balance value, or openingBalance if no rows
 *
 * Multi-tenant: all queries scoped to actor.schoolId.
 * Source-of-truth: journal_lines (never the cached `balance` column).
 */
export async function getCashBook(actor: AccessClaims, q: CashBookQuery) {
  const today = new Date().toISOString().slice(0, 10);
  const from  = q.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const to    = q.to   ?? today;

  // 1. Opening balance: sum of debit-normal movements on matching accounts before `from`.
  //    asset accounts are debit-normal: debit increases balance, credit decreases it.
  const openingParams: unknown[] = [actor.schoolId, from];
  const accountFilter = q.accountId ? ` AND jl.account_id = $3` : '';
  if (q.accountId) openingParams.push(q.accountId);

  const { rows: openRows } = await query<{ opening: string }>(
    `SELECT COALESCE(
       SUM(CASE WHEN a.type IN ('asset','expense') THEN jl.debit - jl.credit
                ELSE jl.credit - jl.debit END
       ), 0
     )::bigint AS opening
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a          ON a.id  = jl.account_id
      WHERE je.school_id = $1
        AND je.status    = 'posted'
        AND je.deleted_at IS NULL
        AND je.entry_date < $2
        AND a.type IN ('asset')${accountFilter}`,
    openingParams,
  );
  const openingBalance = Number(openRows[0]?.opening ?? 0);

  // 2. Transaction lines for the date range, with running balance via SUM() OVER ().
  const rangeParams: unknown[] = [actor.schoolId, from, to];
  const rangeAccountFilter = q.accountId ? ` AND jl.account_id = $4` : '';
  if (q.accountId) rangeParams.push(q.accountId);

  const { rows } = await query<{
    entry_date: string;
    ref_no: string;
    description: string | null;
    account_code: string;
    account_name: string;
    debit: string;
    credit: string;
    running_balance: string;
  }>(
    `SELECT
       je.entry_date,
       je.ref_no,
       COALESCE(jl.description, je.description) AS description,
       a.code   AS account_code,
       a.name   AS account_name,
       jl.debit::bigint,
       jl.credit::bigint,
       (
         ${openingBalance}::bigint +
         SUM(
           CASE WHEN a.type IN ('asset','expense') THEN jl.debit - jl.credit
                ELSE jl.credit - jl.debit END
         ) OVER (
           ORDER BY je.entry_date, je.created_at, jl.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         )
       )::bigint AS running_balance
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a          ON a.id  = jl.account_id
      WHERE je.school_id = $1
        AND je.status    = 'posted'
        AND je.deleted_at IS NULL
        AND je.entry_date BETWEEN $2 AND $3
        AND a.type IN ('asset')${rangeAccountFilter}
      ORDER BY je.entry_date, je.created_at, jl.id`,
    rangeParams,
  );

  const lines = rows.map((r) => ({
    entryDate:      r.entry_date,
    refNo:          r.ref_no,
    description:    r.description,
    accountCode:    r.account_code,
    accountName:    r.account_name,
    debit:          Number(r.debit),
    credit:         Number(r.credit),
    runningBalance: Number(r.running_balance),
  }));

  const closingBalance = lines.length > 0
    ? lines[lines.length - 1].runningBalance
    : openingBalance;

  return {
    from,
    to,
    accountId:      q.accountId ?? null,
    openingBalance,
    lines,
    closingBalance,
    totalDebit:  lines.reduce((s, l) => s + l.debit, 0),
    totalCredit: lines.reduce((s, l) => s + l.credit, 0),
  };
}

export async function getBalanceSheet(actor: AccessClaims, q: BalanceSheetQuery) {
  const asOf = q.asOf ?? new Date().toISOString().slice(0, 10);

  const [bsRes, netIncomeRes] = await Promise.all([
    query<{
      account_id: string;
      name: string;
      type: string;
      balance: string;
    }>(
      `SELECT a.id AS account_id, a.name, a.type,
              CASE
                WHEN a.type IN ('asset','expense') THEN
                  COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
                ELSE
                  COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
              END::bigint AS balance
         FROM accounts a
         LEFT JOIN journal_lines jl  ON jl.account_id = a.id
         LEFT JOIN journal_entries je ON je.id = jl.journal_id
                                     AND je.school_id = $1
                                     AND je.status = 'posted'
                                     AND je.entry_date <= $2
                                     AND je.deleted_at IS NULL
        WHERE a.school_id = $1
          AND a.type IN ('asset','liability','equity')
          AND a.deleted_at IS NULL
        GROUP BY a.id, a.name, a.type
        ORDER BY a.type, a.name`,
      [actor.schoolId, asOf],
    ),
    query<{ net_income: string }>(
      `SELECT 
         COALESCE(
           SUM(
             jl.credit - jl.debit
           ), 0
         )::bigint AS net_income
        FROM accounts a
        JOIN journal_lines jl  ON jl.account_id = a.id
        JOIN journal_entries je ON je.id = jl.journal_id
       WHERE je.school_id = $1
         AND je.status = 'posted'
         AND je.entry_date <= $2
         AND je.deleted_at IS NULL
         AND a.type IN ('revenue', 'expense')
         AND a.deleted_at IS NULL`,
      [actor.schoolId, asOf],
    )
  ]);

  const rows = bsRes.rows;
  const netIncome = Number(netIncomeRes.rows[0]?.net_income ?? 0);

  const toSection = (type: string) =>
    rows.filter((r) => r.type === type).map((r) => ({ accountId: r.account_id, name: r.name, balance: Number(r.balance) }));

  const assets      = toSection('asset');
  const liabilities = toSection('liability');
  const equity      = toSection('equity');

  if (netIncome !== 0) {
    equity.push({
      accountId: 'net-income-current',
      name: 'Retained Earnings (Current Period)',
      balance: netIncome,
    });
  }

  return {
    asOf,
    assets,
    totalAssets:      assets.reduce((s, a) => s + a.balance, 0),
    liabilities,
    totalLiabilities: liabilities.reduce((s, a) => s + a.balance, 0),
    equity,
    totalEquity:      equity.reduce((s, a) => s + a.balance, 0),
  };
}

export async function getGeneralLedger(actor: AccessClaims, q: GeneralLedgerQuery) {
  const today = new Date().toISOString().slice(0, 10);
  const from  = q.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const to    = q.to   ?? today;

  // 1. Verify account exists and belongs to tenant
  const { rows: accRows } = await query<AccountRow>(
    `SELECT id, code, name, type FROM accounts
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [q.accountId, actor.schoolId],
  );
  if (!accRows[0]) throw notFound('Account not found');
  const account = accRows[0];

  // 2. Opening balance: sum of normal movements on matching accounts before `from`.
  //    asset & expense are debit-normal (debit increases balance, credit decreases it).
  //    liability, equity & revenue are credit-normal (credit increases balance, debit decreases it).
  const { rows: openRows } = await query<{ opening: string }>(
    `SELECT COALESCE(
       SUM(CASE WHEN a.type IN ('asset','expense') THEN jl.debit - jl.credit
                ELSE jl.credit - jl.debit END
       ), 0
     )::bigint AS opening
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a          ON a.id  = jl.account_id
      WHERE je.school_id = $1
        AND je.status    = 'posted'
        AND je.deleted_at IS NULL
        AND je.entry_date < $2
        AND jl.account_id = $3`,
    [actor.schoolId, from, q.accountId],
  );
  const openingBalance = Number(openRows[0]?.opening ?? 0);

  // 3. Transaction lines for the date range, with running balance via SUM() OVER ().
  const { rows } = await query<{
    entry_date: string;
    ref_no: string;
    description: string | null;
    debit: string;
    credit: string;
    running_balance: string;
  }>(
    `SELECT
       je.entry_date,
       je.ref_no,
       COALESCE(jl.description, je.description) AS description,
       jl.debit::bigint,
       jl.credit::bigint,
       (
         ${openingBalance}::bigint +
         SUM(
           CASE WHEN a.type IN ('asset','expense') THEN jl.debit - jl.credit
                ELSE jl.credit - jl.debit END
         ) OVER (
           ORDER BY je.entry_date, je.created_at, jl.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         )
       )::bigint AS running_balance
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a          ON a.id  = jl.account_id
      WHERE je.school_id = $1
        AND je.status    = 'posted'
        AND je.deleted_at IS NULL
        AND je.entry_date BETWEEN $2 AND $3
        AND jl.account_id = $4
      ORDER BY je.entry_date, je.created_at, jl.id`,
    [actor.schoolId, from, to, q.accountId],
  );

  const lines = rows.map((r) => ({
    entryDate:      r.entry_date,
    refNo:          r.ref_no,
    description:    r.description,
    debit:          Number(r.debit),
    credit:         Number(r.credit),
    runningBalance: Number(r.running_balance),
  }));

  const closingBalance = lines.length > 0
    ? lines[lines.length - 1].runningBalance
    : openingBalance;

  return {
    accountId:      q.accountId,
    accountName:    account.name,
    accountCode:    account.code,
    accountType:    account.type,
    from,
    to,
    openingBalance,
    lines,
    closingBalance,
    totalDebit:  lines.reduce((s, l) => s + l.debit, 0),
    totalCredit: lines.reduce((s, l) => s + l.credit, 0),
  };
}
