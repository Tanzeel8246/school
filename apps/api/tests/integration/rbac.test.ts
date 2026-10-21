/**
 * Integration tests: RBAC permission enforcement.
 *
 * The real Express app (createApp()) is used so middleware wiring is exercised
 * end-to-end. All DB / Redis / queue dependencies are mocked so no real
 * Postgres or Redis instance is required.
 *
 * IMPORTANT: env vars must be set before any module that transitively loads
 * env.ts is imported. The assignments below fire before any import because
 * vi.mock() is hoisted but top-level code in THIS file runs before any
 * transitive module load.
 */

// ── 1. Set required env vars before any import that loads env.ts ─────────────
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

// ── Helper: produce a signed access token for a given role + permissions ──────
function makeToken(role: string, permissions: string[], schoolId = 'school-A'): string {
  return signAccessToken({ sub: 'user-uuid', schoolId, role, permissions });
}

// ── Typed reference to the db.query mock so we can reconfigure per-test ───────
const mockQuery = db.query as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
describe('RBAC — permission enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all queries return empty result sets (safe fallback for list endpoints).
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ── No token ────────────────────────────────────────────────────────────────
  it('GET /api/v1/students returns 401 when no token provided', async () => {
    await request(app)
      .get('/api/v1/students')
      .expect(401);
  });

  // ── Token present but missing the required permission ───────────────────────
  it('GET /api/v1/students returns 403 when token lacks students:read', async () => {
    const token = makeToken('teacher', ['attendance:mark']);
    await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  // ── Token has the required permission → endpoint is accessible ──────────────
  it('GET /api/v1/students returns 200 when token has students:read', async () => {
    const token = makeToken('principal', ['students:read']);
    // The list handler issues two queries: data + count. Both return empty rows.
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`);

    // Should be allowed through — response may be 200 with paginated data shape.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  // ── Partial permissions: read but not write ──────────────────────────────────
  it('POST /api/v1/students returns 403 when token has students:read but not students:write', async () => {
    const token = makeToken('teacher', ['students:read']);
    await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  // ── Wildcard permission grants all access ────────────────────────────────────
  it('wildcard permission * grants access to GET /api/v1/students', async () => {
    const token = makeToken('super_admin', ['*']);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  // ── Accounting journals: requires accounting:post ────────────────────────────
  it('POST /api/v1/accounting/journals returns 403 when token lacks accounting:post', async () => {
    const token = makeToken('teacher', ['students:read']);
    await request(app)
      .post('/api/v1/accounting/journals')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  // ── Reports: requires reports:read ──────────────────────────────────────────
  it('GET /api/v1/reports/students returns 403 when token lacks reports:read', async () => {
    const token = makeToken('teacher', ['students:read']);
    await request(app)
      .get('/api/v1/reports/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
