import { query, withTransaction } from '../../config/db.js';
import type { PoolClient } from 'pg';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, conflict } from '../../utils/http-error.js';
import { hashPassword } from '../../utils/password.js';
import type {
  ListQuery,
  CreateTeacherInput,
  UpdateTeacherInput,
} from './teachers.schema.js';

// Teachers are `staff` rows with staff_type='teacher', tenant-scoped, soft-deleted.
const NOT_DELETED = 'deleted_at IS NULL';
const STAFF_COLS = `id, user_id, employee_id, full_name, email, phone, cnic, gender, qualification,
  experience_years, designation, base_salary, joining_date, status`;

interface StaffRow {
  id: string;
  user_id: string | null;
  employee_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  cnic: string | null;
  gender: string | null;
  qualification: string | null;
  experience_years: number | null;
  designation: string | null;
  base_salary: string | number;
  joining_date: string | null;
  status: string;
}

interface SubjectRow {
  id: string;
  name: string;
  code: string | null;
}

function toTeacherDto(r: StaffRow, subjects?: SubjectRow[]) {
  return {
    id: r.id,
    userId: r.user_id,
    employeeId: r.employee_id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    cnic: r.cnic,
    gender: r.gender,
    qualification: r.qualification,
    experienceYears: r.experience_years,
    designation: r.designation,
    // Money is BIGINT minor units, returned as a number.
    baseSalary: Number(r.base_salary),
    joiningDate: r.joining_date,
    status: r.status,
    ...(subjects ? { subjects: subjects.map(toSubjectDto) } : {}),
  };
}

const toSubjectDto = (s: SubjectRow) => ({ id: s.id, name: s.name, code: s.code });

/** Load assigned subjects for a teacher (tenant-scoped). */
async function loadSubjects(
  schoolId: string,
  staffId: string,
  client?: PoolClient,
): Promise<SubjectRow[]> {
  const sql = `SELECT sub.id, sub.name, sub.code
       FROM teacher_subjects ts
       JOIN subjects sub ON sub.id = ts.subject_id
      WHERE ts.staff_id = $1 AND ts.school_id = $2
      ORDER BY sub.name`;
  const params = [staffId, schoolId];
  const { rows } = client
    ? await client.query<SubjectRow>(sql, params)
    : await query<SubjectRow>(sql, params);
  return rows;
}

