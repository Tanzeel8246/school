/**
 * Unit tests for apps/api/src/modules/accounting/accounting.service.ts
 *
 * All DB calls are fully mocked via vi.mock — no real database required.
 *
 * IMPORTANT: env vars must be set before any module that transitively loads
 * env.ts is imported. Vitest hoists vi.mock() factories, but top-level import
 * statements execute after those factories, so the assignments below fire
 * before env.ts's safeParse(process.env).
 */

// ── 1. Set required env vars before any import that loads env.ts ─────────────
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(32);
process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(32);
process.env['NODE_ENV'] = 'test';

// ── 2. Vitest imports ─────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── 3. Mock all external dependencies BEFORE importing the module under test ──
vi.mock('../src/config/db.js', () => ({
  query: vi.fn(),
  withTransaction: vi.fn((fn: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
    fn({ query: vi.fn() }),
  ),
}));

// ── 4. Import modules under test and mocked utilities ────────────────────────
import * as accountingService from '../src/modules/accounting/accounting.service.js';
import * as db from '../src/config/db.js';
import { createJournalSchema } from '../src/modules/accounting/accounting.schema.js';

// ── Typed helper so TypeScript doesn't complain about vi.fn() ─────────────────
const mockQuery = db.query as ReturnType<typeof vi.fn>;

// ── Shared mock actor (AccessClaims) ─────────────────────────────────────────
const mockActor = {
  sub: 'user-uuid',
  schoolId: 'school-uuid',
  role: 'principal',
  permissions: ['accounting:read', 'accounting:post'],
  jti: 'jti',
};

// =============================================================================
// getTrialBalance
// =============================================================================

describe('getTrialBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns accounts with debit/credit aggregates', async () => {
    const rows = [
      { id: 'acc-1', code: '1000', name: 'Cash', type: 'asset',     total_debit: '500000', total_credit: '200000' },
      { id: 'acc-2', code: '2000', name: 'Loans', type: 'liability', total_debit: '0',      total_credit: '300000' },
      { id: 'acc-3', code: '4000', name: 'Revenue', type: 'revenue', total_debit: '0',      total_credit: '800000' },
    ];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await accountingService.getTrialBalance(mockActor, { asOf: '2025-06-01' });

    expect(result.asOf).toBe('2025-06-01');
    expect(result.accounts.length).toBe(3);

    for (const account of result.accounts) {
      expect(account).toHaveProperty('id');
      expect(account).toHaveProperty('code');
      expect(account).toHaveProperty('name');
      expect(account).toHaveProperty('type');
      expect(account).toHaveProperty('totalDebit');
      expect(account).toHaveProperty('totalCredit');
      // pg returns numerics as strings; service should cast with Number()
      expect(typeof account.totalDebit).toBe('number');
      expect(typeof account.totalCredit).toBe('number');
    }

    // Spot-check first row values
    expect(result.accounts[0].totalDebit).toBe(500000);
    expect(result.accounts[0].totalCredit).toBe(200000);
  });

  it('returns empty accounts array when no accounts exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await accountingService.getTrialBalance(mockActor, { asOf: '2025-06-01' });

    expect(result.accounts).toEqual([]);
  });

  it('defaults asOf to today when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await accountingService.getTrialBalance(mockActor, {});

    expect(result.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// =============================================================================
// getPLReport
// =============================================================================

describe('getPLReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly separates revenue and expenses', async () => {
    const rows = [
      { account_id: 'acc-r1', name: 'Tuition Fees',    type: 'revenue', net: '500000' },
      { account_id: 'acc-r2', name: 'Exam Fees',       type: 'revenue', net: '500000' },
      { account_id: 'acc-e1', name: 'Staff Salaries',  type: 'expense', net: '200000' },
    ];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await accountingService.getPLReport(mockActor, {
      from: '2025-01-01',
      to:   '2025-06-30',
    });

    expect(result.revenue.length).toBe(2);
    expect(result.expenses.length).toBe(1);
    expect(result.totalRevenue).toBe(1000000);
    expect(result.totalExpenses).toBe(200000);
    expect(result.netIncome).toBe(800000);
  });

  it('returns netIncome as negative when expenses exceed revenue', async () => {
    const rows = [
      { account_id: 'acc-r1', name: 'Tuition Fees',   type: 'revenue', net: '100000' },
      { account_id: 'acc-e1', name: 'Staff Salaries', type: 'expense', net: '300000' },
    ];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await accountingService.getPLReport(mockActor, {
      from: '2025-01-01',
      to:   '2025-06-30',
    });

    expect(result.netIncome).toBe(-200000);
  });

  it('handles no rows (empty period)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await accountingService.getPLReport(mockActor, {
      from: '2025-01-01',
      to:   '2025-01-31',
    });

    expect(result.revenue).toEqual([]);
    expect(result.expenses).toEqual([]);
    expect(result.netIncome).toBe(0);
  });
});

// =============================================================================
// getBalanceSheet
// =============================================================================

