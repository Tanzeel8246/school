/**
 * E2E tests: Fee payment flow.
 *
 * Exercises POST /fees/invoices/:id/pay and GET /fees/defaulters through the
 * full Express middleware stack.
 *
 * The fee payment service uses withTransaction internally, so per-test
 * reconfiguration of that mock is required for invoice-specific scenarios.
 *
 * NOTE: env vars must be set before any transitive load of env.ts.
 */

// ── 1. Set required env vars ──────────────────────────────────────────────────
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(32);
process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(32);
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['NODE_ENV'] = 'test';

// ── 2. Vitest imports ─────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── 3. Mock all heavy dependencies BEFORE importing the app ──────────────────
vi.mock('../../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  withTransaction: vi.fn((fn: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
    fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }),
  ),
  pool: { end: vi.fn() },
}));

vi.mock('../../src/queue/connection.js', () => ({
  redisConnection: { quit: vi.fn(), on: vi.fn() },
  closeRedis: vi.fn(),
}));

vi.mock('../../src/queue/comms.queue.js', () => ({
  commsQueue: {
    add: vi.fn(),
    getWaitingCount: vi.fn().mockResolvedValue(0),
    getActiveCount: vi.fn().mockResolvedValue(0),
    getCompletedCount: vi.fn().mockResolvedValue(0),
    getFailedCount: vi.fn().mockResolvedValue(0),
  },
}));

// ── 4. Import app and utilities after mocks are registered ───────────────────
import request from 'supertest';
import { createApp } from '../../src/app.js';
import * as db from '../../src/config/db.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const app = createApp();

// ── Typed references to the db mocks ─────────────────────────────────────────
const mockQuery = db.query as ReturnType<typeof vi.fn>;
const mockWithTransaction = db.withTransaction as ReturnType<typeof vi.fn>;

// ── Helper: produce a signed access token ────────────────────────────────────
function makeToken(role: string, permissions: string[], schoolId = 'school-A'): string {
  return signAccessToken({ sub: 'user-uuid', schoolId, role, permissions });
}

// A deterministic UUID used as the invoice ID in all tests below
const INVOICE_ID = '00000000-0000-0000-0000-000000000042';

// ─────────────────────────────────────────────────────────────────────────────
describe('Fee payment E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default safe fallbacks
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockWithTransaction.mockImplementation(
      (fn: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
        fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }),
    );
  });

  // ── Permission gate ──────────────────────────────────────────────────────────
  it('POST /api/v1/fees/invoices/:id/pay returns 403 without fees:collect permission', async () => {
    const token = makeToken('teacher', ['students:read']);

    await request(app)
      .post(`/api/v1/fees/invoices/${INVOICE_ID}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, method: 'cash' })
      .expect(403);
  });

  // ── Invoice not found ────────────────────────────────────────────────────────
  it('POST /api/v1/fees/invoices/:id/pay returns 404 when invoice not found', async () => {
    const token = makeToken('accountant', ['fees:collect']);

    // payInvoice uses withTransaction; the inner client.query FOR UPDATE returns
    // no rows → service throws notFound('Invoice not found') → 404.
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
    mockWithTransaction.mockImplementationOnce(
      (fn: (client: typeof mockClient) => Promise<unknown>) => fn(mockClient),
    );

    await request(app)
      .post(`/api/v1/fees/invoices/${INVOICE_ID}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 50000, method: 'cash' })
      .expect(404);
  });

  // ── Overpayment → 422 ────────────────────────────────────────────────────────
  it('POST /api/v1/fees/invoices/:id/pay returns 422 when amount exceeds outstanding balance', async () => {
    const token = makeToken('accountant', ['fees:collect']);

    // Invoice: total = 500000 paisa, paid = 0, status = 'unpaid'
    // Sending amount = 600000 (overpayment) → unprocessable
    const invoiceRow = {
      id: INVOICE_ID,
      total: '500000',
      paid: '0',
      status: 'unpaid',
    };

    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [invoiceRow], rowCount: 1 }), // FOR UPDATE
    };
    mockWithTransaction.mockImplementationOnce(
      (fn: (client: typeof mockClient) => Promise<unknown>) => fn(mockClient),
    );

    await request(app)
      .post(`/api/v1/fees/invoices/${INVOICE_ID}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 600000, method: 'cash' })
      .expect(422);
  });

  // ── Defaulters report ────────────────────────────────────────────────────────
  it('GET /api/v1/fees/defaulters returns 200 for accountant with fees:read', async () => {
    const token = makeToken('accountant', ['fees:read']);

    // Both data and count queries return empty results
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get('/api/v1/fees/defaulters')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('meta');
  });
});
