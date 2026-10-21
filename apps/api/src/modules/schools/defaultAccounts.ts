import type { PoolClient } from 'pg';

/**
 * Default Chart of Accounts for a newly registered school.
 * Double-entry bookkeeping: every account has a type that determines debit/credit normal.
 *   - asset / expense  → debit-normal  (debit increases, credit decreases)
 *   - liability / equity / revenue → credit-normal (credit increases, debit decreases)
 *
 * All accounts are marked is_system = true so they cannot be deleted by the tenant.
 * Must run inside the caller's transaction (same as createDefaultRoles).
 */

interface DefaultAccount {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  key: string; // lookup key for the returned map
}

const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  // ── Assets (1xxx) ─────────────────────────────────────────────────────────
  { code: '1001', name: 'Cash in Hand',         type: 'asset',     key: 'cash' },
  { code: '1002', name: 'Bank Account',          type: 'asset',     key: 'bank' },
  { code: '1003', name: 'Accounts Receivable',   type: 'asset',     key: 'receivable' },
  { code: '1004', name: 'Petty Cash',            type: 'asset',     key: 'pettyCash' },

  // ── Liabilities (2xxx) ────────────────────────────────────────────────────
  { code: '2001', name: 'Accounts Payable',      type: 'liability', key: 'payable' },
  { code: '2002', name: 'Advance Fees Received', type: 'liability', key: 'advanceFees' },
  { code: '2003', name: 'Staff Provident Fund',  type: 'liability', key: 'providentFund' },

  // ── Equity (3xxx) ─────────────────────────────────────────────────────────
  { code: '3001', name: 'School Capital',        type: 'equity',    key: 'capital' },
  { code: '3002', name: 'Retained Earnings',     type: 'equity',    key: 'retainedEarnings' },

  // ── Revenue (4xxx) ────────────────────────────────────────────────────────
  { code: '4001', name: 'Tuition Fee Revenue',   type: 'revenue',   key: 'tuitionRevenue' },
  { code: '4002', name: 'Transport Fee Revenue', type: 'revenue',   key: 'transportRevenue' },
  { code: '4003', name: 'Hostel Fee Revenue',    type: 'revenue',   key: 'hostelRevenue' },
  { code: '4004', name: 'Exam Fee Revenue',      type: 'revenue',   key: 'examRevenue' },
  { code: '4005', name: 'Other Income',          type: 'revenue',   key: 'otherIncome' },

  // ── Expenses (5xxx) ───────────────────────────────────────────────────────
  { code: '5001', name: 'Staff Salary Expense',  type: 'expense',   key: 'salaryExpense' },
  { code: '5002', name: 'Utility Expense',       type: 'expense',   key: 'utilityExpense' },
  { code: '5003', name: 'Rent Expense',          type: 'expense',   key: 'rentExpense' },
  { code: '5004', name: 'Maintenance Expense',   type: 'expense',   key: 'maintenanceExpense' },
  { code: '5005', name: 'Stationery Expense',    type: 'expense',   key: 'stationeryExpense' },
  { code: '5006', name: 'Transport Expense',     type: 'expense',   key: 'transportExpense' },
];

/**
 * Seed the complete chart of accounts for a freshly-created tenant and return
 * a map of logical key → account UUID. Shared by auth.register and POST /schools
 * so account creation lives in exactly one place (DRY).
 *
 * Must run inside the caller's transaction.
 */
export async function createDefaultAccounts(
  client: PoolClient,
  schoolId: string,
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};

  for (const acct of DEFAULT_ACCOUNTS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO accounts (school_id, code, name, type, is_system)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [schoolId, acct.code, acct.name, acct.type],
    );
    ids[acct.key] = rows[0].id;
  }

  return ids;
}
