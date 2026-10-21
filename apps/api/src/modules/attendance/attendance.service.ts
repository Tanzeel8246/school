import { query } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound } from '../../utils/http-error.js';
import { notifyStudentAbsent } from '../communications/notify.js';
import type { BulkMarkInput, SingleMarkInput } from './attendance.schema.js';

const NOT_DELETED = 'deleted_at IS NULL';

// ── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── Teacher Scoping Helper ───────────────────────────────────────────────

const TEACHER_SECTION_SCOPE_SQL = `
  SELECT sec.id FROM sections sec
  JOIN staff st ON st.id = sec.teacher_id
  WHERE st.user_id = $1
  UNION
  SELECT tt.section_id FROM timetable_slots tt
  JOIN staff st2 ON st2.id = tt.teacher_id
  WHERE st2.user_id = $1
`;

async function verifyTeacherSection(actor: AccessClaims, sectionId: string) {
  if (actor.role !== 'teacher') return;
  const { rows } = await query(
    `SELECT 1 FROM (${TEACHER_SECTION_SCOPE_SQL}) AS allowed WHERE id = $2 LIMIT 1`,
    [actor.sub, sectionId]
  );
  if (rows.length === 0) throw notFound('Section not found or access denied');
}

// ── Section roster with attendance status ─────────────────────────────────

interface SectionRow {
  id: string;
  name: string;
  class_name: string | null;
}

interface RosterRow {
  student_id: string;
  admission_no: string;
  roll_no: string | null;
  full_name: string;
  attendance_id: string | null;
  status: string | null;
}

function toRosterDto(r: RosterRow) {
  return {
    studentId: r.student_id,
    admissionNo: r.admission_no,
    rollNo: r.roll_no,
    fullName: r.full_name,
    attendanceId: r.attendance_id,
    status: r.status,
  };
}

export async function getSectionRoster(
  actor: AccessClaims,
  sectionId: string,
  date?: string,
) {
  await verifyTeacherSection(actor, sectionId);
  const targetDate = date ?? todayStr();

  // Verify section belongs to this school
  const { rows: secRows } = await query<SectionRow>(
    `SELECT sec.id, sec.name, cl.name AS class_name
       FROM sections sec
       LEFT JOIN classes cl ON cl.id = sec.class_id
       LEFT JOIN academic_sessions s ON s.id = cl.session_id
      WHERE sec.id = $1 AND s.school_id = $2`,
    [sectionId, actor.schoolId],
  );
  if (!secRows[0]) throw notFound('Section not found');
  const sec = secRows[0];

  const { rows } = await query<RosterRow>(
    `SELECT s.id AS student_id, s.admission_no, s.roll_no, s.full_name,
            a.id AS attendance_id, a.status
       FROM students s
       LEFT JOIN attendance a
         ON a.student_id = s.id AND a.date = $2 AND a.school_id = $3
      WHERE s.section_id = $1
        AND s.school_id = $3
        AND s.${NOT_DELETED}
      ORDER BY s.roll_no, s.full_name`,
    [sectionId, targetDate, actor.schoolId],
  );

  const marked = rows.length > 0 && rows.every((r) => r.attendance_id != null);

  return {
    data: rows.map(toRosterDto),
    date: targetDate,
    sectionId,
    sectionName: sec.name,
    className: sec.class_name,
    marked,
  };
}

// ── Bulk mark attendance ───────────────────────────────────────────────────

export async function bulkMark(
  actor: AccessClaims,
  sectionId: string,
  input: BulkMarkInput,
) {
  await verifyTeacherSection(actor, sectionId);
  // Verify section belongs to school and get section's school_id
  const { rows: secRows } = await query<{ id: string }>(
    `SELECT sec.id
       FROM sections sec
       LEFT JOIN classes cl ON cl.id = sec.class_id
       LEFT JOIN academic_sessions s ON s.id = cl.session_id
      WHERE sec.id = $1 AND s.school_id = $2`,
    [sectionId, actor.schoolId],
  );
  if (!secRows[0]) throw notFound('Section not found');

  // Upsert each record
  for (const record of input.records) {
    await query(
      `INSERT INTO attendance (school_id, student_id, section_id, date, status, marked_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (student_id, date)
       DO UPDATE SET status = $5, marked_by = $6`,
      [actor.schoolId, record.studentId, sectionId, input.date, record.status, actor.sub],
    );
  }

  // Fire notifications asynchronously for absentees
  const absentees = input.records.filter(r => r.status === 'absent');
  if (absentees.length > 0) {
    const ids = absentees.map(a => a.studentId);
    query<{ full_name: string; mobile: string | null; guardian_phone: string | null }>(
      `SELECT s.full_name, s.mobile, u.phone AS guardian_phone
         FROM students s
         LEFT JOIN guardian_students gs ON gs.student_id = s.id
         LEFT JOIN users u ON u.id = gs.guardian_id
        WHERE s.id = ANY($1) AND s.school_id = $2 AND s.deleted_at IS NULL`,
      [ids, actor.schoolId]
    ).then(({ rows }) => {
      for (const row of rows) {
        notifyStudentAbsent(
          actor.schoolId,
          row.full_name,
          row.mobile,
          row.guardian_phone,
          input.date
        ).catch(console.error);
      }
    }).catch(console.error);
  }

  return { saved: input.records.length, date: input.date, sectionId };
}

// ── Single student mark ────────────────────────────────────────────────────

interface AttendanceRow {
  id: string;
  school_id: string;
  student_id: string;
  section_id: string | null;
  date: string;
  status: string;
  marked_by: string | null;
  created_at: string;
}

function toAttendanceDto(r: AttendanceRow) {
  return {
    id: r.id,
    schoolId: r.school_id,
    studentId: r.student_id,
    sectionId: r.section_id,
    date: r.date,
    status: r.status,
    markedBy: r.marked_by,
    createdAt: r.created_at,
  };
}

