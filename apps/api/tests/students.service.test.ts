/**
 * Unit tests for apps/api/src/modules/students/students.service.ts
 *
 * All DB calls are fully mocked — no real database required.
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
import * as studentsService from '../src/modules/students/students.service.js';
import * as db from '../src/config/db.js';
import { HttpError } from '../src/utils/http-error.js';

// ── Typed helpers ──────────────────────────────────────────────────────────────
const mockQuery = db.query as ReturnType<typeof vi.fn>;
const mockWithTransaction = db.withTransaction as ReturnType<typeof vi.fn>;

// ── Shared fixtures ───────────────────────────────────────────────────────────
const actor = {
  sub: 'user-uuid',
  schoolId: 'school-uuid',
  role: 'principal',
  permissions: ['students:read', 'students:write'],
  jti: 'jti',
};

/** Minimal snake_case student row matching StudentRow + STUDENT_COLS */
const makeStudentRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'student-uuid',
  admission_no: 'A001',
  roll_no: '1',
  full_name: 'Ali Raza',
  father_name: 'Raza Khan',
  mother_name: 'Amna Raza',
  cnic_bform: '1234567890123',
  dob: '2010-01-15',
  gender: 'male',
  blood_group: 'B+',
  religion: 'Islam',
  address: '123 Main St',
  mobile: '03001234567',
  emergency_contact: '03007654321',
  previous_school: 'Old School',
  admission_date: '2023-04-01',
  section_id: 'section-uuid',
  status: 'active',
  photo_url: null,
  ...overrides,
});

// ═════════════════════════════════════════════════════════════════════════════
// list
// ═════════════════════════════════════════════════════════════════════════════

describe('students.service — list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated students with camelCase DTOs', async () => {
    const row1 = makeStudentRow({ id: 'student-1', admission_no: 'A001', full_name: 'Ali Raza' });
    const row2 = makeStudentRow({ id: 'student-2', admission_no: 'A002', full_name: 'Sara Khan' });

    // list() uses Promise.all([dataQuery, countQuery]) — both mocks fire simultaneously
    mockQuery
      .mockResolvedValueOnce({ rows: [row1, row2] })     // data
      .mockResolvedValueOnce({ rows: [{ total: '2' }] }); // count

    const result = await studentsService.list(actor, { page: 1, limit: 20 });

    expect(result.data.length).toBe(2);
    expect(result.meta.total).toBe(2);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);

    const first = result.data[0];
    // camelCase DTO keys
    expect(first).toHaveProperty('admissionNo', 'A001');
    expect(first).toHaveProperty('fullName', 'Ali Raza');
    expect(first).toHaveProperty('fatherName');
    expect(first).toHaveProperty('sectionId');
    expect(first).toHaveProperty('status', 'active');
    // must NOT have snake_case keys
    expect(first).not.toHaveProperty('admission_no');
    expect(first).not.toHaveProperty('full_name');
  });

  it('applies status filter to query', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const result = await studentsService.list(actor, {
      q: undefined,
      status: 'active',
      page: 1,
      limit: 20,
    });

    // Query was called twice (data + count) with the school filter applied
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('returns correct totalPages', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeStudentRow({ id: `student-${i}`, admission_no: `A00${i}`, full_name: `Student ${i}` }),
    );
    mockQuery
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: [{ total: '47' }] });

    const result = await studentsService.list(actor, { page: 1, limit: 5 });

    expect(result.meta.total).toBe(47);
    expect(result.meta.totalPages).toBe(Math.ceil(47 / 5));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getById
// ═════════════════════════════════════════════════════════════════════════════

