/**
 * Exams service — multi-tenant, all queries scoped to actor.schoolId.
 * Marks are NUMERIC(6,2) — never integers/BIGINT (blueprint §marks).
 * Soft-delete via deleted_at; all reads filter deleted_at IS NULL.
 * withTransaction used for all multi-statement mutations.
 * Grade computation uses grade_config table with per-school customisation;
 * falls back to hard-coded defaults when no config is stored.
 */
import { query, withTransaction } from '../../config/db.js';
import type { PoolClient } from 'pg';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, badRequest, forbidden } from '../../utils/http-error.js';
import type {
  CreateExamInput,
  UpdateExamInput,
  ListExamsQuery,
  PatchSubjectsInput,
  EnterMarksInput,
  MarksQuery,
  ResultsQuery,
  ClassAnalysisQuery,
  PutGradeConfigInput,
} from './exams.schema.js';

// ── Row types ──────────────────────────────────────────────────────────────

interface ExamRow {
  id: string;
  school_id: string;
  session_id: string | null;
  class_id: string | null;
  class_name: string | null;
  name: string;
  exam_type: string;
  total_marks: string | number;
  passing_marks: string | number;
  start_date: string | null;
  end_date: string | null;
  is_published: boolean;
  created_at: string;
}

interface ExamSubjectRow {
  id: string;
  subject_id: string;
  subject_name: string;
  total_marks: string | number;
  passing_marks: string | number;
}

interface ExamResultRow {
  student_id: string;
  student_name: string;
  admission_no: string;
  roll_no: string | null;
  section_id: string | null;
  subject_id: string;
  subject_name: string;
  marks_obtained: string | number;
  total_marks: string | number;
  is_absent: boolean;
  grade: string | null;
}

interface GradeConfigRow {
  grade_letter: string;
  min_percentage: string | number;
  max_percentage: string | number;
  grade_point: string | number;
  display_order: number;
}

// ── Hardcoded grade defaults (used when school has no grade_config rows) ──

const DEFAULT_GRADE_CONFIG = [
  { gradeLetter: 'A+', minPercentage: 90,    maxPercentage: 100,   gradePoint: 4.0 },
  { gradeLetter: 'A',  minPercentage: 80,    maxPercentage: 89.99, gradePoint: 3.7 },
  { gradeLetter: 'B+', minPercentage: 70,    maxPercentage: 79.99, gradePoint: 3.3 },
  { gradeLetter: 'B',  minPercentage: 60,    maxPercentage: 69.99, gradePoint: 3.0 },
  { gradeLetter: 'C+', minPercentage: 50,    maxPercentage: 59.99, gradePoint: 2.3 },
  { gradeLetter: 'C',  minPercentage: 40,    maxPercentage: 49.99, gradePoint: 2.0 },
  { gradeLetter: 'D',  minPercentage: 33,    maxPercentage: 39.99, gradePoint: 1.0 },
  { gradeLetter: 'F',  minPercentage: 0,     maxPercentage: 32.99, gradePoint: 0.0 },
];

// ── Grading helpers ────────────────────────────────────────────────────────

/**
 * Look up grade for a given percentage from the school's grade_config.
 * Falls back to DEFAULT_GRADE_CONFIG if no config exists for the school.
 * Multi-tenant: scoped by school_id (blueprint §grading).
 */
async function lookupGrade(
  schoolId: string,
  percentage: number,
): Promise<{ gradeLetter: string; gradePoint: number }> {
  const { rows } = await query<{ grade_letter: string; grade_point: string }>(
    `SELECT grade_letter, grade_point
       FROM grade_config
      WHERE school_id = $1
        AND min_percentage <= $2
        AND max_percentage >= $2
      LIMIT 1`,
    [schoolId, percentage],
  );
  if (rows[0]) {
    return {
      gradeLetter: rows[0].grade_letter,
      gradePoint: Number(rows[0].grade_point),
    };
  }
  // Fallback to hard-coded defaults.
  const match = DEFAULT_GRADE_CONFIG.find(
    (g) => percentage >= g.minPercentage && percentage <= g.maxPercentage,
  );
  return match
    ? { gradeLetter: match.gradeLetter, gradePoint: match.gradePoint }
    : { gradeLetter: 'F', gradePoint: 0.0 };
}

/** Same as lookupGrade but accepts a client (used inside transactions). */
async function lookupGradeClient(
  client: PoolClient,
  schoolId: string,
  percentage: number,
): Promise<{ gradeLetter: string; gradePoint: number }> {
  const { rows } = await client.query<{ grade_letter: string; grade_point: string }>(
    `SELECT grade_letter, grade_point
       FROM grade_config
      WHERE school_id = $1
        AND min_percentage <= $2
        AND max_percentage >= $2
      LIMIT 1`,
    [schoolId, percentage],
  );
  if (rows[0]) {
    return {
      gradeLetter: rows[0].grade_letter,
      gradePoint: Number(rows[0].grade_point),
    };
  }
  const match = DEFAULT_GRADE_CONFIG.find(
    (g) => percentage >= g.minPercentage && percentage <= g.maxPercentage,
  );
  return match
    ? { gradeLetter: match.gradeLetter, gradePoint: match.gradePoint }
    : { gradeLetter: 'F', gradePoint: 0.0 };
}

