/**
 * Integration tests: health endpoints and /auth/me.
 *
 * Exercises the /health route (no auth) and GET /api/v1/auth/me (requires token).
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
import { describe, it, expect, vi } from 'vitest';

// ── 3. Mock all heavy dependencies BEFORE importing the app ──────────────────
vi.mock('../../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  withTransaction: vi.fn((fn: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
    fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }),
  ),
  // pool.query is called by the deep health check (SELECT 1).
  pool: {
    end: vi.fn(),
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 }),
  },
}));

vi.mock('../../src/queue/connection.js', () => ({
  // redisConnection.ping() is called by the deep health check.
  redisConnection: { quit: vi.fn(), on: vi.fn(), ping: vi.fn().mockResolvedValue('PONG') },
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
import { signAccessToken } from '../../src/utils/jwt.js';

const app = createApp();

// ── Helper: produce a signed access token ────────────────────────────────────
function makeToken(role: string, permissions: string[], schoolId = 'school-A'): string {
  return signAccessToken({ sub: 'user-uuid', schoolId, role, permissions });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Health endpoints', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body).toHaveProperty('status');
    expect(res.body.status).toBe('ok');
  });

  it('GET /health returns JSON content type', async () => {
    await request(app)
      .get('/health')
      .expect('Content-Type', /json/);
  });

  it('GET /api/v1/auth/me returns 401 without token', async () => {
    await request(app)
      .get('/api/v1/auth/me')
      .expect(401);
  });

  it('GET /api/v1/auth/me returns claims when valid token provided', async () => {
    const token = makeToken('principal', ['students:read']);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // The /me handler returns the decoded JWT claims under data
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('role', 'principal');
    expect(res.body.data).toHaveProperty('sub', 'user-uuid');
    expect(res.body.data).toHaveProperty('schoolId', 'school-A');
  });
});