describe('getBalanceSheet', () => {
  // Shared fixture rows used by several tests in this suite
  const balanceSheetRows = [
    { account_id: 'acc-a1', name: 'Cash',          type: 'asset',     balance: '1000000' },
    { account_id: 'acc-a2', name: 'Bank',           type: 'asset',     balance: '1000000' },
    { account_id: 'acc-l1', name: 'Trade Payables', type: 'liability', balance: '800000'  },
    { account_id: 'acc-e1', name: 'Retained Earnings', type: 'equity', balance: '1200000' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly separates assets, liabilities, equity', async () => {
    mockQuery.mockResolvedValueOnce({ rows: balanceSheetRows });

    const result = await accountingService.getBalanceSheet(mockActor, { asOf: '2025-06-01' });

    expect(result.assets.length).toBe(2);
    expect(result.totalAssets).toBe(2000000);
    expect(result.liabilities.length).toBe(1);
    expect(result.totalLiabilities).toBe(800000);
    expect(result.equity.length).toBe(1);
    expect(result.totalEquity).toBe(1200000);
  });

  it('balance sheet equation: totalAssets ≈ totalLiabilities + totalEquity', async () => {
    mockQuery.mockResolvedValueOnce({ rows: balanceSheetRows });

    const result = await accountingService.getBalanceSheet(mockActor, { asOf: '2025-06-01' });

    // assets (2000000) === liabilities (800000) + equity (1200000)
    expect(
      Math.abs(result.totalAssets - (result.totalLiabilities + result.totalEquity))
    ).toBeLessThan(2);
  });

  it('defaults asOf to today when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await accountingService.getBalanceSheet(mockActor, {});

    expect(result.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// =============================================================================
// getCashBook
// =============================================================================

describe('getCashBook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns transaction lines with running balance', async () => {
    // First query → opening balance
    mockQuery.mockResolvedValueOnce({ rows: [{ opening: '50000' }] });
    // Second query → transaction lines
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          entry_date:      '2025-06-05',
          ref_no:          'JE-2025-00001',
          description:     'Fee collection',
          account_code:    '1001',
          account_name:    'Cash',
          debit:           '30000',
          credit:          '0',
          running_balance: '80000',
        },
        {
          entry_date:      '2025-06-10',
          ref_no:          'JE-2025-00002',
          description:     'Salary payment',
          account_code:    '1001',
          account_name:    'Cash',
          debit:           '0',
          credit:          '20000',
          running_balance: '60000',
        },
      ],
    });

    const result = await accountingService.getCashBook(mockActor, {
      from: '2025-06-01',
      to:   '2025-06-30',
    });

    expect(result.openingBalance).toBe(50000);
    expect(result.lines.length).toBe(2);

    for (const line of result.lines) {
      expect(line).toHaveProperty('entryDate');
      expect(line).toHaveProperty('refNo');
      expect(line).toHaveProperty('description');
      expect(line).toHaveProperty('accountCode');
      expect(line).toHaveProperty('accountName');
      expect(line).toHaveProperty('debit');
      expect(line).toHaveProperty('credit');
      expect(line).toHaveProperty('runningBalance');
      // pg returns numbers as strings; service must cast with Number()
      expect(typeof line.debit).toBe('number');
      expect(typeof line.credit).toBe('number');
      expect(typeof line.runningBalance).toBe('number');
    }
  });

  it('closingBalance equals last line runningBalance', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ opening: '0' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            entry_date:      '2025-06-05',
            ref_no:          'JE-2025-00001',
            description:     null,
            account_code:    '1001',
            account_name:    'Cash',
            debit:           '10000',
            credit:          '0',
            running_balance: '10000',
          },
          {
            entry_date:      '2025-06-10',
            ref_no:          'JE-2025-00002',
            description:     null,
            account_code:    '1001',
            account_name:    'Cash',
            debit:           '5000',
            credit:          '0',
            running_balance: '15000',
          },
        ],
      });

    const result = await accountingService.getCashBook(mockActor, {
      from: '2025-06-01',
      to:   '2025-06-30',
    });

    expect(result.closingBalance).toBe(15000);
  });

  it('closingBalance equals openingBalance when no transactions', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ opening: '75000' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await accountingService.getCashBook(mockActor, {
      from: '2025-06-01',
      to:   '2025-06-30',
    });

    expect(result.closingBalance).toBe(75000);
    expect(result.lines).toEqual([]);
  });

  it('returns defaults for from/to when not provided', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ opening: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await accountingService.getCashBook(mockActor, {});

    expect(result.from).toBeDefined();
    expect(typeof result.from).toBe('string');
    expect(result.to).toBeDefined();
    expect(typeof result.to).toBe('string');
  });
});

// =============================================================================
// createJournal — Zod schema validation (no DB mock needed)
// =============================================================================

describe('createJournal — validation', () => {
  // Valid UUIDs for account IDs
  const accountA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const accountB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

  it('rejects unbalanced journal entry', () => {
    const result = createJournalSchema.safeParse({
      description: 'Unbalanced entry',
      entryDate:   '2025-06-01',
      lines: [
        { accountId: accountA, debit: 10000, credit: 0 },
        { accountId: accountB, debit: 5000,  credit: 0 }, // credit side missing — debit ≠ credit
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts balanced journal entry', () => {
    const result = createJournalSchema.safeParse({
      description: 'Balanced entry',
      entryDate:   '2025-06-01',
      lines: [
        { accountId: accountA, debit: 10000, credit: 0     },
        { accountId: accountB, debit: 0,     credit: 10000 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a line with both debit > 0 and credit > 0', () => {
    // The journalLineInputSchema refinement forbids debit > 0 AND credit > 0 on the same line.
    const result = createJournalSchema.safeParse({
      description: 'Invalid line',
      entryDate:   '2025-06-01',
      lines: [
        { accountId: accountA, debit: 500,  credit: 500  }, // both sides — invalid
        { accountId: accountB, debit: 1000, credit: 0    },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects journal with fewer than 2 lines', () => {
    // createJournalSchema requires lines: z.array(...).min(2)
    const result = createJournalSchema.safeParse({
      description: 'Single line entry',
      entryDate:   '2025-06-01',
      lines: [
        { accountId: accountA, debit: 100, credit: 0 },
      ],
    });

    expect(result.success).toBe(false);
  });
});
