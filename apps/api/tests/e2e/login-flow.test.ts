/**
 * E2E tests: Login / Auth flow.
 *
 * Uses the full Express app with mocked DB and Redis. Tests cover:
 *  - Input validation (422)
 *  - Wrong credentials (401)
 *  - Valid credentials with bcrypt hash computed at test setup (200 + accessToken)
 *  - Logout (200 + ok)
 *  - Refresh without cookie (401)
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
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

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

// ── 4. Import app, utilities, and bcryptjs after mocks are registered ─────────
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../../src/app.js';
import * as db from '../../src/config/db.js';

const app = createApp();
const mockQuery = db.query as ReturnType<typeof vi.fn>;

// ── Pre-compute bcrypt hash at cost 4 (fast for tests) ────────────────────────
// The hash is generated once before any test so it's available synchronously.
const TEST_PASSWORD = 'TestPass1!';
let TEST_PASSWORD_HASH: string;

beforeAll(async () => {
  TEST_PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 4);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Login flow E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ── Validation ───────────────────────────────────────────────────────────────
  it('POST /auth/login returns 422 when body is invalid (missing password)', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com' })
      // Zod validation via the validate() middleware returns 422 VALIDATION
      .expect(422);
  });

  it('POST /auth/register returns 422 when body is missing required fields', async () => {
    // Missing schoolName, schoolCode, adminName, password — only email supplied
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@test.com' })
      .expect(422);
  });

  // ── Wrong credentials ────────────────────────────────────────────────────────
  it('POST /auth/login returns 401 when credentials are wrong (user not found)', async () => {
    // DB returns no user row → service throws 401
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bad@test.com', password: 'WrongPassword1!' })
      .expect(401);
  });

  // ── Valid credentials with real bcrypt hash ──────────────────────────────────
  it('POST /auth/login with valid credentials returns 200 with accessToken', async () => {
    // Build a full user row with the pre-hashed password.
    const userRow = {
      id: 'user-uuid',
      school_id: 'school-uuid',
      password_hash: TEST_PASSWORD_HASH,
      is_active: true,
      full_name: 'Test Teacher',
      role_name: 'teacher',
      permissions: ['attendance:mark'],
      twofa_enabled: false,
    };

    // auth.service.login calls query() four times in the happy path:
    //   1. SELECT user
    //   2. INSERT login_history  (fire-and-forget — resolved via void)
    //   3. INSERT refresh_tokens
    //   4. UPDATE last_login_at
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow], rowCount: 1 }) // user lookup
      .mockResolvedValue({ rows: [], rowCount: 0 });            // all subsequent

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@school.edu', password: TEST_PASSWORD })
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('accessToken');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.accessToken.length).toBeGreaterThan(0);
  });

  // ── Logout ───────────────────────────────────────────────────────────────────
  it('POST /auth/logout returns 200 and body.data.ok === true', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('ok', true);
  });

  // ── Refresh without cookie ───────────────────────────────────────────────────
  it('POST /auth/refresh returns 401 when no refresh cookie present', async () => {
    // The controller throws unauthorized() when req.cookies.rt is absent.
    await request(app)
      .post('/api/v1/auth/refresh')
      .expect(401);
  });
});
