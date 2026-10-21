/**
 * Unit tests for apps/api/src/modules/academics/academics.service.ts
 *
 * NOTE: academics.service.ts does not exist yet — it will be created by
 * another agent. These tests describe the expected API contract and will
 * resolve once that file is present.
 *
 * Assumed function signatures:
 *
 *   listSessions(actor, opts: { page: number; limit: number })
 *     → Promise<{ data: SessionDTO[]; meta: { total: number; page: number; limit: number } }>
 *
 *   createSession(actor, input: { name: string; startDate: string; endDate: string })
 *     → Promise<SessionDTO>
 *     where SessionDTO = { id: string; name: string; startDate: string; endDate: string; isActive: boolean }
 *
 *   updateSession(actor, sessionId: string, patch: Partial<{ name: string; isActive: boolean }>)
 *     → Promise<SessionDTO>
 *
 *   deleteSession(actor, sessionId: string)
 *     → Promise<void>
 *
 *   createClass(actor, input: { sessionId: string; name: string; level: number })
 *     → Promise<ClassDTO>
 *     where ClassDTO = { id: string; sessionId: string; name: string; level: number }
 */

// ── 1. Set required env vars before anything loads env.ts ────────────────────
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(32);
process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(32);
process.env['NODE_ENV'] = 'test';

// ── 2. Vitest imports ─────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── 3. Mock the database before the service is imported ──────────────────────
vi.mock('../src/config/db.js', () => ({
  query: vi.fn(),
  withTransaction: vi.fn((fn: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
    fn({ query: vi.fn() }),
  ),
}));

// ── 4. Import mocked db and the service under test ────────────────────────────
import * as db from '../src/config/db.js';
import * as academicsService from '../src/modules/academics/academics.service.js';
import { HttpError } from '../src/utils/http-error.js';

const mockQuery = db.query as ReturnType<typeof vi.fn>;
const mockWithTransaction = db.withTransaction as ReturnType<typeof vi.fn>;

// ── Mock actor representing a principal with academic read/write permissions ──
const mockActor = {
  sub: 'user-uuid',
  schoolId: 'school-uuid',
  role: 'principal',
  permissions: ['academics:read', 'academics:write'],
  jti: 'jti-uuid',
};

// ── Reusable fixtures ─────────────────────────────────────────────────────────
const SESSION_ROW = {
  id: 'session-uuid',
  school_id: 'school-uuid',
  name: '2025-26',
  start_date: '2025-08-01',
  end_date: '2026-06-30',
  is_active: false,
  deleted_at: null,
};

const CLASS_ROW = {
  id: 'class-uuid',
  session_id: 'session-uuid',
  school_id: 'school-uuid',
  name: 'Grade 9',
  level: 9,
};

// ─────────────────────────────────────────────────────────────────────────────
describe('academicsService.listSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated sessions and a meta.total count for the school', async () => {
    // Arrange: first query returns data rows, second (or combined) returns count
    mockQuery
      .mockResolvedValueOnce({ rows: [SESSION_ROW, { ...SESSION_ROW, id: 'session-uuid-2', name: '2024-25' }] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] }); // total count query

    // Act
    const result = await academicsService.listSessions(mockActor, { page: 1, limit: 10 });

    // Assert paginated shape
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.meta).toBeDefined();
    expect(typeof result.meta.total).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('academicsService.createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a new academic session and returns the DTO with isActive defaulting to false', async () => {
    // Arrange: INSERT ... RETURNING returns the new session row
    mockQuery.mockResolvedValueOnce({ rows: [SESSION_ROW] });

    // Act
    const result = await academicsService.createSession(mockActor, {
      name: '2025-26',
      startDate: '2025-08-01',
      endDate: '2026-06-30',
    });

    // Assert DTO shape
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.name).toBe('2025-26');
    // Newly created sessions should not be active by default
    expect(result.isActive).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('academicsService.updateSession — activating a session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a transaction and deactivates all other sessions before activating the target', async () => {
    // Arrange: provide mock query for 'beforeRows' and a mock transaction client
    mockQuery.mockResolvedValueOnce({ rows: [SESSION_ROW] });

    const txClientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })   // UPDATE others → is_active=false
      .mockResolvedValueOnce({ rows: [{ ...SESSION_ROW, is_active: true }] }); // UPDATE target → is_active=true

    mockWithTransaction.mockImplementation(
      (fn: (client: { query: typeof txClientQuery }) => Promise<unknown>) =>
        fn({ query: txClientQuery }),
    );

    // Act
    await academicsService.updateSession(mockActor, 'session-uuid', { isActive: true });

    // Assert that withTransaction was used (not bare query)
    expect(mockWithTransaction).toHaveBeenCalledOnce();

    // The first transactional query must deactivate other sessions
    const firstCallSql = txClientQuery.mock.calls[0]?.[0] as string | undefined;
    expect(firstCallSql).toBeDefined();
    expect(firstCallSql!.toLowerCase()).toMatch(/update.*academic_sessions/);
    expect(firstCallSql!.toLowerCase()).toMatch(/is_active\s*=\s*(false|'false'|\$\d)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('academicsService.deleteSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws badRequest (400) when the session has associated classes', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 3 }] }); // class count check

    // Act & Assert
    await expect(
      academicsService.deleteSession(mockActor, 'session-uuid'),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof HttpError && err.status === 400,
    );
  });

  it('hard-deletes the session when it has no classes', async () => {
    // Arrange: class count = 0, then DELETE returns the row
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })  // class count → empty
      .mockResolvedValueOnce({ rows: [SESSION_ROW], rowCount: 1 });  // DELETE RETURNING

    // Act & Assert: should resolve without throwing
    await expect(
      academicsService.deleteSession(mockActor, 'session-uuid'),
    ).resolves.not.toThrow();

    // Verify DELETE was called
    const deleteCalls = mockQuery.mock.calls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'string' &&
        args[0].toLowerCase().includes('delete from academic_sessions'),
    );
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('academicsService.createClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a class and returns the DTO when the session belongs to the school', async () => {
    // Arrange: session ownership check returns the session, then INSERT returns new class
    mockQuery
      .mockResolvedValueOnce({ rows: [SESSION_ROW] })  // session ownership check
      .mockResolvedValueOnce({ rows: [CLASS_ROW] });   // INSERT class RETURNING

    // Act
    const result = await academicsService.createClass(mockActor, {
      sessionId: 'session-uuid',
      name: 'Grade 9',
      level: 9,
    });

    // Assert DTO shape
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Grade 9');
    expect(result.level).toBe(9);
  });

  it('throws notFound (404) when the sessionId does not belong to the school', async () => {
    // Arrange: session ownership check returns no rows
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Act & Assert
    await expect(
      academicsService.createClass(mockActor, {
        sessionId: 'alien-session-uuid',
        name: 'Grade 10',
        level: 10,
      }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof HttpError && err.status === 404,
    );
  });
});
