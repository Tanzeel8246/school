import { query } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { forbidden, notFound } from '../../utils/http-error.js';
import type { AttendanceQuery, FeesQuery, ResultsQuery } from './parent.schema.js';
import { hashPassword } from '../../utils/password.js';

const NOT_DELETED = 'deleted_at IS NULL';

// ── Guardian ownership check ──────────────────────────────────────────────

/**
 * Verifies that parentUserId is linked to studentId via guardian_students.
 * Throws forbidden() if not linked.
 */
export async function createGuardianLinkCheck(
  parentUserId: string,
  studentId: string,
  schoolId: string,
): Promise<void> {
  const { rows } = await query<{ guardian_id: string }>(
    `SELECT gs.guardian_id
       FROM guardian_students gs
       JOIN guardians g ON g.id = gs.guardian_id
      WHERE g.user_id = $1
        AND gs.student_id = $2
        AND g.school_id = $3`,
    [parentUserId, studentId, schoolId],
  );
  if (!rows[0]) throw forbidden('Student not linked to this parent account');
}

// ── Children list ─────────────────────────────────────────────────────────

interface ChildRow {
  id: string;
  admission_no: string;
  roll_no: string | null;
  full_name: string;
  gender: string | null;
  dob: string | null;
  section_name: string | null;
  class_name: string | null;
  status: string;
}

function toChildDto(r: ChildRow) {
  return {
    id: r.id,
    admissionNo: r.admission_no,
    rollNo: r.roll_no,
    fullName: r.full_name,
    gender: r.gender,
    dob: r.dob,
    sectionName: r.section_name,
    className: r.class_name,
    status: r.status,
  };
}

export async function getChildren(actor: AccessClaims) {
  const { rows } = await query<ChildRow>(
    `SELECT s.id, s.admission_no, s.roll_no, s.full_name, s.gender, s.dob,
            sec.name AS section_name, cl.name AS class_name, s.status
       FROM guardian_students gs
       JOIN guardians g ON g.id = gs.guardian_id
       JOIN students s ON s.id = gs.student_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN classes cl ON cl.id = sec.class_id
      WHERE g.user_id = $1
        AND g.school_id = $2
        AND s.${NOT_DELETED}
      ORDER BY s.full_name`,
    [actor.sub, actor.schoolId],
  );
  return { data: rows.map(toChildDto) };
}

// ── Child attendance ──────────────────────────────────────────────────────

interface AttendanceRow {
  date: string;
  status: string;
  section_name: string | null;
}

function toAttendanceDto(r: AttendanceRow) {
  return {
    date: r.date,
    status: r.status,
    sectionName: r.section_name,
  };
}

