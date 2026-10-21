/**
 * Unit tests for apps/api/src/modules/fees/fees.service.ts
 *
 * All DB calls are fully mocked — no real database required.
 * Money is stored as BIGINT minor units (paisa); pg returns BIGINT as strings.
 *
 * IMPORTANT: env vars must be set before any module that transitively loads
 * env.ts is imported. Vitest hoists vi.mock() factories, but top-level import
 * statements execute after those factories, so assignments below fire before
 * env.ts's safeParse(process.env).
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
import * as feesService from '../src/modules/fees/fees.service.js';
import * as db from '../src/config/db.js';
import { HttpError } from '../src/utils/http-error.js';

// ── Typed helpers ──────────────────────────────────────────────────────────────
const mockQuery = db.query as ReturnType<typeof vi.fn>;
const mockWithTransaction = db.withTransaction as ReturnType<typeof vi.fn>;

// ── Shared mock actor ─────────────────────────────────────────────────────────
const actor = {
  sub: 'user-uuid',
  schoolId: 'school-uuid',
  role: 'principal',
  permissions: ['fees:read', 'fees:write'],
  jti: 'jti',
};

// ── Helper: minimal FeeHeadRow (snake_case, amounts as pg returns them) ───────
const makeFeeHeadRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'fh-uuid',
  school_id: 'school-uuid',
  name: 'Tuition Fee',
  amount: '150000',
  is_recurring: true,
  applicable_to: 'all',
  display_order: 1,
  deleted_at: null,
  ...overrides,
});

// ── Helper: minimal InvoiceRow (snake_case, amounts as pg strings) ────────────
const makeInvoiceRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-uuid',
  school_id: 'school-uuid',
  student_id: 'stu-uuid',
  student_name: 'Ali Raza',
  challan_no: 'CH-TST01-202501-0001',
  billing_month: '2025-01-01',
  subtotal: '1500000',
  discount: '0',
  fine: '0',
  total: '1500000',
  paid: '0',
  due_date: '2025-01-31',
  status: 'unpaid',
  notes: null,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

// ── Helper: defaulter row shape ───────────────────────────────────────────────
const makeDefaulterRow = (overrides: Record<string, unknown> = {}) => ({
  student_id: 'stu-uuid',
  student_name: 'Ali Raza',
  admission_no: 'A001',
  total_outstanding: '1500000',
  invoice_count: '2',
  ...overrides,
});

// ═════════════════════════════════════════════════════════════════════════════
// listFeeHeads
// ═════════════════════════════════════════════════════════════════════════════

describe('fees.service — listFeeHeads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated fee heads with camelCase DTOs', async () => {
    const row1 = makeFeeHeadRow({ id: 'fh-1', name: 'Tuition Fee' });
    const row2 = makeFeeHeadRow({ id: 'fh-2', name: 'Sports Fee', amount: '50000' });

    mockQuery
      .mockResolvedValueOnce({ rows: [row1, row2] })      // data
      .mockResolvedValueOnce({ rows: [{ total: '2' }] }); // count

    const result = await feesService.listFeeHeads(actor, { page: 1, limit: 20 });

    expect(result.data.length).toBe(2);
    expect(result.meta.total).toBe(2);
    expect(result.meta.page).toBe(1);

    const first = result.data[0];
    // camelCase keys
    expect(first).toHaveProperty('id', 'fh-1');
    expect(first).toHaveProperty('name', 'Tuition Fee');
    expect(first).toHaveProperty('isRecurring', true);
    expect(first).toHaveProperty('applicableTo', 'all');
    expect(first).toHaveProperty('displayOrder', 1);
    // amount must be a number, not a string
    expect(typeof first.amount).toBe('number');
    expect(first.amount).toBe(150000);
    // no snake_case keys
    expect(first).not.toHaveProperty('is_recurring');
    expect(first).not.toHaveProperty('applicable_to');
  });

  it('returns empty data and total 0 when no fee heads found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const result = await feesService.listFeeHeads(actor, { page: 1, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('applies search filter (two queries still called)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    await feesService.listFeeHeads(actor, { q: 'sports', page: 1, limit: 20 });

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listInvoices
// ═════════════════════════════════════════════════════════════════════════════

describe('fees.service — listInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated invoices with camelCase DTOs and computed outstanding', async () => {
    const row = makeInvoiceRow();
    mockQuery
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });

    const result = await feesService.listInvoices(actor, { page: 1, limit: 20 });

    expect(result.data.length).toBe(1);
    const inv = result.data[0];
    expect(inv).toHaveProperty('challanNo');
    expect(inv).toHaveProperty('billingMonth');
    expect(inv).toHaveProperty('status', 'unpaid');
    expect(typeof inv.total).toBe('number');
    expect(typeof inv.paid).toBe('number');
    expect(typeof inv.outstanding).toBe('number');
    // outstanding = total - paid = 1500000 - 0
    expect(inv.outstanding).toBe(1500000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// payInvoice — critical transactional path
// ═════════════════════════════════════════════════════════════════════════════

describe('fees.service — payInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a full payment and returns status paid', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query
        // 1. FOR UPDATE row-lock: invoice with total=1500000, paid=0
        .mockResolvedValueOnce({
          rows: [{ id: 'inv-uuid', total: '1500000', paid: '0', status: 'unpaid' }],
        })
        // 2. INSERT fee_payments
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        // 3. UPDATE fee_invoices SET paid, status
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });
      return fn(mockClient);
    });

    const result = await feesService.payInvoice(actor, 'inv-uuid', {
      amount: 1500000,
      method: 'cash',
    });

    expect(result.status).toBe('paid');
    expect(result.paid).toBe(1500000);
    expect(result.total).toBe(1500000);
    expect(result.invoiceId).toBe('inv-uuid');
    expect(result.receiptNo).toBeDefined();
  });

  it('records a partial payment and returns status partial', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: 'inv-uuid', total: '1500000', paid: '0', status: 'unpaid' }],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });
      return fn(mockClient);
    });

    const result = await feesService.payInvoice(actor, 'inv-uuid', {
      amount: 500000,
      method: 'bank',
    });

    expect(result.status).toBe('partial');
    expect(result.paid).toBe(500000);
  });

  it('throws HttpError 422 when invoice is already paid', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'inv-uuid', total: '1500000', paid: '1500000', status: 'paid' }],
      });
      return fn(mockClient);
    });

    await expect(
      feesService.payInvoice(actor, 'inv-uuid', { amount: 1000, method: 'cash' }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 422,
    );
  });

  it('throws HttpError 422 when invoice is waived', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'inv-uuid', total: '1500000', paid: '0', status: 'waived' }],
      });
      return fn(mockClient);
    });

    await expect(
      feesService.payInvoice(actor, 'inv-uuid', { amount: 1500000, method: 'cash' }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 422,
    );
  });

  it('throws HttpError 404 when invoice not found in this school', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // no row returned
      return fn(mockClient);
    });

    await expect(
      feesService.payInvoice(actor, 'nonexistent-inv', { amount: 1000, method: 'cash' }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );
  });

  it('throws HttpError 422 when amount exceeds outstanding balance (overpayment)', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query.mockResolvedValueOnce({
        // total=500000, paid=0 → outstanding=500000; attempt 600000
        rows: [{ id: 'inv-uuid', total: '500000', paid: '0', status: 'unpaid' }],
      });
      return fn(mockClient);
    });

    await expect(
      feesService.payInvoice(actor, 'inv-uuid', { amount: 600000, method: 'cash' }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 422,
    );
  });

  it('throws HttpError 422 when amount is zero or negative', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'inv-uuid', total: '500000', paid: '0', status: 'unpaid' }],
      });
      return fn(mockClient);
    });

    // amount=0 must also throw (service checks: input.amount <= 0)
    await expect(
      feesService.payInvoice(actor, 'inv-uuid', { amount: 0, method: 'cash' }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 422,
    );
  });

  it('passes referenceNo to the INSERT when provided', async () => {
    let capturedClient: { query: ReturnType<typeof vi.fn> } | null = null;

    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      capturedClient = mockClient;
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: 'inv-uuid', total: '1000000', paid: '0', status: 'unpaid' }],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });
      return fn(mockClient);
    });

    await feesService.payInvoice(actor, 'inv-uuid', {
      amount: 1000000,
      method: 'online',
      referenceNo: 'TRX-12345',
    });

    // The INSERT call (second client.query call, index 1) should include 'TRX-12345'
    const insertCall = capturedClient!.query.mock.calls[1] as [string, unknown[]];
    expect(insertCall[1]).toContain('TRX-12345');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getDefaulters
// ═════════════════════════════════════════════════════════════════════════════

describe('fees.service — getDefaulters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated list of defaulters with camelCase DTOs', async () => {
    const row1 = makeDefaulterRow({ student_id: 'stu-1', student_name: 'Ali Raza' });
    const row2 = makeDefaulterRow({ student_id: 'stu-2', student_name: 'Sara Khan', total_outstanding: '800000' });

    mockQuery
      .mockResolvedValueOnce({ rows: [row1, row2] })
      .mockResolvedValueOnce({ rows: [{ total: '2' }] });

    const result = await feesService.getDefaulters(actor, { page: 1, limit: 20 });

    expect(result.data.length).toBe(2);
    expect(result.meta.total).toBe(2);

    const first = result.data[0];
    expect(first).toHaveProperty('studentId', 'stu-1');
    expect(first).toHaveProperty('studentName', 'Ali Raza');
    expect(first).toHaveProperty('admissionNo', 'A001');
    // amounts must be numbers
    expect(typeof first.totalOutstanding).toBe('number');
    expect(first.totalOutstanding).toBe(1500000);
    expect(typeof first.invoiceCount).toBe('number');
    expect(first.invoiceCount).toBe(2);
    // no snake_case
    expect(first).not.toHaveProperty('student_id');
    expect(first).not.toHaveProperty('total_outstanding');
  });

  it('returns empty data when no defaulters exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const result = await feesService.getDefaulters(actor, { page: 1, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('filters by classId when provided (two queries called)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    await feesService.getDefaulters(actor, {
      classId: 'class-uuid',
      page: 1,
      limit: 20,
    });

    expect(mockQuery).toHaveBeenCalledTimes(2);
    // The SQL for the data query must reference the classId parameter
    const dataSql = (mockQuery.mock.calls[0] as [string, unknown[]])[0];
    expect(dataSql).toMatch(/section_id/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getCollectionReport
// ═════════════════════════════════════════════════════════════════════════════

describe('fees.service — getCollectionReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns collection rows with camelCase DTOs', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { period: '2025-01-05', total_collected: '300000', payment_count: '3' },
        { period: '2025-01-10', total_collected: '500000', payment_count: '5' },
      ],
    });

    const result = await feesService.getCollectionReport(actor, { groupBy: 'day' });

    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty('period', '2025-01-05');
    expect(typeof result[0].totalCollected).toBe('number');
    expect(result[0].totalCollected).toBe(300000);
    expect(typeof result[0].paymentCount).toBe('number');
    expect(result[0].paymentCount).toBe(3);
  });

  it('returns empty array when no payments in period', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await feesService.getCollectionReport(actor, { groupBy: 'month' });

    expect(result).toEqual([]);
  });
});