export async function singleMark(
  actor: AccessClaims,
  studentId: string,
  input: SingleMarkInput,
) {
  // Verify student belongs to this school
  const { rows: stuRows } = await query<{ section_id: string | null }>(
    `SELECT section_id FROM students WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}`,
    [studentId, actor.schoolId],
  );
  if (!stuRows[0]) throw notFound('Student not found');
  if (stuRows[0].section_id) {
    await verifyTeacherSection(actor, stuRows[0].section_id);
  }

  const { rows } = await query<AttendanceRow>(
    `INSERT INTO attendance (school_id, student_id, section_id, date, status, marked_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (student_id, date)
     DO UPDATE SET status = $5, marked_by = $6
     RETURNING id, school_id, student_id, section_id, date::text AS date,
               status, marked_by, created_at`,
    [actor.schoolId, studentId, stuRows[0].section_id, input.date, input.status, actor.sub],
  );
  return toAttendanceDto(rows[0]);
}

// ── Attendance report ─────────────────────────────────────────────────────

interface ReportQuery {
  sectionId?: string;
  from?: string;
  to?: string;
  status?: string;
}

interface ReportRow {
  student_id: string;
  full_name: string;
  admission_no: string;
  total_present: number;
  total_absent: number;
  total_late: number;
  total_marked: number;
  attendance_pct: number;
}

function toReportDto(r: ReportRow) {
  return {
    studentId: r.student_id,
    fullName: r.full_name,
    admissionNo: r.admission_no,
    totalPresent: Number(r.total_present),
    totalAbsent: Number(r.total_absent),
    totalLate: Number(r.total_late),
    totalMarked: Number(r.total_marked),
    attendancePct: Math.round(Number(r.attendance_pct) * 100) / 100,
  };
}

export async function getReport(actor: AccessClaims, q: ReportQuery) {
  const from = q.from ?? startOfMonthStr();
  const to = q.to ?? todayStr();

  const where: string[] = ['a.school_id = $1', 'a.date BETWEEN $2 AND $3'];
  const params: unknown[] = [actor.schoolId, from, to];

  if (q.sectionId) {
    params.push(q.sectionId);
    where.push(`a.section_id = $${params.length}`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`a.status = $${params.length}`);
  }
  if (actor.role === 'teacher') {
    params.push(actor.sub);
    where.push(`a.section_id IN (${TEACHER_SECTION_SCOPE_SQL.replace(/\$1/g, `$${params.length}`)})`);
  }

  const whereSql = where.join(' AND ');

  const { rows } = await query<ReportRow>(
    `SELECT
        s.id AS student_id, s.full_name, s.admission_no,
        count(*) FILTER (WHERE a.status = 'present')::int AS total_present,
        count(*) FILTER (WHERE a.status = 'absent')::int  AS total_absent,
        count(*) FILTER (WHERE a.status = 'late')::int    AS total_late,
        count(*)::int                                       AS total_marked,
        CASE WHEN count(*) > 0
             THEN round(count(*) FILTER (WHERE a.status = 'present')::numeric / count(*) * 100, 2)
             ELSE 0 END AS attendance_pct
       FROM attendance a
       JOIN students s ON s.id = a.student_id
      WHERE ${whereSql}
        AND s.${NOT_DELETED}
      GROUP BY s.id, s.full_name, s.admission_no
      ORDER BY s.full_name`,
    params,
  );

  const totalStudents = rows.length;
  const totalPresent = rows.reduce((sum, r) => sum + Number(r.total_present), 0);
  const totalAbsent = rows.reduce((sum, r) => sum + Number(r.total_absent), 0);
  const avgPct = totalStudents > 0
    ? Math.round(rows.reduce((sum, r) => sum + Number(r.attendance_pct), 0) / totalStudents * 100) / 100
    : 0;

  return {
    data: rows.map(toReportDto),
    summary: {
      totalStudents,
      avgAttendancePct: avgPct,
      totalPresent,
      totalAbsent,
    },
  };
}

// ── School-wide summary for a single date ─────────────────────────────────

export async function getDailySummary(actor: AccessClaims, date?: string) {
  const targetDate = date ?? todayStr();


  const params: unknown[] = [actor.schoolId];

  let studentScopeSql = '';
  if (actor.role === 'teacher') {
    params.push(actor.sub);
    studentScopeSql = `AND section_id IN (${TEACHER_SECTION_SCOPE_SQL.replace(/\$1/g, `$${params.length}`)})`;
  }

  const [totalRes, markedRes] = await Promise.all([
    query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM students
        WHERE school_id = $1 AND ${NOT_DELETED} ${studentScopeSql}`,
      params,
    ),
    query<{ present: number; absent: number; late: number; total_marked: number }>(
      `SELECT
          count(*) FILTER (WHERE status = 'present')::int AS present,
          count(*) FILTER (WHERE status = 'absent')::int  AS absent,
          count(*) FILTER (WHERE status = 'late')::int    AS late,
          count(*)::int                                    AS total_marked
         FROM attendance
        WHERE school_id = $1 AND date = $2 ${studentScopeSql}`,
      [actor.schoolId, targetDate, ...params.slice(1)],
    ),
  ]);

  const totalStudents = Number(totalRes.rows[0]?.total ?? 0);
  const m = markedRes.rows[0];
  const totalMarked = Number(m?.total_marked ?? 0);

  return {
    data: {
      date: targetDate,
      totalStudents,
      present: Number(m?.present ?? 0),
      absent: Number(m?.absent ?? 0),
      late: Number(m?.late ?? 0),
      unmarked: totalStudents - totalMarked,
    },
  };
}