export async function getChildAttendance(
  actor: AccessClaims,
  studentId: string,
  q: AttendanceQuery,
) {
  await createGuardianLinkCheck(actor.sub, studentId, actor.schoolId);

  // Compute default date range (start-of-month to today)
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);
  const from = q.from ?? startOfMonth;
  const to = q.to ?? today;

  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes, summaryRes] = await Promise.all([
    query<AttendanceRow>(
      `SELECT a.date::text, a.status, sec.name AS section_name
         FROM attendance a
         LEFT JOIN sections sec ON sec.id = a.section_id
        WHERE a.student_id = $1
          AND a.school_id = $2
          AND a.date BETWEEN $3 AND $4
        ORDER BY a.date DESC
        LIMIT $5 OFFSET $6`,
      [studentId, actor.schoolId, from, to, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM attendance
        WHERE student_id = $1 AND school_id = $2 AND date BETWEEN $3 AND $4`,
      [studentId, actor.schoolId, from, to],
    ),
    query<{ total_marked: number; present: number; absent: number; late: number }>(
      `SELECT
          count(*)::int                                         AS total_marked,
          count(*) FILTER (WHERE status = 'present')::int      AS present,
          count(*) FILTER (WHERE status = 'absent')::int       AS absent,
          count(*) FILTER (WHERE status = 'late')::int         AS late
         FROM attendance
        WHERE student_id = $1 AND school_id = $2 AND date BETWEEN $3 AND $4`,
      [studentId, actor.schoolId, from, to],
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  const s = summaryRes.rows[0];
  const totalMarked = Number(s?.total_marked ?? 0);
  const present = Number(s?.present ?? 0);
  const attendancePct = totalMarked > 0 ? Math.round((present / totalMarked) * 10000) / 100 : 0;

  return {
    data: dataRes.rows.map(toAttendanceDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    summary: {
      totalMarked,
      present,
      absent: Number(s?.absent ?? 0),
      late: Number(s?.late ?? 0),
      attendancePct,
    },
  };
}

// ── Child fees ────────────────────────────────────────────────────────────

interface FeeRow {
  id: string;
  challan_no: string;
  billing_month: string | null;
  total: number;
  paid: number;
  outstanding: number;
  due_date: string | null;
  status: string;
}

function toFeeDto(r: FeeRow) {
  return {
    id: r.id,
    challanNo: r.challan_no,
    billingMonth: r.billing_month,
    total: Number(r.total),
    paid: Number(r.paid),
    outstanding: Number(r.outstanding),
    dueDate: r.due_date,
    status: r.status,
  };
}

export async function getChildFees(
  actor: AccessClaims,
  studentId: string,
  q: FeesQuery,
) {
  await createGuardianLinkCheck(actor.sub, studentId, actor.schoolId);

  const where: string[] = ['fi.student_id = $1', 'fi.school_id = $2'];
  const params: unknown[] = [studentId, actor.schoolId];

  if (q.status) {
    params.push(q.status);
    where.push(`fi.status = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes, summaryRes] = await Promise.all([
    query<FeeRow>(
      `SELECT fi.id, fi.challan_no, fi.billing_month::text, fi.total, fi.paid,
              (fi.total - fi.paid) AS outstanding, fi.due_date::text, fi.status
         FROM fee_invoices fi
        WHERE ${whereSql}
        ORDER BY fi.due_date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM fee_invoices fi WHERE ${whereSql}`,
      params,
    ),
    query<{ total_charged: number; total_paid: number; total_outstanding: number }>(
      `SELECT
          COALESCE(sum(fi.total), 0)::bigint          AS total_charged,
          COALESCE(sum(fi.paid), 0)::bigint            AS total_paid,
          COALESCE(sum(fi.total - fi.paid), 0)::bigint AS total_outstanding
         FROM fee_invoices fi
        WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  const sum = summaryRes.rows[0];

  return {
    data: dataRes.rows.map(toFeeDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    summary: {
      totalCharged: Number(sum?.total_charged ?? 0),
      totalPaid: Number(sum?.total_paid ?? 0),
      totalOutstanding: Number(sum?.total_outstanding ?? 0),
    },
  };
}

// ── Child results ─────────────────────────────────────────────────────────

interface ResultRow {
  exam_id: string;
  exam_name: string;
  subject_name: string;
  total_marks: number;
  obtained_marks: number;
  grade: string | null;
  percentage: number | null;
}

function toResultDto(r: ResultRow) {
  const pct = r.percentage != null
    ? Math.round(Number(r.percentage) * 100) / 100
    : r.total_marks > 0
      ? Math.round((Number(r.obtained_marks) / Number(r.total_marks)) * 10000) / 100
      : 0;
  return {
    examId: r.exam_id,
    examName: r.exam_name,
    subjectName: r.subject_name,
    totalMarks: Number(r.total_marks),
    obtainedMarks: Number(r.obtained_marks),
    grade: r.grade,
    percentage: pct,
  };
}

export async function getChildResults(
  actor: AccessClaims,
  studentId: string,
  q: ResultsQuery,
) {
  await createGuardianLinkCheck(actor.sub, studentId, actor.schoolId);

  const where: string[] = ['er.student_id = $1', 'er.school_id = $2'];
  const params: unknown[] = [studentId, actor.schoolId];

  if (q.examId) {
    params.push(q.examId);
    where.push(`er.exam_id = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<ResultRow>(
      `SELECT er.exam_id, e.name AS exam_name, sub.name AS subject_name,
              er.total_marks, er.marks_obtained AS obtained_marks, er.grade,
              CASE WHEN er.total_marks > 0
                   THEN round(er.marks_obtained::numeric / er.total_marks * 100, 2)
                   ELSE 0 END AS percentage
         FROM exam_results er
         JOIN exams e ON e.id = er.exam_id
         JOIN subjects sub ON sub.id = er.subject_id
        WHERE ${whereSql}
        ORDER BY e.name, sub.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM exam_results er
        WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toResultDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

// ── Child timetable ───────────────────────────────────────────────────────

interface TimetableRow {
  id: string;
  weekday: number;
  period: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  teacher_name: string | null;
}

function toTimetableDto(r: TimetableRow) {
  return {
    id: r.id,
    weekday: r.weekday,
    period: r.period,
    startTime: r.start_time,
    endTime: r.end_time,
    subjectName: r.subject_name,
    teacherName: r.teacher_name,
  };
}

export async function getChildTimetable(actor: AccessClaims, studentId: string) {
  await createGuardianLinkCheck(actor.sub, studentId, actor.schoolId);

  // Get the student's section_id first
  const { rows: studentRows } = await query<{ section_id: string | null }>(
    `SELECT section_id FROM students WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}`,
    [studentId, actor.schoolId],
  );
  if (!studentRows[0]) throw notFound('Student not found');
  const sectionId = studentRows[0].section_id;
  if (!sectionId) return { data: [] };

  const { rows } = await query<TimetableRow>(
    `SELECT ts.id, ts.weekday, ts.period,
            ts.start_time::text AS start_time, ts.end_time::text AS end_time,
            sub.name AS subject_name, st.full_name AS teacher_name
       FROM timetable_slots ts
       JOIN subjects sub ON sub.id = ts.subject_id
       LEFT JOIN staff st ON st.id = ts.teacher_id
      WHERE ts.section_id = $1
      ORDER BY ts.weekday ASC, ts.period ASC`,
    [sectionId],
  );

  return { data: rows.map(toTimetableDto) };
}

export async function changePassword(actor: AccessClaims, passwordRaw: string): Promise<void> {
  const passwordHash = await hashPassword(passwordRaw);
  await query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND school_id = $3`,
    [passwordHash, actor.sub, actor.schoolId]
  );
}