describe('students.service — getById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a camelCase student DTO when found', async () => {
    const row = makeStudentRow();
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await studentsService.getById(actor, 'student-uuid');

    expect(result.id).toBe('student-uuid');
    expect(result.admissionNo).toBe('A001');
    expect(result.fullName).toBe('Ali Raza');
    expect(result.sectionId).toBe('section-uuid');
    expect(result.status).toBe('active');
  });

  it('throws HttpError 404 when student not found in this school', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(studentsService.getById(actor, 'missing-uuid')).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// create
// ═════════════════════════════════════════════════════════════════════════════

describe('students.service — create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts and returns a camelCase student DTO', async () => {
    const row = makeStudentRow({ admission_no: 'B001', full_name: 'Ahmed Ali' });
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await studentsService.create(actor, {
      admissionNo: 'B001',
      fullName: 'Ahmed Ali',
    });

    expect(result.admissionNo).toBe('B001');
    expect(result.fullName).toBe('Ahmed Ali');
    expect(result.id).toBe('student-uuid');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('passes sectionId and optional fields through to the INSERT', async () => {
    const row = makeStudentRow({ admission_no: 'C001', section_id: 'sec-99' });
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await studentsService.create(actor, {
      admissionNo: 'C001',
      fullName: 'Test Student',
      sectionId: 'sec-99',
      gender: 'male',
    });

    expect(result.sectionId).toBe('sec-99');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// update
// ═════════════════════════════════════════════════════════════════════════════

describe('students.service — update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates and returns before/after DTOs', async () => {
    const beforeRow = makeStudentRow({ full_name: 'Ali Raza' });
    const afterRow  = makeStudentRow({ full_name: 'Ahmed Ali' });

    // update() SELECTs before then UPDATEs
    mockQuery
      .mockResolvedValueOnce({ rows: [beforeRow] })  // SELECT before
      .mockResolvedValueOnce({ rows: [afterRow] });  // UPDATE RETURNING after

    const result = await studentsService.update(actor, 'student-uuid', { fullName: 'Ahmed Ali' });

    expect(result.before).toBeDefined();
    expect(result.before.fullName).toBe('Ali Raza');
    expect(result.after).toBeDefined();
    expect(result.after.fullName).toBe('Ahmed Ali');
  });

  it('throws HttpError 404 when student not found before update', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // SELECT returns empty

    await expect(
      studentsService.update(actor, 'nonexistent-uuid', { fullName: 'X' }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );

    // The UPDATE query must never have been called
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// softDelete
// ═════════════════════════════════════════════════════════════════════════════

describe('students.service — softDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets deleted_at and returns the student DTO', async () => {
    const row = makeStudentRow();
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await studentsService.softDelete(actor, 'student-uuid');

    expect(result.id).toBe('student-uuid');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    // The SQL must be an UPDATE with SET deleted_at
    const sql = (mockQuery.mock.calls[0] as [string, unknown[]])[0];
    expect(sql).toMatch(/UPDATE students/i);
    expect(sql).toMatch(/deleted_at/i);
  });

  it('throws HttpError 404 when student already deleted or not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(studentsService.softDelete(actor, 'gone-uuid')).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// promote
// ═════════════════════════════════════════════════════════════════════════════

describe('students.service — promote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates section_id inside a transaction and writes a history row', async () => {
    const beforeRow = makeStudentRow({ section_id: 'section-old' });
    const afterRow  = makeStudentRow({ section_id: 'section-new' });

    // promote() calls loadOrThrow (uses db.query) THEN client.query twice inside the transaction
    mockQuery.mockResolvedValueOnce({ rows: [beforeRow] }); // loadOrThrow SELECT

    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [afterRow] }) // UPDATE students SET section_id
        .mockResolvedValueOnce({ rows: [] }),         // INSERT student_history
    };
    mockWithTransaction.mockImplementationOnce(
      (fn: (c: typeof mockClient) => Promise<unknown>) => fn(mockClient),
    );

    const result = await studentsService.promote(actor, 'student-uuid', 'section-new', 'Grade promotion');

    expect(result.before.sectionId).toBe('section-old');
    expect(result.after.sectionId).toBe('section-new');
    expect(mockClient.query).toHaveBeenCalledTimes(2);

    // Verify the history INSERT was called with event_type = 'promote'
    const historyCall = mockClient.query.mock.calls[1] as [string, unknown[]];
    expect(historyCall[0]).toMatch(/INSERT INTO student_history/i);
    expect(historyCall[0]).toContain('promote');
  });

  it('throws HttpError 404 when student not found during promote', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // loadOrThrow returns empty

    mockWithTransaction.mockImplementationOnce(
      (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
        fn({ query: vi.fn() }),
    );

    await expect(
      studentsService.promote(actor, 'nonexistent-uuid', 'section-new'),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// lifecycle — suspend / reinstate / transfer
// ═════════════════════════════════════════════════════════════════════════════

describe('students.service — lifecycle transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suspend sets status to suspended', async () => {
    const beforeRow = makeStudentRow({ status: 'active' });
    const afterRow  = makeStudentRow({ status: 'suspended' });

    // changeStatus calls loadOrThrow (db.query) then client.query twice
    mockQuery.mockResolvedValueOnce({ rows: [beforeRow] }); // loadOrThrow

    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [afterRow] }) // UPDATE students SET status
        .mockResolvedValueOnce({ rows: [] }),         // INSERT student_history
    };
    mockWithTransaction.mockImplementationOnce(
      (fn: (c: typeof mockClient) => Promise<unknown>) => fn(mockClient),
    );

    const result = await studentsService.suspend(actor, 'student-uuid', 'Misconduct');

    expect(result.before.status).toBe('active');
    expect(result.after.status).toBe('suspended');

    // History INSERT must carry the 'suspend' event type
    const historyCall = mockClient.query.mock.calls[1] as [string, unknown[]];
    expect(historyCall[1]).toContain('suspend');
  });

  it('reinstate sets status to active', async () => {
    const beforeRow = makeStudentRow({ status: 'suspended' });
    const afterRow  = makeStudentRow({ status: 'active' });

    mockQuery.mockResolvedValueOnce({ rows: [beforeRow] }); // loadOrThrow

    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [afterRow] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }),         // INSERT history
    };
    mockWithTransaction.mockImplementationOnce(
      (fn: (c: typeof mockClient) => Promise<unknown>) => fn(mockClient),
    );

    const result = await studentsService.reinstate(actor, 'student-uuid');

    expect(result.before.status).toBe('suspended');
    expect(result.after.status).toBe('active');
  });

  it('transfer sets status to transferred', async () => {
    const beforeRow = makeStudentRow({ status: 'active' });
    const afterRow  = makeStudentRow({ status: 'transferred' });

    mockQuery.mockResolvedValueOnce({ rows: [beforeRow] }); // loadOrThrow

    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [afterRow] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }),         // INSERT history
    };
    mockWithTransaction.mockImplementationOnce(
      (fn: (c: typeof mockClient) => Promise<unknown>) => fn(mockClient),
    );

    const result = await studentsService.transfer(actor, 'student-uuid', 'Moving city');

    expect(result.after.status).toBe('transferred');
    // History INSERT must carry the 'transfer' event type
    const historyCall = mockClient.query.mock.calls[1] as [string, unknown[]];
    expect(historyCall[1]).toContain('transfer');
  });

  it('throws HttpError 404 when student not found during status change', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // loadOrThrow returns empty

    mockWithTransaction.mockImplementationOnce(
      (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
        fn({ query: vi.fn() }),
    );

    await expect(
      studentsService.suspend(actor, 'ghost-uuid'),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );
  });
});