export async function list(actor: AccessClaims, q: ListQuery) {
  const where: string[] = ['school_id = $1', `staff_type = 'teacher'`, NOT_DELETED];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`(full_name ILIKE $${params.length} OR employee_id ILIKE $${params.length})`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<StaffRow>(
      `SELECT ${STAFF_COLS} FROM staff
        WHERE ${whereSql}
        ORDER BY full_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(`SELECT count(*)::int AS total FROM staff WHERE ${whereSql}`, params),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map((r) => toTeacherDto(r)),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function getById(actor: AccessClaims, id: string) {
  const { rows } = await query<StaffRow>(
    `SELECT ${STAFF_COLS} FROM staff
      WHERE id = $1 AND school_id = $2 AND staff_type = 'teacher' AND ${NOT_DELETED}`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Teacher not found');
  const subjects = await loadSubjects(actor.schoolId, id);
  return toTeacherDto(rows[0], subjects);
}

/**
 * Create a teacher (staff_type='teacher') and assign optional subjects in one
 * transaction. employee_id is unique per tenant (handled via 23505 → conflict).
 */
export async function create(actor: AccessClaims, input: CreateTeacherInput) {
  return withTransaction(async (client) => {
    let userId: string | null = null;
    
    if (input.createUser && input.username && input.password) {
      const roleRes = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE school_id = $1 AND name = 'teacher'`,
        [actor.schoolId]
      );
      if (roleRes.rows[0]) {
        const passwordHash = await hashPassword(input.password);
        try {
          const userRes = await client.query<{ id: string }>(
            `INSERT INTO users (school_id, role_id, username, email, password_hash, full_name)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [actor.schoolId, roleRes.rows[0].id, input.username, input.email ?? null, passwordHash, input.fullName]
          );
          userId = userRes.rows[0].id;
        } catch (err: any) {
          if (err?.code === '23505') {
            if (err.constraint?.includes('email')) throw conflict('Email already in use');
            throw conflict('Username already in use');
          }
          throw err;
        }
      }
    }

    const { rows } = await client.query<StaffRow>(
      `INSERT INTO staff
         (school_id, user_id, staff_type, employee_id, full_name, email, phone, cnic, gender,
          qualification, experience_years, designation, base_salary, joining_date)
       VALUES ($1,$2,'teacher',$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,0),$13)
       RETURNING ${STAFF_COLS}`,
      [
        actor.schoolId, userId, input.employeeId, input.fullName, input.email ?? null, input.phone ?? null,
        input.cnic ?? null, input.gender ?? null, input.qualification ?? null,
        input.experienceYears ?? null, input.designation ?? null,
        input.baseSalary ?? null, input.joiningDate ?? null,
      ],
    );
    const teacher = rows[0];
    if (input.subjectIds && input.subjectIds.length) {
      await replaceSubjects(client, actor.schoolId, teacher.id, input.subjectIds);
    }
    const subjects = await loadSubjects(actor.schoolId, teacher.id, client);
    return toTeacherDto(teacher, subjects);
  }).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      if ((err as any).constraint?.includes('email')) throw conflict('Email already in use');
      if ((err as any).constraint?.includes('username')) throw conflict('Username already in use');
      throw conflict('Employee ID already in use');
    }
    throw err;
  });
}

export async function update(actor: AccessClaims, id: string, input: UpdateTeacherInput) {
  return withTransaction(async (client) => {
    const { rows: beforeRows } = await client.query<StaffRow>(
      `SELECT ${STAFF_COLS} FROM staff
        WHERE id = $1 AND school_id = $2 AND staff_type = 'teacher' AND ${NOT_DELETED}`,
      [id, actor.schoolId],
    );
    const before = beforeRows[0];
    if (!before) throw notFound('Teacher not found');

    let userId = before.user_id;

    if (input.createUser && input.username && input.password) {
      if (!userId) {
        // Create new user
        const roleRes = await client.query<{ id: string }>(
          `SELECT id FROM roles WHERE school_id = $1 AND name = 'teacher'`,
          [actor.schoolId]
        );
        if (roleRes.rows[0]) {
          const passwordHash = await hashPassword(input.password);
          try {
            const userRes = await client.query<{ id: string }>(
              `INSERT INTO users (school_id, role_id, username, email, password_hash, full_name)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [actor.schoolId, roleRes.rows[0].id, input.username, input.email ?? before.email, passwordHash, input.fullName ?? before.full_name]
            );
            userId = userRes.rows[0].id;
          } catch (err: any) {
            if (err?.code === '23505') {
              if (err.constraint?.includes('email')) throw conflict('Email already in use');
              throw conflict('Username already in use');
            }
            throw err;
          }
        }
      } else {
        // Update existing user
        const passwordHash = await hashPassword(input.password);
        try {
          await client.query(
            `UPDATE users SET username = $1, password_hash = $2 WHERE id = $3 AND school_id = $4`,
            [input.username, passwordHash, userId, actor.schoolId]
          );
        } catch (err: any) {
          if (err?.code === '23505') throw conflict('Username already in use');
          throw err;
        }
      }
    }

    const { rows } = await client.query<StaffRow>(
      `UPDATE staff
          SET user_id          = COALESCE($3, user_id),
              full_name        = COALESCE($4, full_name),
              email            = COALESCE($5, email),
              phone            = COALESCE($6, phone),
              cnic             = COALESCE($7, cnic),
              gender           = COALESCE($8, gender),
              qualification    = COALESCE($9, qualification),
              experience_years = COALESCE($10, experience_years),
              designation      = COALESCE($11, designation),
              base_salary      = COALESCE($12, base_salary),
              joining_date     = COALESCE($13, joining_date),
              status           = COALESCE($14, status)
        WHERE id = $1 AND school_id = $2 AND staff_type = 'teacher' AND ${NOT_DELETED}
        RETURNING ${STAFF_COLS}`,
      [
        id, actor.schoolId, userId, input.fullName ?? null, input.email ?? null, input.phone ?? null,
        input.cnic ?? null, input.gender ?? null, input.qualification ?? null,
        input.experienceYears ?? null, input.designation ?? null, input.baseSalary ?? null,
        input.joiningDate ?? null, input.status ?? null,
      ],
    );
    const subjects = await loadSubjects(actor.schoolId, id, client);
    return { before: toTeacherDto(before), after: toTeacherDto(rows[0], subjects) };
  });
}

/** Soft delete a teacher (blueprint §3). Returns the row for audit. */
export async function softDelete(actor: AccessClaims, id: string) {
  const { rows } = await query<StaffRow>(
    `UPDATE staff SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND staff_type = 'teacher' AND ${NOT_DELETED}
      RETURNING ${STAFF_COLS}`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Teacher not found');
  return toTeacherDto(rows[0]);
}

/** Read the subject assignment set for a teacher. */
export async function getSubjects(actor: AccessClaims, id: string) {
  // Ensure the teacher exists in this tenant first.
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM staff
      WHERE id = $1 AND school_id = $2 AND staff_type = 'teacher' AND ${NOT_DELETED}`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Teacher not found');
  const subjects = await loadSubjects(actor.schoolId, id);
  return subjects.map(toSubjectDto);
}

/** Internal: wipe and re-insert the teacher↔subject set (tenant-scoped). */
async function replaceSubjects(
  client: PoolClient,
  schoolId: string,
  staffId: string,
  subjectIds: string[],
) {
  await client.query(`DELETE FROM teacher_subjects WHERE staff_id = $1 AND school_id = $2`, [
    staffId,
    schoolId,
  ]);
  for (const subjectId of subjectIds) {
    await client.query(
      `INSERT INTO teacher_subjects (staff_id, subject_id, school_id) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [staffId, subjectId, schoolId],
    );
  }
}

/** Replace the full subject-assignment set for a teacher (transactional). */
export async function setSubjects(actor: AccessClaims, id: string, subjectIds: string[]) {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM staff
        WHERE id = $1 AND school_id = $2 AND staff_type = 'teacher' AND ${NOT_DELETED}`,
      [id, actor.schoolId],
    );
    if (!rows[0]) throw notFound('Teacher not found');
    await replaceSubjects(client, actor.schoolId, id, subjectIds);
    const subjects = await loadSubjects(actor.schoolId, id, client);
    return subjects.map(toSubjectDto);
  });
}