// ── DTO mappers (snake_case row → camelCase DTO) ───────────────────────────

function toExamSubjectDto(r: ExamSubjectRow) {
  return {
    id:           r.id,
    subjectId:    r.subject_id,
    subjectName:  r.subject_name,
    totalMarks:   Number(r.total_marks),
    passingMarks: Number(r.passing_marks),
  };
}

async function toExamDto(r: ExamRow, subjects: ExamSubjectRow[]) {
  return {
    id:           r.id,
    schoolId:     r.school_id,
    sessionId:    r.session_id,
    classId:      r.class_id,
    className:    r.class_name,
    name:         r.name,
    examType:     r.exam_type,
    totalMarks:   Number(r.total_marks),
    passingMarks: Number(r.passing_marks),
    startDate:    r.start_date,
    endDate:      r.end_date,
    isPublished:  r.is_published,
    createdAt:    r.created_at,
    subjects:     subjects.map(toExamSubjectDto),
  };
}

// ── Load subjects for one or more exams ───────────────────────────────────

async function loadSubjects(examIds: string[]): Promise<Map<string, ExamSubjectRow[]>> {
  if (examIds.length === 0) return new Map();
  const { rows } = await query<ExamSubjectRow & { exam_id: string }>(
    `SELECT es.id, es.exam_id, es.subject_id, s.name AS subject_name,
            es.total_marks, es.passing_marks
       FROM exam_subjects es
       JOIN subjects s ON s.id = es.subject_id
      WHERE es.exam_id = ANY($1::uuid[])
      ORDER BY s.name`,
    [examIds],
  );
  const map = new Map<string, ExamSubjectRow[]>();
  for (const r of rows) {
    if (!map.has(r.exam_id)) map.set(r.exam_id, []);
    map.get(r.exam_id)!.push(r);
  }
  return map;
}

// ── Guard: verify teacher is assigned to the section/subject (data-scope) ──

