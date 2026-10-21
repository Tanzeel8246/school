import { query, withTransaction } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { badRequest, notFound } from '../../utils/http-error.js';
import type {
  ListSessionsQuery,
  CreateSessionInput,
  UpdateSessionInput,
  ListClassesQuery,
  CreateClassInput,
  UpdateClassInput,
  ListSectionsQuery,
  CreateSectionInput,
  UpdateSectionInput,
  ListSubjectsQuery,
  CreateSubjectInput,
  UpdateSubjectInput,
  CreateTimetableSlotInput,
  UpdateTimetableSlotInput,
} from './academics.schema.js';

// ── Session DTOs ──────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

function toSessionDto(r: SessionRow) {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    isActive: r.is_active,
  };
}

// ── Sessions ──────────────────────────────────────────────────────────────

export async function listSessions(actor: AccessClaims, q: ListSessionsQuery) {
  const where: string[] = ['school_id = $1'];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`name ILIKE $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<SessionRow>(
      `SELECT id, school_id, name, start_date::text AS start_date, end_date::text AS end_date,
              is_active
         FROM academic_sessions
        WHERE ${whereSql}
        ORDER BY start_date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM academic_sessions WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toSessionDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createSession(actor: AccessClaims, input: CreateSessionInput) {
  const { rows } = await query<SessionRow>(
    `INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, school_id, name, start_date::text AS start_date, end_date::text AS end_date,
               is_active`,
    [actor.schoolId, input.name, input.startDate, input.endDate, input.isActive ?? false],
  );
  return toSessionDto(rows[0]);
}

export async function updateSession(
  actor: AccessClaims,
  id: string,
  input: UpdateSessionInput,
) {
  const { rows: beforeRows } = await query<SessionRow>(
    `SELECT id, school_id, name, start_date::text AS start_date, end_date::text AS end_date,
            is_active
       FROM academic_sessions WHERE id = $1 AND school_id = $2`,
    [id, actor.schoolId],
  );
  if (!beforeRows[0]) throw notFound('Academic session not found');
  const before = beforeRows[0];

  return withTransaction(async (client) => {
    // If activating, deactivate all other sessions for this school first
    if (input.isActive === true) {
      await client.query(
        `UPDATE academic_sessions SET is_active = false WHERE school_id = $1 AND id != $2`,
        [actor.schoolId, id],
      );
    }

    const { rows } = await client.query<SessionRow>(
      `UPDATE academic_sessions
          SET name       = COALESCE($3, name),
              start_date = COALESCE($4::date, start_date),
              end_date   = COALESCE($5::date, end_date),
              is_active  = COALESCE($6, is_active)
        WHERE id = $1 AND school_id = $2
        RETURNING id, school_id, name, start_date::text AS start_date, end_date::text AS end_date,
                  is_active`,
      [
        id, actor.schoolId,
        input.name ?? null,
        input.startDate ?? null,
        input.endDate ?? null,
        input.isActive ?? null,
      ],
    );
    return { before: toSessionDto(before), after: toSessionDto(rows[0]) };
  });
}

export async function deleteSession(actor: AccessClaims, id: string) {
  // Check that no active (non-deleted) classes reference this session
  const { rows: classRows } = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM classes WHERE session_id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (Number(classRows[0]?.total ?? 0) > 0) {
    throw badRequest('Cannot delete session with existing classes');
  }

  const { rows } = await query<SessionRow>(
    `DELETE FROM academic_sessions WHERE id = $1 AND school_id = $2
     RETURNING id, school_id, name, start_date::text AS start_date, end_date::text AS end_date,
               is_active`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Academic session not found');
  return toSessionDto(rows[0]);
}

// ── Class DTOs ────────────────────────────────────────────────────────────

interface ClassRow {
  id: string;
  session_id: string;
  name: string;
  level: number;
}

function toClassDto(r: ClassRow) {
  return {
    id: r.id,
    sessionId: r.session_id,
    name: r.name,
    level: r.level,
  };
}

// ── Classes ───────────────────────────────────────────────────────────────

export async function listClasses(actor: AccessClaims, q: ListClassesQuery) {
  const where: string[] = ['s.school_id = $1', 'cl.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.sessionId) {
    params.push(q.sessionId);
    where.push(`cl.session_id = $${params.length}`);
  }
  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`cl.name ILIKE $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<ClassRow>(
      `SELECT cl.id, cl.session_id, cl.name, cl.level
         FROM classes cl
         JOIN academic_sessions s ON s.id = cl.session_id
        WHERE ${whereSql}
        ORDER BY s.start_date DESC, cl.level, cl.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM classes cl
         JOIN academic_sessions s ON s.id = cl.session_id
        WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toClassDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createClass(actor: AccessClaims, input: CreateClassInput) {
  // Verify session belongs to this school
  const { rows: sessRows } = await query<{ id: string }>(
    `SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2`,
    [input.sessionId, actor.schoolId],
  );
  if (!sessRows[0]) throw notFound('Academic session not found');

  const { rows } = await query<ClassRow>(
    `INSERT INTO classes (session_id, name, level) VALUES ($1, $2, $3)
     RETURNING id, session_id, name, level`,
    [input.sessionId, input.name, input.level],
  );
  return toClassDto(rows[0]);
}

export async function updateClass(
  actor: AccessClaims,
  id: string,
  input: UpdateClassInput,
) {
  // Confirm class belongs to this school via session
  const { rows: beforeRows } = await query<ClassRow>(
    `SELECT cl.id, cl.session_id, cl.name, cl.level
       FROM classes cl
       JOIN academic_sessions s ON s.id = cl.session_id
      WHERE cl.id = $1 AND s.school_id = $2`,
    [id, actor.schoolId],
  );
  if (!beforeRows[0]) throw notFound('Class not found');
  const before = beforeRows[0];

  const { rows } = await query<ClassRow>(
    `UPDATE classes
        SET name  = COALESCE($2, name),
            level = COALESCE($3, level)
      WHERE id = $1
      RETURNING id, session_id, name, level`,
    [id, input.name ?? null, input.level ?? null],
  );
  return { before: toClassDto(before), after: toClassDto(rows[0]) };
}

export async function deleteClass(actor: AccessClaims, id: string) {
  // Confirm class belongs to this school and is not already deleted
  const { rows: classRows } = await query<ClassRow>(
    `SELECT cl.id, cl.session_id, cl.name, cl.level
       FROM classes cl
       JOIN academic_sessions s ON s.id = cl.session_id
      WHERE cl.id = $1 AND s.school_id = $2 AND cl.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!classRows[0]) throw notFound('Class not found');

  // Check for existing active sections
  const { rows: secRows } = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM sections WHERE class_id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (Number(secRows[0]?.total ?? 0) > 0) {
    throw badRequest('Cannot delete class with existing sections');
  }

  // Soft delete — history محفوظ رہے
  await query(`UPDATE classes SET deleted_at = now() WHERE id = $1`, [id]);
  return toClassDto(classRows[0]);
}

// ── Section DTOs ──────────────────────────────────────────────────────────

interface SectionRow {
  id: string;
  class_id: string;
  name: string;
  capacity: number;
  teacher_id: string | null;
  teacher_name: string | null;
}

function toSectionDto(r: SectionRow) {
  return {
    id: r.id,
    classId: r.class_id,
    name: r.name,
    capacity: r.capacity,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
  };
}

// ── Sections ──────────────────────────────────────────────────────────────

export async function listSections(actor: AccessClaims, q: ListSectionsQuery) {
  const where: string[] = ['s.school_id = $1', 'sec.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.classId) {
    params.push(q.classId);
    where.push(`sec.class_id = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<SectionRow>(
      `SELECT sec.id, sec.class_id, sec.name, sec.capacity, sec.teacher_id,
              st.full_name AS teacher_name
         FROM sections sec
         JOIN classes cl ON cl.id = sec.class_id
         JOIN academic_sessions s ON s.id = cl.session_id
         LEFT JOIN staff st ON st.id = sec.teacher_id
        WHERE ${whereSql}
        ORDER BY sec.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM sections sec
         JOIN classes cl ON cl.id = sec.class_id
         JOIN academic_sessions s ON s.id = cl.session_id
        WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toSectionDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createSection(actor: AccessClaims, input: CreateSectionInput) {
  // Verify class belongs to this school
  const { rows: classRows } = await query<{ id: string }>(
    `SELECT cl.id FROM classes cl
       JOIN academic_sessions s ON s.id = cl.session_id
      WHERE cl.id = $1 AND s.school_id = $2`,
    [input.classId, actor.schoolId],
  );
  if (!classRows[0]) throw notFound('Class not found');

  const { rows } = await query<SectionRow>(
    `INSERT INTO sections (class_id, name, capacity, teacher_id)
     VALUES ($1, $2, COALESCE($3, 40), $4)
     RETURNING id, class_id, name, capacity, teacher_id, NULL::text AS teacher_name`,
    [input.classId, input.name, input.capacity ?? null, input.teacherId ?? null],
  );
  return toSectionDto(rows[0]);
}

export async function updateSection(
  actor: AccessClaims,
  id: string,
  input: UpdateSectionInput,
) {
  const { rows: beforeRows } = await query<SectionRow>(
    `SELECT sec.id, sec.class_id, sec.name, sec.capacity, sec.teacher_id,
            st.full_name AS teacher_name
       FROM sections sec
       JOIN classes cl ON cl.id = sec.class_id
       JOIN academic_sessions s ON s.id = cl.session_id
       LEFT JOIN staff st ON st.id = sec.teacher_id
      WHERE sec.id = $1 AND s.school_id = $2`,
    [id, actor.schoolId],
  );
  if (!beforeRows[0]) throw notFound('Section not found');
  const before = beforeRows[0];

  // teacherId=undefined → keep existing; teacherId=null → clear; teacherId=uuid → set
  const teacherIdSql =
    input.teacherId === undefined
      ? 'teacher_id'              // keep existing value
      : input.teacherId === null
        ? 'NULL'                  // explicitly clear
        : `$4::uuid`;             // set to new value

  const { rows } = await query<SectionRow>(
    `UPDATE sections
        SET name       = COALESCE($2, name),
            capacity   = COALESCE($3, capacity),
            teacher_id = ${teacherIdSql}
      WHERE id = $1
      RETURNING id, class_id, name, capacity, teacher_id, NULL::text AS teacher_name`,
    [id, input.name ?? null, input.capacity ?? null, input.teacherId ?? null],
  );
  return { before: toSectionDto(before), after: toSectionDto(rows[0]) };
}

export async function deleteSection(actor: AccessClaims, id: string) {
  // Confirm section belongs to school and is not already soft-deleted
  const { rows: secRows } = await query<SectionRow>(
    `SELECT sec.id, sec.class_id, sec.name, sec.capacity, sec.teacher_id,
            NULL::text AS teacher_name
       FROM sections sec
       JOIN classes cl ON cl.id = sec.class_id
       JOIN academic_sessions s ON s.id = cl.session_id
      WHERE sec.id = $1 AND s.school_id = $2 AND sec.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!secRows[0]) throw notFound('Section not found');

  // Check for assigned active students
  const { rows: stuRows } = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM students WHERE section_id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (Number(stuRows[0]?.total ?? 0) > 0) {
    throw badRequest('Cannot delete section with assigned students');
  }

  // Soft delete — section history محفوظ رہے
  await query(`UPDATE sections SET deleted_at = now() WHERE id = $1`, [id]);
  return toSectionDto(secRows[0]);
}

// ── Subject DTOs ──────────────────────────────────────────────────────────

interface SubjectRow {
  id: string;
  class_id: string;
  name: string;
  code: string | null;
  is_elective: boolean;
}

function toSubjectDto(r: SubjectRow) {
  return {
    id: r.id,
    classId: r.class_id,
    name: r.name,
    code: r.code,
    isElective: r.is_elective,
  };
}

// ── Subjects ──────────────────────────────────────────────────────────────

export async function listSubjects(actor: AccessClaims, q: ListSubjectsQuery) {
  const where: string[] = ['s.school_id = $1'];
  const params: unknown[] = [actor.schoolId];

  if (q.classId) {
    params.push(q.classId);
    where.push(`sub.class_id = $${params.length}`);
  }
  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`(sub.name ILIKE $${params.length} OR sub.code ILIKE $${params.length})`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<SubjectRow>(
      `SELECT sub.id, sub.class_id, sub.name, sub.code, sub.is_elective
         FROM subjects sub
         JOIN classes cl ON cl.id = sub.class_id
         JOIN academic_sessions s ON s.id = cl.session_id
        WHERE ${whereSql}
        ORDER BY sub.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM subjects sub
         JOIN classes cl ON cl.id = sub.class_id
         JOIN academic_sessions s ON s.id = cl.session_id
        WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toSubjectDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createSubject(actor: AccessClaims, input: CreateSubjectInput) {
  // Verify class belongs to this school
  const { rows: classRows } = await query<{ id: string }>(
    `SELECT cl.id FROM classes cl
       JOIN academic_sessions s ON s.id = cl.session_id
      WHERE cl.id = $1 AND s.school_id = $2`,
    [input.classId, actor.schoolId],
  );
  if (!classRows[0]) throw notFound('Class not found');

  const { rows } = await query<SubjectRow>(
    `INSERT INTO subjects (class_id, name, code, is_elective)
     VALUES ($1, $2, $3, $4)
     RETURNING id, class_id, name, code, is_elective`,
    [input.classId, input.name, input.code ?? null, input.isElective ?? false],
  );
  return toSubjectDto(rows[0]);
}

export async function updateSubject(
  actor: AccessClaims,
  id: string,
  input: UpdateSubjectInput,
) {
  const { rows: beforeRows } = await query<SubjectRow>(
    `SELECT sub.id, sub.class_id, sub.name, sub.code, sub.is_elective
       FROM subjects sub
       JOIN classes cl ON cl.id = sub.class_id
       JOIN academic_sessions s ON s.id = cl.session_id
      WHERE sub.id = $1 AND s.school_id = $2`,
    [id, actor.schoolId],
  );
  if (!beforeRows[0]) throw notFound('Subject not found');
  const before = beforeRows[0];

  const { rows } = await query<SubjectRow>(
    `UPDATE subjects
        SET name        = COALESCE($2, name),
            code        = COALESCE($3, code),
            is_elective = COALESCE($4, is_elective)
      WHERE id = $1
      RETURNING id, class_id, name, code, is_elective`,
    [id, input.name ?? null, input.code ?? null, input.isElective ?? null],
  );
  return { before: toSubjectDto(before), after: toSubjectDto(rows[0]) };
}

export async function deleteSubject(actor: AccessClaims, id: string) {
  const { rows: subRows } = await query<SubjectRow>(
    `SELECT sub.id, sub.class_id, sub.name, sub.code, sub.is_elective
       FROM subjects sub
       JOIN classes cl ON cl.id = sub.class_id
       JOIN academic_sessions s ON s.id = cl.session_id
      WHERE sub.id = $1 AND s.school_id = $2 AND sub.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!subRows[0]) throw notFound('Subject not found');

  // Check for exam results referencing this subject
  const { rows: resRows } = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM exam_results WHERE subject_id = $1`,
    [id],
  );
  if (Number(resRows[0]?.total ?? 0) > 0) {
    throw badRequest('Cannot delete subject with existing exam results');
  }

  // Soft delete
  await query(`UPDATE subjects SET deleted_at = now() WHERE id = $1`, [id]);
  return toSubjectDto(subRows[0]);
}

// ── Timetable DTOs ────────────────────────────────────────────────────────

interface TimetableSlotRow {
  id: string;
  section_id: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string | null;
  weekday: number;
  period: number;
  start_time: string;
  end_time: string;
}

function toTimetableSlotDto(r: TimetableSlotRow) {
  return {
    id: r.id,
    sectionId: r.section_id,
    subjectId: r.subject_id,
    subjectName: r.subject_name,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    weekday: r.weekday,
    period: r.period,
    startTime: r.start_time,
    endTime: r.end_time,
  };
}

const TIMETABLE_COLS = `ts.id, ts.section_id, ts.subject_id, sub.name AS subject_name,
  ts.teacher_id, st.full_name AS teacher_name,
  ts.weekday, ts.period,
  ts.start_time::text AS start_time, ts.end_time::text AS end_time`;

// ── Timetable ─────────────────────────────────────────────────────────────

export async function listTimetable(actor: AccessClaims, sectionId?: string) {
  const where: string[] = ['s.school_id = $1'];
  const params: unknown[] = [actor.schoolId];

  if (sectionId) {
    params.push(sectionId);
    where.push(`ts.section_id = $${params.length}`);
  }

  const { rows } = await query<TimetableSlotRow>(
    `SELECT ${TIMETABLE_COLS}
       FROM timetable_slots ts
       JOIN subjects sub ON sub.id = ts.subject_id
       JOIN sections sec ON sec.id = ts.section_id
       JOIN classes cl ON cl.id = sec.class_id
       JOIN academic_sessions s ON s.id = cl.session_id
       LEFT JOIN staff st ON st.id = ts.teacher_id
      WHERE ${where.join(' AND ')}
      ORDER BY ts.weekday ASC, ts.period ASC`,
    params,
  );

  return { data: rows.map(toTimetableSlotDto) };
}

export async function createTimetableSlot(
  actor: AccessClaims,
  input: CreateTimetableSlotInput,
) {
  // Verify section belongs to this school
  const { rows: secRows } = await query<{ id: string }>(
    `SELECT sec.id FROM sections sec
       JOIN classes cl ON cl.id = sec.class_id
       JOIN academic_sessions s ON s.id = cl.session_id
      WHERE sec.id = $1 AND s.school_id = $2 AND sec.deleted_at IS NULL`,
    [input.sectionId, actor.schoolId],
  );
  if (!secRows[0]) throw notFound('Section not found');

  // ── Teacher double-booking check ──────────────────────────────────────────
  // DB unique index (idx_teacher_no_double_booking) بھی یہی catch کرتا ہے مگر
  // service layer میں check سے clear error message ملتی ہے۔
  if (input.teacherId) {
    const { rows: clashRows } = await query<{ id: string; section_name: string }>(
      `SELECT ts.id, sec.name AS section_name
         FROM timetable_slots ts
         JOIN sections sec ON sec.id = ts.section_id
        WHERE ts.teacher_id = $1
          AND ts.weekday = $2
          AND ts.period = $3
          AND ts.deleted_at IS NULL`,
      [input.teacherId, input.weekday, input.period],
    );
    if (clashRows[0]) {
      throw badRequest(
        `Teacher is already assigned to section "${clashRows[0].section_name}" ` +
        `on weekday ${input.weekday} period ${input.period}. Double-booking prevented.`,
      );
    }
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO timetable_slots
       (section_id, subject_id, teacher_id, weekday, period, start_time, end_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.sectionId, input.subjectId, input.teacherId,
      input.weekday, input.period, input.startTime, input.endTime,
    ],
  );

  // Re-fetch with joins for full DTO (subject_name, teacher_name)
  return getTimetableSlotById(actor, rows[0].id);
}

async function getTimetableSlotById(actor: AccessClaims, id: string) {
  const { rows } = await query<TimetableSlotRow>(
    `SELECT ${TIMETABLE_COLS}
       FROM timetable_slots ts
       JOIN subjects sub ON sub.id = ts.subject_id
       JOIN sections sec ON sec.id = ts.section_id
       JOIN classes cl ON cl.id = sec.class_id
       JOIN academic_sessions s ON s.id = cl.session_id
       LEFT JOIN staff st ON st.id = ts.teacher_id
      WHERE ts.id = $1 AND s.school_id = $2`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Timetable slot not found');
  return toTimetableSlotDto(rows[0]);
}

export async function updateTimetableSlot(
  actor: AccessClaims,
  id: string,
  input: UpdateTimetableSlotInput,
) {
  // Confirm slot belongs to school
  const before = await getTimetableSlotById(actor, id);

  // ── Teacher double-booking check on update ────────────────────────────────
  const newTeacherId = input.teacherId ?? before.teacherId;
  const newWeekday   = input.weekday   ?? before.weekday;
  const newPeriod    = input.period    ?? before.period;

  if (newTeacherId) {
    const { rows: clashRows } = await query<{ id: string; section_name: string }>(
      `SELECT ts.id, sec.name AS section_name
         FROM timetable_slots ts
         JOIN sections sec ON sec.id = ts.section_id
        WHERE ts.teacher_id = $1
          AND ts.weekday = $2
          AND ts.period = $3
          AND ts.id != $4             -- اپنے آپ کو exclude کریں
          AND ts.deleted_at IS NULL`,
      [newTeacherId, newWeekday, newPeriod, id],
    );
    if (clashRows[0]) {
      throw badRequest(
        `Teacher is already assigned to section "${clashRows[0].section_name}" ` +
        `on weekday ${newWeekday} period ${newPeriod}. Double-booking prevented.`,
      );
    }
  }

  const { rows } = await query<{ id: string }>(
    `UPDATE timetable_slots
        SET subject_id = COALESCE($2, subject_id),
            teacher_id = COALESCE($3, teacher_id),
            weekday    = COALESCE($4, weekday),
            period     = COALESCE($5, period),
            start_time = COALESCE($6::time, start_time),
            end_time   = COALESCE($7::time, end_time)
      WHERE id = $1
      RETURNING id`,
    [
      id,
      input.subjectId ?? null,
      input.teacherId ?? null,
      input.weekday ?? null,
      input.period ?? null,
      input.startTime ?? null,
      input.endTime ?? null,
    ],
  );
  if (!rows[0]) throw notFound('Timetable slot not found');

  const after = await getTimetableSlotById(actor, id);
  return { before, after };
}

export async function deleteTimetableSlot(actor: AccessClaims, id: string) {
  const slot = await getTimetableSlotById(actor, id);
  // Soft delete — timetable history audit کے لیے محفوظ رہے
  await query(`UPDATE timetable_slots SET deleted_at = now() WHERE id = $1`, [id]);
  return slot;
}
