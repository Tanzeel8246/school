/**
 * E2E tests: Attendance marking flow.
 *
 * Exercises the POST /attendance/section/:sectionId/bulk endpoint and related
 * GET endpoints through the full Express middleware stack.
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
const mockQuery = db.query as ReturnType<typeof vi.fn>;

// ── Helper: produce a signed access token ────────────────────────────────────
function makeToken(role: string, permissions: string[], schoolId = 'school-A'): string {
  return signAccessToken({ sub: 'user-uuid', schoolId, role, permissions });
}

// Valid bulk mark body (meets bulkMarkSchema requirements)
const VALID_BULK_BODY = {
  date: '2025-01-15',
  method: 'manual',
  records: [
    { studentId: '00000000-0000-0000-0000-000000000001', status: 'present' },
  ],
};

const SECTION_ID = '00000000-0000-0000-0000-000000000010';

// ─────────────────────────────────────────────────────────────────────────────
describe('Attendance marking E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ── Input validation ─────────────────────────────────────────────────────────
  it('POST /api/v1/attendance/section/:sectionId/bulk returns 422 when body is invalid (missing date)', async () => {
    const token = makeToken('teacher', ['attendance:mark']);

    // Send body without the required 'date' field
    await request(app)
      .post(`/api/v1/attendance/section/${SECTION_ID}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'manual', records: [{ studentId: '00000000-0000-0000-0000-000000000001', status: 'present' }] })
      .expect(422);
  });

  // ── Section not in school → 404 ──────────────────────────────────────────────
  it('POST /api/v1/attendance/section/:sectionId/bulk returns 404 when section not in school', async () => {
    const token = makeToken('teacher', ['attendance:mark']);

    // The attendance service checks that the section belongs to the actor's school.
    // With the DB mock returning empty rows the section check fails → 404.
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await request(app)
      .post(`/api/v1/attendance/section/${SECTION_ID}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BULK_BODY)
      .expect(404);
  });

  // ── Permission gate for GET ──────────────────────────────────────────────────
  it('GET /api/v1/attendance/section/:sectionId returns 403 when token lacks students:read', async () => {
    // GET /attendance/section/:id requires students:read (see attendance.routes.ts)
    const token = makeToken('driver', ['transport:read']);

    await request(app)
      .get(`/api/v1/attendance/section/${SECTION_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  // ── Authorised summary endpoint ──────────────────────────────────────────────
  it('GET /api/v1/attendance/summary returns 200 for authorised user', async () => {
    const token = makeToken('principal', ['students:read']);

    // Mock returns an empty summary (getDailySummary will produce an empty response)
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get('/api/v1/attendance/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });
});