async function assertTeacherScope(
  schoolId: string,
  userId: string,
  sectionId: string,
  subjectId: string,
): Promise<void> {
  // Check via timetable_slots (teacher assigned to section + subject).
  const { rows } = await query<{ id: string }>(
    `SELECT ts.id
       FROM timetable_slots ts
       JOIN staff st ON st.id = ts.teacher_id
      WHERE ts.section_id = $1
        AND ts.subject_id = $2
        AND st.user_id    = $3
        AND st.school_id  = $4
      LIMIT 1`,
    [sectionId, subjectId, userId, schoolId],
  );
  if (!rows[0]) {
    // Also allow if teacher is class teacher of the section.
    const { rows: secRows } = await query<{ id: string }>(
      `SELECT sec.id
         FROM sections sec
         JOIN staff st ON st.id = sec.teacher_id
        WHERE sec.id        = $1
          AND st.user_id    = $2
          AND st.school_id  = $3
        LIMIT 1`,
      [sectionId, userId, schoolId],
    );
    if (!secRows[0]) throw forbidden('Teacher not assigned to this section/subject');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMS CRUD
// ═══════════════════════════════════════════════════════════════════════════

export async function listExams(actor: AccessClaims, q: ListExamsQuery) {
  const where: string[] = ['e.school_id = $1', 'e.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.sessionId) {
    params.push(q.sessionId);
    where.push(`e.session_id = $${params.length}`);
  }
  if (q.classId) {
    params.push(q.classId);
    where.push(`e.class_id = $${params.length}`);
  }
  if (q.examType) {
    params.push(q.examType);
    where.push(`e.exam_type = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset   = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<ExamRow>(
      `SELECT e.id, e.school_id, e.session_id, e.class_id, c.name AS class_name,
              e.name, e.exam_type, e.total_marks, e.passing_marks,
              e.start_date, e.end_date, e.is_published, e.created_at
         FROM exams e
         LEFT JOIN classes c ON c.id = e.class_id
        WHERE ${whereSql}
        ORDER BY e.start_date DESC NULLS LAST, e.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM exams e WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total    = Number(countRes.rows[0]?.total ?? 0);
  const examIds  = dataRes.rows.map((r) => r.id);
  const subjectsMap = await loadSubjects(examIds);

  const data = await Promise.all(
    dataRes.rows.map((r) => toExamDto(r, subjectsMap.get(r.id) ?? [])),
  );

  return {
    data,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createExam(actor: AccessClaims, input: CreateExamInput) {
  return withTransaction(async (client) => {
    // Insert exam — class_id and session_id are optional (multi-tenant via school_id).
    const { rows } = await client.query<ExamRow>(
      `INSERT INTO exams
         (school_id, session_id, class_id, name, exam_type, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, school_id, session_id, class_id, NULL AS class_name,
                 name, exam_type, total_marks, passing_marks,
                 start_date, end_date, is_published, created_at`,
      [
        actor.schoolId,
        input.sessionId ?? null,
        input.classId ?? null,
        input.name,
        input.examType,
        input.startDate ?? null,
        input.endDate ?? null,
      ],
    );
    const exam = rows[0];

    // Insert subjects if provided.
    const subjects: ExamSubjectRow[] = [];
    for (const s of input.subjects) {
      const { rows: sRows } = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM subjects WHERE id = $1`,
        [s.subjectId],
      );
      if (!sRows[0]) throw notFound(`Subject ${s.subjectId} not found`);
      const { rows: esRows } = await client.query<ExamSubjectRow>(
        `INSERT INTO exam_subjects (exam_id, subject_id, school_id, total_marks, passing_marks)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, subject_id, $6::text AS subject_name, total_marks, passing_marks`,
        [exam.id, s.subjectId, actor.schoolId, s.totalMarks, s.passingMarks, sRows[0].name],
      );
      subjects.push(esRows[0]);
    }

    return toExamDto(exam, subjects);
  });
}

export async function getExamById(actor: AccessClaims, id: string) {
  const { rows } = await query<ExamRow>(
    `SELECT e.id, e.school_id, e.session_id, e.class_id, c.name AS class_name,
            e.name, e.exam_type, e.total_marks, e.passing_marks,
            e.start_date, e.end_date, e.is_published, e.created_at
       FROM exams e
       LEFT JOIN classes c ON c.id = e.class_id
      WHERE e.id = $1 AND e.school_id = $2 AND e.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Exam not found');

  const subjectsMap = await loadSubjects([id]);
  return toExamDto(rows[0], subjectsMap.get(id) ?? []);
}

export async function updateExam(
  actor: AccessClaims,
  id: string,
  input: UpdateExamInput,
) {
  const { rows: before } = await query<{ id: string; is_published: boolean }>(
    `SELECT id, is_published FROM exams
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Exam not found');
  if (before[0].is_published) throw badRequest('Cannot update a published exam');

  const { rows } = await query<ExamRow>(
    `UPDATE exams
        SET name       = COALESCE($3, name),
            exam_type  = COALESCE($4, exam_type),
            start_date = COALESCE($5, start_date),
            end_date   = COALESCE($6, end_date),
            class_id   = COALESCE($7, class_id)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, session_id, class_id, NULL AS class_name,
                name, exam_type, total_marks, passing_marks,
                start_date, end_date, is_published, created_at`,
    [
      id, actor.schoolId,
      input.name ?? null,
      input.examType ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
      input.classId ?? null,
    ],
  );

  const subjectsMap = await loadSubjects([id]);
  const after = await toExamDto(rows[0], subjectsMap.get(id) ?? []);
  return { before: { id: before[0].id, isPublished: before[0].is_published }, after };
}

export async function deleteExam(actor: AccessClaims, id: string) {
  const { rows } = await query<{ id: string; is_published: boolean }>(
    `SELECT id, is_published FROM exams
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Exam not found');
  if (rows[0].is_published) throw badRequest('Cannot delete a published exam');

  await query(
    `UPDATE exams SET deleted_at = now() WHERE id = $1 AND school_id = $2`,
    [id, actor.schoolId],
  );
  return { id };
}

export async function publishExam(actor: AccessClaims, id: string) {
  const { rows } = await query<{ id: string; is_published: boolean }>(
    `SELECT id, is_published FROM exams
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Exam not found');

  // Validate: at least one subject linked before publishing.
  const { rows: subjRows } = await query<{ cnt: string }>(
    `SELECT count(*)::int AS cnt FROM exam_subjects WHERE exam_id = $1`,
    [id],
  );
  if (Number(subjRows[0]?.cnt ?? 0) === 0) {
    throw badRequest('Exam must have at least one subject before publishing');
  }

  await query(
    `UPDATE exams SET is_published = true WHERE id = $1 AND school_id = $2`,
    [id, actor.schoolId],
  );
  return { id, isPublished: true };
}

export async function unpublishExam(actor: AccessClaims, id: string) {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM exams WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Exam not found');

  await query(
    `UPDATE exams SET is_published = false WHERE id = $1 AND school_id = $2`,
    [id, actor.schoolId],
  );
  return { id, isPublished: false };
}

export async function patchExamSubjects(
  actor: AccessClaims,
  id: string,
  input: PatchSubjectsInput,
) {
  return withTransaction(async (client) => {
    // Verify exam exists and is not published (cannot change subjects of live exam).
    const { rows } = await client.query<{ id: string; is_published: boolean }>(
      `SELECT id, is_published FROM exams
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [id, actor.schoolId],
    );
    if (!rows[0]) throw notFound('Exam not found');
    if (rows[0].is_published) throw badRequest('Cannot replace subjects on a published exam');

    // Delete existing exam_subjects for this exam (cascade-safe: exam_results refer to
    // subject_id directly, not exam_subjects.id, so removal here does not orphan results).
    await client.query(`DELETE FROM exam_subjects WHERE exam_id = $1`, [id]);

    // Insert new subjects.
    const subjects: ExamSubjectRow[] = [];
    for (const s of input.subjects) {
      const { rows: sRows } = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM subjects WHERE id = $1`,
        [s.subjectId],
      );
      if (!sRows[0]) throw notFound(`Subject ${s.subjectId} not found`);
      const { rows: esRows } = await client.query<ExamSubjectRow>(
        `INSERT INTO exam_subjects (exam_id, subject_id, school_id, total_marks, passing_marks)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, subject_id, $6::text AS subject_name, total_marks, passing_marks`,
        [id, s.subjectId, actor.schoolId, s.totalMarks, s.passingMarks, sRows[0].name],
      );
      subjects.push(esRows[0]);
    }

    return subjects.map(toExamSubjectDto);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKS ENTRY
// ═══════════════════════════════════════════════════════════════════════════

export async function getMarksRoster(
  actor: AccessClaims,
  examId: string,
  q: MarksQuery,
) {
  // Multi-tenant guard: verify exam belongs to this school.
  const { rows: examRows } = await query<{ id: string }>(
    `SELECT id FROM exams WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [examId, actor.schoolId],
  );
  if (!examRows[0]) throw notFound('Exam not found');

  // Teacher data-scope: if teacher role, verify assignment.
  if (actor.role === 'teacher') {
    await assertTeacherScope(actor.schoolId, actor.sub, q.sectionId, q.subjectId);
  }

  // Students in the section with their current marks (LEFT JOIN).
  const { rows } = await query<{
    student_id: string;
    student_name: string;
    admission_no: string;
    roll_no: string | null;
    marks_obtained: string | null;
    is_absent: boolean | null;
    grade: string | null;
  }>(
    `SELECT s.id AS student_id, s.full_name AS student_name, s.admission_no, s.roll_no,
            er.marks_obtained, er.is_absent, er.grade
       FROM students s
       LEFT JOIN exam_results er
              ON er.student_id = s.id
             AND er.exam_id    = $1
             AND er.subject_id = $3
      WHERE s.section_id = $2
        AND s.school_id  = $4
        AND s.deleted_at IS NULL
        AND s.status     = 'active'
      ORDER BY s.roll_no NULLS LAST, s.full_name`,
    [examId, q.sectionId, q.subjectId, actor.schoolId],
  );

  return {
    examId,
    subjectId: q.subjectId,
    sectionId: q.sectionId,
    entries: rows.map((r) => ({
      studentId:      r.student_id,
      studentName:    r.student_name,
      admissionNo:    r.admission_no,
      rollNo:         r.roll_no,
      marksObtained:  r.marks_obtained != null ? Number(r.marks_obtained) : null,
      isAbsent:       r.is_absent ?? false,
      grade:          r.grade,
    })),
  };
}

export async function enterMarks(
  actor: AccessClaims,
  examId: string,
  input: EnterMarksInput,
) {
  return withTransaction(async (client) => {
    // Multi-tenant guard.
    const { rows: examRows } = await client.query<{ id: string; is_published: boolean }>(
      `SELECT id, is_published FROM exams
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [examId, actor.schoolId],
    );
    if (!examRows[0]) throw notFound('Exam not found');

    // Teacher data-scope.
    if (actor.role === 'teacher') {
      await assertTeacherScope(actor.schoolId, actor.sub, input.sectionId, input.subjectId);
    }

    // Validate subject belongs to this exam and fetch its total_marks cap.
    const { rows: esRows } = await client.query<{ total_marks: string; passing_marks: string }>(
      `SELECT total_marks, passing_marks
         FROM exam_subjects
        WHERE exam_id = $1 AND subject_id = $2`,
      [examId, input.subjectId],
    );
    if (!esRows[0]) {
      throw badRequest('Subject is not linked to this exam');
    }
    const subjectTotalMarks   = Number(esRows[0].total_marks);
    const subjectPassingMarks = Number(esRows[0].passing_marks);

    // Validate marks bounds.
    for (const entry of input.entries) {
      if (!entry.isAbsent && entry.marksObtained > subjectTotalMarks) {
        throw badRequest(
          `marks_obtained (${entry.marksObtained}) exceeds total_marks (${subjectTotalMarks}) for student ${entry.studentId}`,
        );
      }
    }

    let upsertedCount = 0;
    for (const entry of input.entries) {
      const effectiveMarks = entry.isAbsent ? 0 : entry.marksObtained;
      const pct = subjectTotalMarks > 0 ? (effectiveMarks / subjectTotalMarks) * 100 : 0;
      const { gradeLetter } = await lookupGradeClient(client, actor.schoolId, pct);
      const grade = entry.isAbsent ? null : gradeLetter;

      await client.query(
        `INSERT INTO exam_results
           (exam_id, student_id, subject_id, school_id,
            marks_obtained, total_marks, is_absent, grade, entered_by, entered_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
         ON CONFLICT (exam_id, student_id, subject_id)
         DO UPDATE SET
           marks_obtained = EXCLUDED.marks_obtained,
           is_absent      = EXCLUDED.is_absent,
           grade          = EXCLUDED.grade,
           entered_by     = EXCLUDED.entered_by,
           entered_at     = now()`,
        [
          examId, entry.studentId, input.subjectId, actor.schoolId,
          effectiveMarks, subjectTotalMarks, entry.isAbsent ?? false,
          grade, actor.sub,
        ],
      );
      upsertedCount++;
    }

    return {
      examId,
      subjectId:       input.subjectId,
      sectionId:       input.sectionId,
      entriesUpserted: upsertedCount,
      passingMarks:    subjectPassingMarks,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════

export async function listResults(
  actor: AccessClaims,
  examId: string,
  q: ResultsQuery,
) {
  // Multi-tenant guard.
  const { rows: examRows } = await query<{ id: string }>(
    `SELECT id FROM exams WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [examId, actor.schoolId],
  );
  if (!examRows[0]) throw notFound('Exam not found');

  const sectionFilter = q.sectionId
    ? `AND s.section_id = '${q.sectionId}'`
    : '';

  const offset = (q.page - 1) * q.limit;

  // Aggregate per-student: sum marks_obtained, total_marks across all subjects.
  // RANK() computes position by descending marks within the same section scope.
  const { rows } = await query<{
    student_id: string;
    student_name: string;
    admission_no: string;
    roll_no: string | null;
    section_id: string | null;
    total_obtained: string;
    total_marks: string;
    position: string;
  }>(
    `WITH agg AS (
       SELECT er.student_id,
              SUM(er.marks_obtained)::numeric AS total_obtained,
              SUM(er.total_marks)::numeric    AS total_marks
         FROM exam_results er
         JOIN students s ON s.id = er.student_id
        WHERE er.exam_id   = $1
          AND er.school_id = $2
          ${sectionFilter}
        GROUP BY er.student_id
     )
     SELECT s.id AS student_id, s.full_name AS student_name,
            s.admission_no, s.roll_no, s.section_id,
            agg.total_obtained, agg.total_marks,
            RANK() OVER (ORDER BY agg.total_obtained DESC)::int AS position
       FROM agg
       JOIN students s ON s.id = agg.student_id
      ORDER BY agg.total_obtained DESC
      LIMIT $3 OFFSET $4`,
    [examId, actor.schoolId, q.limit, offset],
  );

  // Count total distinct students with results.
  const { rows: countRows } = await query<{ total: number }>(
    `SELECT count(DISTINCT er.student_id)::int AS total
       FROM exam_results er
       JOIN students s ON s.id = er.student_id
      WHERE er.exam_id   = $1
        AND er.school_id = $2
        ${sectionFilter}`,
    [examId, actor.schoolId],
  );
  const total = Number(countRows[0]?.total ?? 0);

  // Fetch per-subject breakdown for each student.
  const studentIds = rows.map((r) => r.student_id);
  let subjectRows: ExamResultRow[] = [];
  if (studentIds.length > 0) {
    const { rows: sr } = await query<ExamResultRow>(
      `SELECT er.student_id, s.full_name AS student_name, s.admission_no, s.roll_no, s.section_id,
              er.subject_id, sub.name AS subject_name,
              er.marks_obtained, er.total_marks, er.is_absent, er.grade
         FROM exam_results er
         JOIN students s ON s.id = er.student_id
         JOIN subjects sub ON sub.id = er.subject_id
        WHERE er.exam_id   = $1
          AND er.school_id = $2
          AND er.student_id = ANY($3::uuid[])
        ORDER BY sub.name`,
      [examId, actor.schoolId, studentIds],
    );
    subjectRows = sr;
  }

  // Fetch passing_marks per subject for isPassed check.
  const { rows: esRows } = await query<{ subject_id: string; passing_marks: string }>(
    `SELECT subject_id, passing_marks FROM exam_subjects WHERE exam_id = $1`,
    [examId],
  );
  const passingMarksMap = new Map(esRows.map((r) => [r.subject_id, Number(r.passing_marks)]));

  // Build per-student maps.
  const subjectsByStudent = new Map<string, ExamResultRow[]>();
  for (const sr of subjectRows) {
    if (!subjectsByStudent.has(sr.student_id)) subjectsByStudent.set(sr.student_id, []);
    subjectsByStudent.get(sr.student_id)!.push(sr);
  }

  const data = await Promise.all(
    rows.map(async (r) => {
      const totalObtained = Number(r.total_obtained);
      const totalMarks    = Number(r.total_marks);
      const pct           = totalMarks > 0 ? (totalObtained / totalMarks) * 100 : 0;
      const { gradeLetter, gradePoint } = await lookupGrade(actor.schoolId, pct);

      const studentSubjects = subjectsByStudent.get(r.student_id) ?? [];
      const isPassed = studentSubjects.every((sr) => {
        if (sr.is_absent) return false;
        const pm = passingMarksMap.get(sr.subject_id) ?? 40;
        return Number(sr.marks_obtained) >= pm;
      });

      return {
        studentId:       r.student_id,
        studentName:     r.student_name,
        admissionNo:     r.admission_no,
        rollNo:          r.roll_no,
        sectionId:       r.section_id,
        subjectResults:  studentSubjects.map((sr) => ({
          studentId:      sr.student_id,
          studentName:    sr.student_name,
          admissionNo:    sr.admission_no,
          subjectId:      sr.subject_id,
          subjectName:    sr.subject_name,
          marksObtained:  Number(sr.marks_obtained),
          totalMarks:     Number(sr.total_marks),
          isAbsent:       sr.is_absent,
          grade:          sr.grade,
        })),
        totalObtained,
        totalMarks,
        percentage:   Math.round(pct * 100) / 100,
        gpa:          gradePoint,
        grade:        gradeLetter,
        position:     Number(r.position),
        isPassed,
      };
    }),
  );

  return {
    data,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function getStudentResult(
  actor: AccessClaims,
  examId: string,
  studentId: string,
) {
  // Multi-tenant guard.
  const { rows: examRows } = await query<{ id: string }>(
    `SELECT id FROM exams WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [examId, actor.schoolId],
  );
  if (!examRows[0]) throw notFound('Exam not found');

  // Parent/student data-scope (blueprint §6).
  if (actor.role === 'student') {
    // The student's user_id must match the student record's user_id.
    const { rows: stuRows } = await query<{ user_id: string | null }>(
      `SELECT user_id FROM students WHERE id = $1 AND school_id = $2`,
      [studentId, actor.schoolId],
    );
    if (!stuRows[0]) throw notFound('Student not found');
    if (stuRows[0].user_id !== actor.sub) throw forbidden('Access denied');
  } else if (actor.role === 'parent') {
    // Look up via guardians table (guardian.user_id = actor.sub → guardian_students → student).
    const { rows: guardRows } = await query<{ guardian_id: string }>(
      `SELECT gs.guardian_id
         FROM guardian_students gs
         JOIN guardians g ON g.id = gs.guardian_id
        WHERE gs.student_id = $1 AND g.user_id = $2 AND g.school_id = $3`,
      [studentId, actor.sub, actor.schoolId],
    );
    if (guardRows.length === 0) {
      throw forbidden('You are not listed as guardian for this student');
    }
  }

  // Fetch student info and all subject results.
  const { rows: stuRows } = await query<{
    id: string;
    full_name: string;
    admission_no: string;
    roll_no: string | null;
    section_id: string | null;
  }>(
    `SELECT id, full_name, admission_no, roll_no, section_id
       FROM students WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [studentId, actor.schoolId],
  );
  if (!stuRows[0]) throw notFound('Student not found');
  const stu = stuRows[0];

  const { rows: srRows } = await query<ExamResultRow>(
    `SELECT er.student_id, s.full_name AS student_name, s.admission_no, s.roll_no, s.section_id,
            er.subject_id, sub.name AS subject_name,
            er.marks_obtained, er.total_marks, er.is_absent, er.grade
       FROM exam_results er
       JOIN students s ON s.id = er.student_id
       JOIN subjects sub ON sub.id = er.subject_id
      WHERE er.exam_id    = $1
        AND er.student_id = $2
        AND er.school_id  = $3
      ORDER BY sub.name`,
    [examId, studentId, actor.schoolId],
  );

  // Passing marks map.
  const { rows: esRows } = await query<{ subject_id: string; passing_marks: string }>(
    `SELECT subject_id, passing_marks FROM exam_subjects WHERE exam_id = $1`,
    [examId],
  );
  const passingMarksMap = new Map(esRows.map((r) => [r.subject_id, Number(r.passing_marks)]));

  const totalObtained = srRows.reduce((s, r) => s + Number(r.marks_obtained), 0);
  const totalMarks    = srRows.reduce((s, r) => s + Number(r.total_marks), 0);
  const pct           = totalMarks > 0 ? (totalObtained / totalMarks) * 100 : 0;
  const { gradeLetter, gradePoint } = await lookupGrade(actor.schoolId, pct);

  const isPassed = srRows.every((r) => {
    if (r.is_absent) return false;
    const pm = passingMarksMap.get(r.subject_id) ?? 40;
    return Number(r.marks_obtained) >= pm;
  });

  // Compute position within same exam (rank by total obtained).
  const { rows: rankRows } = await query<{ position: string }>(
    `WITH agg AS (
       SELECT student_id, SUM(marks_obtained) AS total
         FROM exam_results
        WHERE exam_id = $1 AND school_id = $2
        GROUP BY student_id
     )
     SELECT RANK() OVER (ORDER BY total DESC)::int AS position
       FROM agg
      WHERE student_id = $3`,
    [examId, actor.schoolId, studentId],
  );
  const position = Number(rankRows[0]?.position ?? 0);

  return {
    data: {
      studentId:      stu.id,
      studentName:    stu.full_name,
      admissionNo:    stu.admission_no,
      rollNo:         stu.roll_no,
      sectionId:      stu.section_id,
      subjectResults: srRows.map((r) => ({
        studentId:     r.student_id,
        studentName:   r.student_name,
        admissionNo:   r.admission_no,
        subjectId:     r.subject_id,
        subjectName:   r.subject_name,
        marksObtained: Number(r.marks_obtained),
        totalMarks:    Number(r.total_marks),
        isAbsent:      r.is_absent,
        grade:         r.grade,
      })),
      totalObtained,
      totalMarks,
      percentage: Math.round(pct * 100) / 100,
      gpa:        gradePoint,
      grade:      gradeLetter,
      position,
      isPassed,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

export async function getClassAnalysis(
  actor: AccessClaims,
  examId: string,
  q: ClassAnalysisQuery,
) {
  const { rows: examRows } = await query<{ id: string; name: string }>(
    `SELECT id, name FROM exams WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [examId, actor.schoolId],
  );
  if (!examRows[0]) throw notFound('Exam not found');

  const sectionFilter = q.sectionId ? `AND s.section_id = '${q.sectionId}'` : '';

  // Aggregate per-student totals.
  const { rows: aggRows } = await query<{
    student_id: string;
    student_name: string;
    total_obtained: string;
    total_marks: string;
  }>(
    `SELECT er.student_id, s.full_name AS student_name,
            SUM(er.marks_obtained)::numeric AS total_obtained,
            SUM(er.total_marks)::numeric    AS total_marks
       FROM exam_results er
       JOIN students s ON s.id = er.student_id
      WHERE er.exam_id   = $1
        AND er.school_id = $2
        ${sectionFilter}
      GROUP BY er.student_id, s.full_name`,
    [examId, actor.schoolId],
  );

  if (aggRows.length === 0) {
    return {
      examId,
      examName:          examRows[0].name,
      totalStudents:     0,
      appeared:          0,
      passed:            0,
      failed:            0,
      passPercent:       0,
      classAverage:      0,
      highestGpa:        0,
      gradeDistribution: [],
      topStudents:       [],
    };
  }

  // Passing marks per subject.
  const { rows: esRows } = await query<{ subject_id: string; passing_marks: string }>(
    `SELECT subject_id, passing_marks FROM exam_subjects WHERE exam_id = $1`,
    [examId],
  );
  const passingMarksMap = new Map(esRows.map((r) => [r.subject_id, Number(r.passing_marks)]));

  // Per-student subject results (for isPassed check).
  const studentIds = aggRows.map((r) => r.student_id);
  const { rows: srRows } = await query<{
    student_id: string;
    subject_id: string;
    marks_obtained: string;
    is_absent: boolean;
  }>(
    `SELECT student_id, subject_id, marks_obtained, is_absent
       FROM exam_results
      WHERE exam_id   = $1
        AND school_id = $2
        AND student_id = ANY($3::uuid[])`,
    [examId, actor.schoolId, studentIds],
  );

  const subjectsByStudent = new Map<string, typeof srRows>();
  for (const sr of srRows) {
    if (!subjectsByStudent.has(sr.student_id)) subjectsByStudent.set(sr.student_id, []);
    subjectsByStudent.get(sr.student_id)!.push(sr);
  }

  const gradeCountMap = new Map<string, number>();
  const topStudentsList: { studentId: string; studentName: string; percentage: number; grade: string; position: number }[] = [];

  let passedCount  = 0;
  let totalPctSum  = 0;
  let highestGpa   = 0;

  const enriched = await Promise.all(
    aggRows.map(async (r) => {
      const totalObtained = Number(r.total_obtained);
      const totalMarks    = Number(r.total_marks);
      const pct           = totalMarks > 0 ? (totalObtained / totalMarks) * 100 : 0;
      const { gradeLetter, gradePoint } = await lookupGrade(actor.schoolId, pct);

      const subs = subjectsByStudent.get(r.student_id) ?? [];
      const isPassed = subs.every((sr) => {
        if (sr.is_absent) return false;
        const pm = passingMarksMap.get(sr.subject_id) ?? 40;
        return Number(sr.marks_obtained) >= pm;
      });

      totalPctSum += pct;
      if (isPassed) passedCount++;
      if (gradePoint > highestGpa) highestGpa = gradePoint;

      gradeCountMap.set(gradeLetter, (gradeCountMap.get(gradeLetter) ?? 0) + 1);
      return { studentId: r.student_id, studentName: r.student_name, pct, gradeLetter, gradePoint, isPassed };
    }),
  );

  // Sort by pct desc for top students + position.
  const sorted = [...enriched].sort((a, b) => b.pct - a.pct);
  sorted.slice(0, 3).forEach((r, idx) => {
    topStudentsList.push({
      studentId:   r.studentId,
      studentName: r.studentName,
      percentage:  Math.round(r.pct * 100) / 100,
      grade:       r.gradeLetter,
      position:    idx + 1,
    });
  });

  const appeared      = aggRows.length;
  const classAverage  = appeared > 0 ? Math.round((totalPctSum / appeared) * 100) / 100 : 0;

  const gradeDistribution = Array.from(gradeCountMap.entries())
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => a.grade.localeCompare(b.grade));

  return {
    examId,
    examName:      examRows[0].name,
    totalStudents: appeared,
    appeared,
    passed:        passedCount,
    failed:        appeared - passedCount,
    passPercent:   appeared > 0 ? Math.round((passedCount / appeared) * 10000) / 100 : 0,
    classAverage,
    highestGpa,
    gradeDistribution,
    topStudents: topStudentsList,
  };
}

export async function getSubjectAnalysis(
  actor: AccessClaims,
  examId: string,
  subjectId: string,
) {
  const { rows: examRows } = await query<{ id: string; name: string }>(
    `SELECT id, name FROM exams WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [examId, actor.schoolId],
  );
  if (!examRows[0]) throw notFound('Exam not found');

  // Verify subject linked to exam.
  const { rows: esRows } = await query<{
    subject_id: string;
    subject_name: string;
    passing_marks: string;
  }>(
    `SELECT es.subject_id, s.name AS subject_name, es.passing_marks, es.total_marks
       FROM exam_subjects es
       JOIN subjects s ON s.id = es.subject_id
      WHERE es.exam_id    = $1
        AND es.subject_id = $2`,
    [examId, subjectId],
  );
  if (!esRows[0]) throw notFound('Subject not linked to this exam');
  const passingMarks = Number((esRows[0] as unknown as { passing_marks: string }).passing_marks);

  const { rows } = await query<{
    student_id: string;
    marks_obtained: string;
    total_marks: string;
    is_absent: boolean;
    grade: string | null;
  }>(
    `SELECT student_id, marks_obtained, total_marks, is_absent, grade
       FROM exam_results
      WHERE exam_id   = $1
        AND subject_id = $2
        AND school_id = $3`,
    [examId, subjectId, actor.schoolId],
  );

  if (rows.length === 0) {
    return {
      subjectId,
      subjectName:       esRows[0].subject_name,
      totalMarks:        Number((esRows[0] as unknown as { total_marks: string }).total_marks ?? 100),
      studentCount:      0,
      appeared:          0,
      passed:            0,
      failed:            0,
      highest:           0,
      lowest:            0,
      average:           0,
      passPercent:       0,
      gradeDistribution: [],
    };
  }

  const appeared = rows.filter((r) => !r.is_absent);
  const marks    = appeared.map((r) => Number(r.marks_obtained));
  const passed   = appeared.filter((r) => Number(r.marks_obtained) >= passingMarks);

  const highest = marks.length > 0 ? Math.max(...marks) : 0;
  const lowest  = marks.length > 0 ? Math.min(...marks) : 0;
  const average = marks.length > 0 ? marks.reduce((s, v) => s + v, 0) / marks.length : 0;

  // Grade distribution — compute for appeared students (absent → skip).
  const gradeCountMap = new Map<string, number>();
  for (const r of appeared) {
    const totalM = Number(r.total_marks);
    const pct    = totalM > 0 ? (Number(r.marks_obtained) / totalM) * 100 : 0;
    const { gradeLetter } = await lookupGrade(actor.schoolId, pct);
    gradeCountMap.set(gradeLetter, (gradeCountMap.get(gradeLetter) ?? 0) + 1);
  }

  const gradeDistribution = Array.from(gradeCountMap.entries())
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => a.grade.localeCompare(b.grade));

  return {
    subjectId,
    subjectName:  esRows[0].subject_name,
    totalMarks:   Number((esRows[0] as unknown as { total_marks: string }).total_marks ?? 100),
    studentCount: rows.length,
    appeared:     appeared.length,
    passed:       passed.length,
    failed:       appeared.length - passed.length,
    highest:      Math.round(highest * 100) / 100,
    lowest:       Math.round(lowest * 100) / 100,
    average:      Math.round(average * 100) / 100,
    passPercent:  appeared.length > 0
      ? Math.round((passed.length / appeared.length) * 10000) / 100
      : 0,
    gradeDistribution,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GRADE CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export async function getGradeConfig(actor: AccessClaims) {
  const { rows } = await query<GradeConfigRow>(
    `SELECT grade_letter, min_percentage, max_percentage, grade_point, display_order
       FROM grade_config
      WHERE school_id = $1
      ORDER BY display_order`,
    [actor.schoolId],
  );

  if (rows.length > 0) {
    return rows.map((r) => ({
      gradeLetter:   r.grade_letter,
      minPercentage: Number(r.min_percentage),
      maxPercentage: Number(r.max_percentage),
      gradePoint:    Number(r.grade_point),
      displayOrder:  r.display_order,
    }));
  }

  // Return built-in defaults if no school config exists.
  return DEFAULT_GRADE_CONFIG.map((g, i) => ({ ...g, displayOrder: i + 1 }));
}

export async function putGradeConfig(actor: AccessClaims, input: PutGradeConfigInput) {
  return withTransaction(async (client) => {
    // Replace entire config: delete all rows for tenant, re-insert.
    await client.query(
      `DELETE FROM grade_config WHERE school_id = $1`,
      [actor.schoolId],
    );

    for (const g of input.grades) {
      await client.query(
        `INSERT INTO grade_config
           (school_id, grade_letter, min_percentage, max_percentage, grade_point, display_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [actor.schoolId, g.gradeLetter, g.minPercentage, g.maxPercentage, g.gradePoint, g.displayOrder],
      );
    }

    return input.grades.map((g) => ({
      gradeLetter:   g.gradeLetter,
      minPercentage: g.minPercentage,
      maxPercentage: g.maxPercentage,
      gradePoint:    g.gradePoint,
      displayOrder:  g.displayOrder,
    }));
  });
}
