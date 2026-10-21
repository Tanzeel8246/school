/**
 * Unit tests for apps/api/src/modules/attendance/attendance.service.ts
 *
 * NOTE: attendance.service.ts does not exist yet — it will be created by
 * another agent. These tests describe the expected API contract and will
 * resolve once that file is present.
 *
 * Assumed function signatures:
 *   getSectionRoster(actor, sectionId: string, date: string)
 *     → Promise<{ data: RosterRow[] }>
 *
 *   bulkMark(actor, sectionId: string, payload: BulkMarkPayload)
 *     → Promise<{ data: { saved: number } }>
 *
 * where BulkMarkPayload = { date: string; method: string; records: AttendanceRecord[] }
 *
 * The schema file is expected at:
 *   apps/api/src/modules/attendance/attendance.schema.ts
 * exporting `bulkMarkSchema` (a Zod schema).
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
import * as attendanceService from '../src/modules/attendance/attendance.service.js';
import { HttpError } from '../src/utils/http-error.js';

const mockQuery = db.query as ReturnType<typeof vi.fn>;

// ── Mock actor that represents a logged-in teacher ────────────────────────────
const mockActor = {
  sub: 'user-uuid',
  schoolId: 'school-uuid',
  role: 'teacher',
  permissions: ['attendance:mark'],
  jti: 'jti-uuid',
};

// ── Reusable fixtures ─────────────────────────────────────────────────────────
const SECTION_ROW = {
  id: 'section-uuid',
  school_id: 'school-uuid',
  name: 'Grade 9A',
};

const ROSTER_ROWS = [
  {
    student_id: 'stu-1',
    admission_no: 'ADM001',
    full_name: 'Alice Student',
    status: 'present',
  },
  {
    student_id: 'stu-2',
    admission_no: 'ADM002',
    full_name: 'Bob Student',
    status: 'absent',
  },
  {
    student_id: 'stu-3',
    admission_no: 'ADM003',
    full_name: 'Charlie Student',
    status: null, // not yet marked
  },
];

const BULK_RECORDS = [
  { studentId: 'stu-1', status: 'present' },
  { studentId: 'stu-2', status: 'absent' },
  { studentId: 'stu-3', status: 'present' },
];

// ─────────────────────────────────────────────────────────────────────────────
describe('attendanceService.getSectionRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a list of students with their attendance status for the given date', async () => {
    // Arrange: first query validates section ownership, second returns roster rows
    mockQuery
      .mockResolvedValueOnce({ rows: [SECTION_ROW] }) // section existence check
      .mockResolvedValueOnce({ rows: ROSTER_ROWS });   // LEFT JOIN attendance query

    // Act
    const result = await attendanceService.getSectionRoster(
      mockActor,
      'section-uuid',
      '2025-01-15',
    );

    // Assert shape
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(3);

    // Each row must expose at minimum these fields
    for (const row of result.data as Record<string, unknown>[]) {
      expect(row).toHaveProperty('studentId');
      expect(row).toHaveProperty('admissionNo');
      expect(row).toHaveProperty('fullName');
      // status may be null for unmarked students
      expect(Object.prototype.hasOwnProperty.call(row, 'status')).toBe(true);
    }
  });

  it('throws notFound (404) when the section does not belong to the school', async () => {
    // Arrange: section check returns empty rows → section not found for this tenant
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Act & Assert
    await expect(
      attendanceService.getSectionRoster(mockActor, 'nonexistent-section', '2025-01-15'),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof HttpError && err.status === 404,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('attendanceService.bulkMark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts attendance records and returns the count of saved rows', async () => {
    // Arrange: section check returns valid row, upsert and absentee query return empty rows
    mockQuery
      .mockResolvedValueOnce({ rows: [SECTION_ROW] })    // section ownership check
      .mockResolvedValue({ rows: [], rowCount: 1 });     // UPSERTs and absentee query

    const payload = {
      date: '2025-01-15',
      method: 'manual',
      records: BULK_RECORDS,
    };

    // Act
    const result = await attendanceService.bulkMark(mockActor, 'section-uuid', payload);

    // Assert saved count
    expect(result.data.saved).toBe(3);
  });

  it('throws notFound (404) when section is not found in the school', async () => {
    // Arrange: section check returns empty rows
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const payload = {
      date: '2025-01-15',
      method: 'manual',
      records: BULK_RECORDS,
    };

    await expect(
      attendanceService.bulkMark(mockActor, 'bad-section', payload),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof HttpError && err.status === 404,
    );
  });

  /**
   * Validation of the records array length cap (> 200) is enforced by the Zod
   * schema before the service function is ever called. This test directly
   * exercises the schema's safeParse() to confirm the constraint is present.
   */
  it('Zod bulkMarkSchema rejects a records array with more than 200 items', async () => {
    // Dynamically import the schema — the file may not exist yet; if it doesn't
    // the test will fail with a module-not-found error, which is the correct
    // signal to the implementing agent.
    const { bulkMarkSchema } = await import(
      '../src/modules/attendance/attendance.schema.js'
    );

    const oversizedPayload = {
      date: '2025-01-15',
      method: 'manual',
      records: Array.from({ length: 201 }, (_, i) => ({
        studentId: `stu-${i}`,
        status: 'present',
      })),
    };

    const result = bulkMarkSchema.safeParse(oversizedPayload);
    expect(result.success).toBe(false);
  });
});
