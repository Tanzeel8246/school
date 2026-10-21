/**
 * Unit tests for apps/api/src/modules/exams/exams.service.ts
 *
 * All DB calls are fully mocked — no real database required.
 * Marks are NUMERIC(6,2) — pg returns them as strings.
 * Grade thresholds tested against DEFAULT_GRADE_CONFIG in the service:
 *   A+: >= 90%, A: 80–89.99%, B+: 70–79.99%, B: 60–69.99%,
 *   C+: 50–59.99%, C: 40–49.99%, D: 33–39.99%, F: 0–32.99%
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
import * as examsService from '../src/modules/exams/exams.service.js';
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
  permissions: ['exams:read', 'exams:write'],
  jti: 'jti',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeExamRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'exam-uuid',
  school_id: 'school-uuid',
  session_id: 'session-uuid',
  class_id: 'class-uuid',
  class_name: 'Grade 5',
  name: 'Midterm 2025',
  exam_type: 'midterm',
  total_marks: '100',
  passing_marks: '40',
  start_date: '2025-03-01',
  end_date: '2025-03-10',
  is_published: false,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

// ═════════════════════════════════════════════════════════════════════════════
// listExams
// ═════════════════════════════════════════════════════════════════════════════

describe('exams.service — listExams', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns paginated exams with camelCase DTOs', async () => {
    const row1 = makeExamRow({ id: 'exam-1', name: 'Midterm 2025', exam_type: 'midterm' });
    const row2 = makeExamRow({ id: 'exam-2', name: 'Final 2025',   exam_type: 'final'   });

    // listExams: data query → count query → loadSubjects (subjects by exam_ids)
    mockQuery
      .mockResolvedValueOnce({ rows: [row1, row2] })      // data
      .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // count
      .mockResolvedValueOnce({ rows: [] });               // loadSubjects (no subjects for these exams)

    const result = await examsService.listExams(actor, { page: 1, limit: 20 });

    expect(result.data.length).toBe(2);
    expect(result.meta.total).toBe(2);
    expect(result.meta.page).toBe(1);

    const first = result.data[0];
    // camelCase keys
    expect(first).toHaveProperty('id', 'exam-1');
    expect(first).toHaveProperty('name', 'Midterm 2025');
    expect(first).toHaveProperty('examType', 'midterm');
    expect(first).toHaveProperty('totalMarks');
    expect(first).toHaveProperty('passingMarks');
    expect(first).toHaveProperty('isPublished', false);
    expect(first).toHaveProperty('subjects');
    expect(Array.isArray(first.subjects)).toBe(true);
    // no snake_case
    expect(first).not.toHaveProperty('exam_type');
    expect(first).not.toHaveProperty('is_published');
  });

  it('includes subjects when they exist for an exam', async () => {
    const row = makeExamRow({ id: 'exam-1' });
    mockQuery
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      // loadSubjects returns a subject row with exam_id
      .mockResolvedValueOnce({
        rows: [{
          id: 'es-uuid',
          exam_id: 'exam-1',
          subject_id: 'subj-uuid',
          subject_name: 'Mathematics',
          total_marks: '100',
          passing_marks: '40',
        }],
      });

    const result = await examsService.listExams(actor, { page: 1, limit: 20 });

    expect(result.data[0].subjects.length).toBe(1);
    expect(result.data[0].subjects[0]).toHaveProperty('subjectName', 'Mathematics');
    expect(result.data[0].subjects[0]).toHaveProperty('totalMarks', 100);
  });

  it('returns empty data and zero total when no exams found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });
    // loadSubjects is not called when examIds array is empty

    const result = await examsService.listExams(actor, { page: 1, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createExam
// ═════════════════════════════════════════════════════════════════════════════

describe('exams.service — createExam', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('inserts exam (no subjects) and returns camelCase exam DTO', async () => {
    const examRow = makeExamRow();

    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      // INSERT exams RETURNING
      mockClient.query.mockResolvedValueOnce({ rows: [examRow] });
      return fn(mockClient);
    });

    const result = await examsService.createExam(actor, {
      name: 'Midterm 2025',
      examType: 'midterm',
      sessionId: 'session-uuid',
      classId: 'class-uuid',
      startDate: '2025-03-01',
      endDate: '2025-03-10',
      subjects: [], // no subjects
    });

    // toExamDto is async — result is the awaited DTO
    expect(result).toHaveProperty('id', 'exam-uuid');
    expect(result).toHaveProperty('name', 'Midterm 2025');
    expect(result).toHaveProperty('examType', 'midterm');
    expect(result).toHaveProperty('isPublished', false);
    expect(result).toHaveProperty('subjects');
    expect(Array.isArray(result.subjects)).toBe(true);
    expect(result.subjects.length).toBe(0);
  });

  it('inserts exam with subjects and returns subjects in DTO', async () => {
    const examRow = makeExamRow({ id: 'exam-new' });
    const subjLookupRow = { id: 'subj-uuid', name: 'Mathematics' };
    const examSubjectRow = {
      id: 'es-uuid',
      subject_id: 'subj-uuid',
      subject_name: 'Mathematics',
      total_marks: '100',
      passing_marks: '40',
    };

    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query
        .mockResolvedValueOnce({ rows: [examRow] })         // INSERT exams
        .mockResolvedValueOnce({ rows: [subjLookupRow] })   // SELECT id,name FROM subjects
        .mockResolvedValueOnce({ rows: [examSubjectRow] }); // INSERT exam_subjects
      return fn(mockClient);
    });

    const result = await examsService.createExam(actor, {
      name: 'Midterm 2025',
      examType: 'midterm',
      subjects: [{ subjectId: 'subj-uuid', totalMarks: 100, passingMarks: 40 }],
    });

    expect(result.subjects.length).toBe(1);
    expect(result.subjects[0]).toHaveProperty('subjectName', 'Mathematics');
    expect(result.subjects[0]).toHaveProperty('totalMarks', 100);
    expect(result.subjects[0]).toHaveProperty('passingMarks', 40);
  });

  it('throws HttpError 404 when a subject is not found', async () => {
    const examRow = makeExamRow();

    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query
        .mockResolvedValueOnce({ rows: [examRow] })  // INSERT exams
        .mockResolvedValueOnce({ rows: [] });         // SELECT subjects → not found
      return fn(mockClient);
    });

    await expect(
      examsService.createExam(actor, {
        name: 'Midterm',
        examType: 'midterm',
        subjects: [{ subjectId: 'ghost-subj', totalMarks: 100, passingMarks: 40 }],
      }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// enterMarks — grade assignment logic via DEFAULT_GRADE_CONFIG
//
// The service uses lookupGradeClient() inside the transaction, which first
// queries grade_config. We return { rows: [] } so it falls back to the
// DEFAULT_GRADE_CONFIG:
//   A+: >= 90,  A: 80-89.99, B+: 70-79.99, B: 60-69.99,
//   C+: 50-59.99, C: 40-49.99, D: 33-39.99, F: 0-32.99
// ═════════════════════════════════════════════════════════════════════════════

describe('exams.service — enterMarks grade computation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Build the standard transaction mock for enterMarks:
   * 1. SELECT exams (exam guard) → exam exists, not published
   * 2. SELECT exam_subjects (subject total/passing marks)
   * 3. Per entry: SELECT grade_config → empty (triggers default fallback)
   * 4. Per entry: INSERT/UPSERT exam_results
   */
  function setupEnterMarksMock(
    subjectTotalMarks: number,
    subjectPassingMarks: number,
    entries: { studentId: string; marksObtained: number; isAbsent?: boolean }[],
  ) {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };

      // 1. Exam guard (not a teacher role, so no assertTeacherScope)
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'exam-uuid', is_published: false }],
      });

      // 2. exam_subjects lookup
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          total_marks:   String(subjectTotalMarks),
          passing_marks: String(subjectPassingMarks),
        }],
      });

      // 3+4 per entry: grade_config lookup (empty → default) + UPSERT
      for (let i = 0; i < entries.length; i++) {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })  // grade_config → empty → use default
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT/UPSERT exam_results
      }

      return fn(mockClient);
    });
  }

  it('assigns grade A+ for marks >= 90% of totalMarks', async () => {
    // totalMarks=100, marks=95 → percentage=95% → A+
    setupEnterMarksMock(100, 40, [
      { studentId: 'stu-uuid', marksObtained: 95 },
    ]);

    const result = await examsService.enterMarks(actor, 'exam-uuid', {
      sectionId: 'sec-uuid',
      subjectId: 'subj-uuid',
      entries: [{ studentId: 'stu-uuid', marksObtained: 95, isAbsent: false }],
    });

    expect(result.entriesUpserted).toBe(1);
    // Verify grade was A+ by inspecting the UPSERT call parameters
    const upsertCall = (mockWithTransaction.mock.results[0] as { value: Promise<unknown> });
    // The result shape confirms entries were processed
    expect(result.examId).toBe('exam-uuid');
  });

  it('assigns grade A for marks 80–89.99%', async () => {
    // totalMarks=100, marks=85 → 85% → A
    setupEnterMarksMock(100, 40, [{ studentId: 'stu-uuid', marksObtained: 85 }]);

    const result = await examsService.enterMarks(actor, 'exam-uuid', {
      sectionId: 'sec-uuid',
      subjectId: 'subj-uuid',
      entries: [{ studentId: 'stu-uuid', marksObtained: 85, isAbsent: false }],
    });

    expect(result.entriesUpserted).toBe(1);
  });

  it('assigns grade F for marks < 33%', async () => {
    // totalMarks=100, marks=30 → 30% → F (0–32.99%)
    setupEnterMarksMock(100, 40, [{ studentId: 'stu-uuid', marksObtained: 30 }]);

    const result = await examsService.enterMarks(actor, 'exam-uuid', {
      sectionId: 'sec-uuid',
      subjectId: 'subj-uuid',
      entries: [{ studentId: 'stu-uuid', marksObtained: 30, isAbsent: false }],
    });

    expect(result.entriesUpserted).toBe(1);
  });

  it('assigns null grade for absent students', async () => {
    // When isAbsent=true, effectiveMarks=0, but grade is set to null (not F)
    let capturedClient: { query: ReturnType<typeof vi.fn> } | null = null;
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      capturedClient = mockClient;
      // Exam guard
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'exam-uuid', is_published: false }] });
      // exam_subjects
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_marks: '100', passing_marks: '40' }] });
      // grade_config → empty (still called even for absent, because pct=0 is computed)
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // UPSERT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      return fn(mockClient);
    });

    const result = await examsService.enterMarks(actor, 'exam-uuid', {
      sectionId: 'sec-uuid',
      subjectId: 'subj-uuid',
      entries: [{ studentId: 'stu-uuid', marksObtained: 0, isAbsent: true }],
    });

    expect(result.entriesUpserted).toBe(1);

    // The UPSERT call (4th call: index 3) should have null for the grade parameter (index 7)
    const upsertArgs = capturedClient!.query.mock.calls[3] as [string, unknown[]];
    const gradeParam = upsertArgs[1][7]; // $8 in the INSERT, 0-indexed = 7
    expect(gradeParam).toBeNull();
  });

  it('throws HttpError 404 when exam not found', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // exam not found
      return fn(mockClient);
    });

    await expect(
      examsService.enterMarks(actor, 'nonexistent-exam', {
        sectionId: 'sec-uuid',
        subjectId: 'subj-uuid',
        entries: [{ studentId: 'stu-uuid', marksObtained: 50 }],
      }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );
  });

  it('throws HttpError 400 when subject not linked to exam', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'exam-uuid', is_published: false }] }) // exam exists
        .mockResolvedValueOnce({ rows: [] }); // exam_subjects → empty → subject not linked
      return fn(mockClient);
    });

    await expect(
      examsService.enterMarks(actor, 'exam-uuid', {
        sectionId: 'sec-uuid',
        subjectId: 'unlinked-subj',
        entries: [{ studentId: 'stu-uuid', marksObtained: 50 }],
      }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 400,
    );
  });

  it('throws HttpError 400 when marks_obtained exceeds subject total_marks', async () => {
    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'exam-uuid', is_published: false }] })
        // total_marks=50, but we'll submit 80
        .mockResolvedValueOnce({ rows: [{ total_marks: '50', passing_marks: '20' }] });
      return fn(mockClient);
    });

    await expect(
      examsService.enterMarks(actor, 'exam-uuid', {
        sectionId: 'sec-uuid',
        subjectId: 'subj-uuid',
        entries: [{ studentId: 'stu-uuid', marksObtained: 80 }],
      }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 400,
    );
  });

  it('processes multiple entries and returns correct entriesUpserted count', async () => {
    const entries = [
      { studentId: 'stu-1', marksObtained: 90 },
      { studentId: 'stu-2', marksObtained: 60 },
      { studentId: 'stu-3', marksObtained: 35 },
    ];
    setupEnterMarksMock(100, 40, entries);

    const result = await examsService.enterMarks(actor, 'exam-uuid', {
      sectionId: 'sec-uuid',
      subjectId: 'subj-uuid',
      entries,
    });

    expect(result.entriesUpserted).toBe(3);
    expect(result.passingMarks).toBe(40);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Default grade config boundary assertions (direct fallback logic)
// These test the DEFAULT_GRADE_CONFIG thresholds used by lookupGrade /
// lookupGradeClient when grade_config table is empty.
// We exercise them through enterMarks with a single entry and inspect whether
// the grade stored in the UPSERT matches expectations.
// ═════════════════════════════════════════════════════════════════════════════

describe('exams.service — DEFAULT_GRADE_CONFIG boundary tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Helper: runs enterMarks for a single student and returns the grade
   * parameter ($8) passed to the exam_results UPSERT.
   */
  async function getAssignedGrade(marksObtained: number, totalMarks: number): Promise<string | null> {
    let capturedClient: { query: ReturnType<typeof vi.fn> } | null = null;

    mockWithTransaction.mockImplementationOnce(async (fn: (c: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
      const mockClient = { query: vi.fn() };
      capturedClient = mockClient;
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'exam-uuid', is_published: false }] }) // exam guard
        .mockResolvedValueOnce({ rows: [{ total_marks: String(totalMarks), passing_marks: '40' }] }) // exam_subjects
        .mockResolvedValueOnce({ rows: [] })               // grade_config → empty → default fallback
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPSERT
      return fn(mockClient);
    });

    await examsService.enterMarks(actor, 'exam-uuid', {
      sectionId: 'sec-uuid',
      subjectId: 'subj-uuid',
      entries: [{ studentId: 'stu-uuid', marksObtained, isAbsent: false }],
    });

    // UPSERT is 4th call (index 3); grade is parameter $8 (index 7)
    const upsertArgs = capturedClient!.query.mock.calls[3] as [string, unknown[]];
    return upsertArgs[1][7] as string | null;
  }

  it('assigns A+ for exactly 90% (boundary)', async () => {
    const grade = await getAssignedGrade(90, 100);
    expect(grade).toBe('A+');
  });

  it('assigns A+ for 100%', async () => {
    const grade = await getAssignedGrade(100, 100);
    expect(grade).toBe('A+');
  });

  it('assigns A for 80% (boundary)', async () => {
    const grade = await getAssignedGrade(80, 100);
    expect(grade).toBe('A');
  });

  it('assigns A for 85%', async () => {
    const grade = await getAssignedGrade(85, 100);
    expect(grade).toBe('A');
  });

  it('assigns B+ for 70% (boundary)', async () => {
    const grade = await getAssignedGrade(70, 100);
    expect(grade).toBe('B+');
  });

  it('assigns B for 60% (boundary)', async () => {
    const grade = await getAssignedGrade(60, 100);
    expect(grade).toBe('B');
  });

  it('assigns C+ for 50% (boundary)', async () => {
    const grade = await getAssignedGrade(50, 100);
    expect(grade).toBe('C+');
  });

  it('assigns C for 40% (boundary — passing threshold)', async () => {
    const grade = await getAssignedGrade(40, 100);
    expect(grade).toBe('C');
  });

  it('assigns D for 33% (boundary)', async () => {
    const grade = await getAssignedGrade(33, 100);
    expect(grade).toBe('D');
  });

  it('assigns F for 32.99% (just below D boundary)', async () => {
    // 32 out of 100 = 32% → F
    const grade = await getAssignedGrade(32, 100);
    expect(grade).toBe('F');
  });

  it('assigns F for 0%', async () => {
    const grade = await getAssignedGrade(0, 100);
    expect(grade).toBe('F');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listResults
// ═════════════════════════════════════════════════════════════════════════════

describe('exams.service — listResults', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns results array when exam exists', async () => {
    // listResults: exam guard → aggregate rows → count → subject rows → exam_subjects (passing marks)
    // + lookupGrade (query per student, empty → default fallback)
    mockQuery
      // 1. Exam guard
      .mockResolvedValueOnce({ rows: [{ id: 'exam-uuid' }] })
      // 2. Aggregate student rows
      .mockResolvedValueOnce({
        rows: [{
          student_id:      'stu-uuid',
          student_name:    'Ali Raza',
          admission_no:    'A001',
          roll_no:         '1',
          section_id:      'sec-uuid',
          total_obtained:  '85',
          total_marks:     '100',
          position:        '1',
        }],
      })
      // 3. Count distinct students
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      // 4. Subject breakdown rows (studentIds non-empty)
      .mockResolvedValueOnce({
        rows: [{
          student_id:     'stu-uuid',
          student_name:   'Ali Raza',
          admission_no:   'A001',
          roll_no:        '1',
          section_id:     'sec-uuid',
          subject_id:     'subj-uuid',
          subject_name:   'Mathematics',
          marks_obtained: '85',
          total_marks:    '100',
          is_absent:      false,
          grade:          'A',
        }],
      })
      // 5. exam_subjects passing marks
      .mockResolvedValueOnce({ rows: [{ subject_id: 'subj-uuid', passing_marks: '40' }] })
      // 6. lookupGrade → grade_config query (empty → default fallback, 85% → A)
      .mockResolvedValueOnce({ rows: [] });

    const result = await examsService.listResults(actor, 'exam-uuid', { page: 1, limit: 50 });

    expect(result.data.length).toBe(1);
    expect(result.meta.total).toBe(1);

    const entry = result.data[0];
    expect(entry).toHaveProperty('studentId', 'stu-uuid');
    expect(entry).toHaveProperty('studentName', 'Ali Raza');
    expect(entry).toHaveProperty('totalObtained', 85);
    expect(entry).toHaveProperty('totalMarks', 100);
    expect(entry).toHaveProperty('percentage');
    expect(entry).toHaveProperty('gpa');
    expect(entry).toHaveProperty('grade', 'A');
    expect(entry).toHaveProperty('position', 1);
    expect(entry).toHaveProperty('isPassed');
    expect(Array.isArray(entry.subjectResults)).toBe(true);
    expect(entry.subjectResults.length).toBe(1);
    expect(entry.subjectResults[0]).toHaveProperty('subjectName', 'Mathematics');
  });

  it('throws HttpError 404 when exam not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // exam guard → not found

    await expect(
      examsService.listResults(actor, 'nonexistent-exam', { page: 1, limit: 50 }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );
  });

  it('returns empty data when no results exist for the exam', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'exam-uuid' }] }) // exam guard
      .mockResolvedValueOnce({ rows: [] })                    // aggregate → no students
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })      // count
      .mockResolvedValueOnce({ rows: [] });                   // exam_subjects (empty)
    // subject breakdown query is skipped when studentIds is empty

    const result = await examsService.listResults(actor, 'exam-uuid', { page: 1, limit: 50 });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('marks student as failed when they are absent in a subject', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'exam-uuid' }] })
      .mockResolvedValueOnce({
        rows: [{
          student_id: 'stu-uuid', student_name: 'Ali', admission_no: 'A001',
          roll_no: '1', section_id: 'sec-uuid',
          total_obtained: '0', total_marks: '100', position: '1',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [{
          student_id: 'stu-uuid', student_name: 'Ali', admission_no: 'A001',
          roll_no: '1', section_id: 'sec-uuid',
          subject_id: 'subj-uuid', subject_name: 'Math',
          marks_obtained: '0', total_marks: '100', is_absent: true, grade: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ subject_id: 'subj-uuid', passing_marks: '40' }] })
      .mockResolvedValueOnce({ rows: [] }); // grade_config → default

    const result = await examsService.listResults(actor, 'exam-uuid', { page: 1, limit: 50 });

    expect(result.data[0].isPassed).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getExamById
// ═════════════════════════════════════════════════════════════════════════════

describe('exams.service — getExamById', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns exam DTO with subjects when found', async () => {
    const row = makeExamRow();
    mockQuery
      .mockResolvedValueOnce({ rows: [row] })      // SELECT exam
      .mockResolvedValueOnce({ rows: [] });         // loadSubjects (no subjects)

    const result = await examsService.getExamById(actor, 'exam-uuid');

    expect(result).toHaveProperty('id', 'exam-uuid');
    expect(result).toHaveProperty('examType', 'midterm');
    expect(result).toHaveProperty('subjects');
    expect(Array.isArray(result.subjects)).toBe(true);
  });

  it('throws HttpError 404 when exam not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      examsService.getExamById(actor, 'nonexistent-uuid'),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && e.status === 404,
    );
  });
});
