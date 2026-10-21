import { query, withTransaction } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import type {
  ListQuery,
  CreateStudentInput,
  UpdateStudentInput,
} from './students.schema.js';
import { notFound, conflict } from '../../utils/http-error.js';
import { hashPassword } from '../../utils/password.js';

/** Full column list for single-student reads (DB snake_case). */
const STUDENT_COLS = `id, user_id, admission_no, roll_no, full_name, father_name, mother_name,
  cnic_bform, dob, gender, blood_group, religion, address, mobile, emergency_contact,
  previous_school, admission_date, section_id, status, photo_url`;

// Every read excludes soft-deleted rows (blueprint §3 — soft delete).
const NOT_DELETED = 'deleted_at IS NULL';

interface StudentRow {
  id: string;
  user_id: string | null;
  admission_no: string;
  roll_no: string | null;
  full_name: string;
  father_name: string | null;
  mother_name: string | null;
  cnic_bform: string | null;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  religion: string | null;
  address: string | null;
  mobile: string | null;
  emergency_contact: string | null;
  previous_school: string | null;
  admission_date: string | null;
  section_id: string | null;
  status: string;
  photo_url: string | null;
  section_name?: string | null;
  class_name?: string | null;
}

/** Map a snake_case DB row to the camelCase Student DTO (service-layer mapping). */
function toStudentDto(r: StudentRow) {
  return {
    id: r.id,
    userId: r.user_id,
    admissionNo: r.admission_no,
    rollNo: r.roll_no,
    fullName: r.full_name,
    fatherName: r.father_name,
    motherName: r.mother_name,
    cnicBform: r.cnic_bform,
    dob: r.dob,
    gender: r.gender,
    bloodGroup: r.blood_group,
    religion: r.religion,
    address: r.address,
    mobile: r.mobile,
    emergencyContact: r.emergency_contact,
    previousSchool: r.previous_school,
    admissionDate: r.admission_date,
    sectionId: r.section_id,
    sectionName: r.section_name,
    className: r.class_name,
    status: r.status,
    photoUrl: r.photo_url,
  };
}

interface HistoryRow {
  id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: string;
}

function toHistoryDto(r: HistoryRow) {
  return {
    id: r.id,
    eventType: r.event_type,
    fromValue: r.from_value,
    toValue: r.to_value,
    note: r.note,
    createdAt: r.created_at,
  };
}

/**
 * List students with search + filters + pagination, ALWAYS scoped to the
 * caller's tenant. Teachers are additionally scoped to their own sections
 * (data-scope resolution, blueprint §6). Returns camelCase DTOs.
 */
export async function list(actor: AccessClaims, q: ListQuery) {
  const where: string[] = ['s.school_id = $1', `s.${NOT_DELETED}`];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`(s.full_name ILIKE $${params.length} OR s.admission_no ILIKE $${params.length})`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`s.status = $${params.length}`);
  }
  if (q.sectionId) {
    params.push(q.sectionId);
    where.push(`s.section_id = $${params.length}`);
  }
  // Teacher data-scope: limit to sections they are class teacher / timetabled for.
  if (actor.role === 'teacher') {
    params.push(actor.sub);
    where.push(`s.section_id IN (
      SELECT sec.id FROM sections sec
      JOIN staff st ON st.id = sec.teacher_id
      WHERE st.user_id = $${params.length}
      UNION
      SELECT tt.section_id FROM timetable_slots tt
      JOIN staff st2 ON st2.id = tt.teacher_id
      WHERE st2.user_id = $${params.length}
    )`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<StudentRow>(
      `SELECT s.id, s.user_id, s.admission_no, s.roll_no, s.full_name, s.father_name, s.mother_name,
              s.cnic_bform, s.dob, s.gender, s.blood_group, s.religion, s.address, s.mobile, s.emergency_contact,
              s.previous_school, s.admission_date, s.section_id, s.status, s.photo_url,
              sec.name AS section_name, cl.name AS class_name
         FROM students s
         LEFT JOIN sections sec ON sec.id = s.section_id
         LEFT JOIN classes cl ON cl.id = sec.class_id
        WHERE ${whereSql}
        ORDER BY s.full_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(`SELECT count(*)::int AS total FROM students s WHERE ${whereSql}`, params),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toStudentDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function getById(actor: AccessClaims, id: string) {
  const { rows } = await query<StudentRow>(
    `SELECT ${STUDENT_COLS} FROM students
      WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Student not found');
  return toStudentDto(rows[0]);
}

export async function listGuardians(actor: AccessClaims) {
  const { rows } = await query(
    `SELECT g.id, g.full_name, g.phone, g.relation,
            u.email, u.username, u.id as user_id,
            json_agg(json_build_object('id', s.id, 'name', s.full_name, 'admissionNo', s.admission_no)) FILTER (WHERE s.id IS NOT NULL) as students
       FROM guardians g
       LEFT JOIN users u ON u.id = g.user_id
       LEFT JOIN guardian_students gs ON gs.guardian_id = g.id
       LEFT JOIN students s ON s.id = gs.student_id AND s.deleted_at IS NULL
      WHERE g.school_id = $1
      GROUP BY g.id, u.id
      ORDER BY g.full_name`,
    [actor.schoolId]
  );
  return rows.map(r => ({
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    relation: r.relation,
    email: r.email,
    username: r.username,
    userId: r.user_id,
    students: r.students || []
  }));
}

export async function resetGuardianPassword(actor: AccessClaims, guardianId: string, passwordRaw: string) {
  const { rows } = await query<{ user_id: string }>(
    `SELECT user_id FROM guardians WHERE id = $1 AND school_id = $2`,
    [guardianId, actor.schoolId]
  );
  if (!rows[0]) throw notFound('Guardian not found');
  const userId = rows[0].user_id;
  if (!userId) throw conflict('Guardian does not have a login account');
  
  const passwordHash = await hashPassword(passwordRaw);
  await query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND school_id = $3`,
    [passwordHash, userId, actor.schoolId]
  );
}

export async function create(actor: AccessClaims, input: CreateStudentInput) {
  return withTransaction(async (client) => {
    let userId: string | null = null;
    
    if (input.createUser && input.username && input.password) {
      const roleRes = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE school_id = $1 AND name = 'student'`,
        [actor.schoolId]
      );
      if (roleRes.rows[0]) {
        const passwordHash = await hashPassword(input.password);
        try {
          const userRes = await client.query<{ id: string }>(
            `INSERT INTO users (school_id, role_id, username, email, password_hash, full_name)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [actor.schoolId, roleRes.rows[0].id, input.username, `${input.username}@student.local`, passwordHash, input.fullName]
          );
          userId = userRes.rows[0].id;
        } catch (err: any) {
          if (err?.code === '23505') throw conflict('Username already in use');
          throw err;
        }
      }
    }

    const { rows } = await client.query<StudentRow>(
      `INSERT INTO students
         (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, mother_name,
          cnic_bform, dob, gender, blood_group, religion, address, mobile, emergency_contact,
          previous_school, admission_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
               COALESCE($18, current_date))
       RETURNING ${STUDENT_COLS}`,
      [
        actor.schoolId, userId, input.sectionId ?? null, input.admissionNo, input.rollNo ?? null,
        input.fullName, input.fatherName ?? null, input.motherName ?? null, input.cnicBform ?? null,
        input.dob ?? null, input.gender ?? null, input.bloodGroup ?? null, input.religion ?? null,
        input.address ?? null, input.mobile ?? null, input.emergencyContact ?? null,
        input.previousSchool ?? null, input.admissionDate ?? null,
      ],
    );

    const studentId = rows[0].id;

    if (input.parentMode === 'existing' && input.existingGuardianId) {
      await client.query(
        `INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
        [input.existingGuardianId, studentId]
      );
    } else if (input.parentMode === 'new' && input.parentFullName) {
      const parentRoleRes = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE school_id = $1 AND name = 'parent'`,
        [actor.schoolId]
      );
      if (parentRoleRes.rows[0]) {
        const parentUsername = input.parentUsername || input.admissionNo;
        const parentPassword = input.parentPassword || input.admissionNo;
        const parentPasswordHash = await hashPassword(parentPassword);
        try {
          const parentUserRes = await client.query<{ id: string }>(
            `INSERT INTO users (school_id, role_id, username, email, password_hash, full_name, phone)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [actor.schoolId, parentRoleRes.rows[0].id, parentUsername, `${parentUsername}@parent.local`, parentPasswordHash, input.parentFullName, input.parentPhone ?? null]
          );
          
          const guardianRes = await client.query<{ id: string }>(
            `INSERT INTO guardians (school_id, user_id, full_name, relation, cnic, phone)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [actor.schoolId, parentUserRes.rows[0].id, input.parentFullName, input.parentRelation ?? null, input.parentCnic ?? null, input.parentPhone ?? null]
          );

          await client.query(
            `INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES ($1, $2, true)`,
            [guardianRes.rows[0].id, studentId]
          );
        } catch (err: any) {
          if (err?.code === '23505') throw conflict('Parent username already in use');
          throw err;
        }
      }
    }

    return toStudentDto(rows[0]);
  });
}

/** Partial update; COALESCE keeps existing values for omitted fields. */
export async function update(actor: AccessClaims, id: string, input: UpdateStudentInput) {
  return withTransaction(async (client) => {
    const { rows: beforeRows } = await client.query<StudentRow>(
      `SELECT ${STUDENT_COLS} FROM students
        WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}`,
      [id, actor.schoolId],
    );
    const before = beforeRows[0];
    if (!before) throw notFound('Student not found');

    let userId = before.user_id;

    if (input.createUser && input.username && input.password) {
      if (!userId) {
        // Create new user
        const roleRes = await client.query<{ id: string }>(
          `SELECT id FROM roles WHERE school_id = $1 AND name = 'student'`,
          [actor.schoolId]
        );
        if (roleRes.rows[0]) {
          const passwordHash = await hashPassword(input.password);
          try {
            const userRes = await client.query<{ id: string }>(
              `INSERT INTO users (school_id, role_id, username, email, password_hash, full_name)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [actor.schoolId, roleRes.rows[0].id, input.username, `${input.username}@student.local`, passwordHash, input.fullName ?? before.full_name]
            );
            userId = userRes.rows[0].id;
          } catch (err: any) {
            if (err?.code === '23505') throw conflict('Username already in use');
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

    const { rows } = await client.query<StudentRow>(
      `UPDATE students
          SET user_id           = COALESCE($3, user_id),
              roll_no           = COALESCE($4, roll_no),
              full_name         = COALESCE($5, full_name),
              father_name       = COALESCE($6, father_name),
              mother_name       = COALESCE($7, mother_name),
              cnic_bform        = COALESCE($8, cnic_bform),
              dob               = COALESCE($9, dob),
              gender            = COALESCE($10, gender),
              blood_group       = COALESCE($11, blood_group),
              religion          = COALESCE($12, religion),
              address           = COALESCE($13, address),
              mobile            = COALESCE($14, mobile),
              emergency_contact = COALESCE($15, emergency_contact),
              previous_school   = COALESCE($16, previous_school),
              section_id        = COALESCE($17, section_id),
              photo_url         = COALESCE($18, photo_url)
        WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}
        RETURNING ${STUDENT_COLS}`,
      [
        id, actor.schoolId, userId, input.rollNo ?? null, input.fullName ?? null, input.fatherName ?? null,
        input.motherName ?? null, input.cnicBform ?? null, input.dob ?? null, input.gender ?? null,
        input.bloodGroup ?? null, input.religion ?? null, input.address ?? null, input.mobile ?? null,
        input.emergencyContact ?? null, input.previousSchool ?? null, input.sectionId ?? null,
        input.photoUrl ?? null,
      ],
    );

    if (input.parentMode === 'existing' && input.existingGuardianId) {
      await client.query(`DELETE FROM guardian_students WHERE student_id = $1`, [id]);
      await client.query(
        `INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
        [input.existingGuardianId, id]
      );
    } else if (input.parentMode === 'new' && input.parentFullName) {
      const parentRoleRes = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE school_id = $1 AND name = 'parent'`,
        [actor.schoolId]
      );
      if (parentRoleRes.rows[0]) {
        const parentUsername = input.parentUsername || before.admission_no;
        const parentPassword = input.parentPassword || before.admission_no;
        const parentPasswordHash = await hashPassword(parentPassword);
        try {
          const parentUserRes = await client.query<{ id: string }>(
            `INSERT INTO users (school_id, role_id, username, email, password_hash, full_name, phone)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [actor.schoolId, parentRoleRes.rows[0].id, parentUsername, `${parentUsername}@parent.local`, parentPasswordHash, input.parentFullName, input.parentPhone ?? null]
          );
          
          const guardianRes = await client.query<{ id: string }>(
            `INSERT INTO guardians (school_id, user_id, full_name, relation, cnic, phone)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [actor.schoolId, parentUserRes.rows[0].id, input.parentFullName, input.parentRelation ?? null, input.parentCnic ?? null, input.parentPhone ?? null]
          );

          await client.query(`DELETE FROM guardian_students WHERE student_id = $1`, [id]);
          await client.query(
            `INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES ($1, $2, true)`,
            [guardianRes.rows[0].id, id]
          );
        } catch (err: any) {
          if (err?.code === '23505') throw conflict('Parent username already in use');
          throw err;
        }
      }
    }

    return { before: toStudentDto(before), after: toStudentDto(rows[0]) };
  });
}

/** Soft delete (blueprint §3). Returns the row for audit. */
export async function softDelete(actor: AccessClaims, id: string) {
  const { rows } = await query<StudentRow>(
    `UPDATE students SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}
      RETURNING ${STUDENT_COLS}`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Student not found');
  return toStudentDto(rows[0]);
}

/** Internal: load a student row scoped to tenant or throw notFound. */
async function loadOrThrow(actor: AccessClaims, id: string): Promise<StudentRow> {
  const { rows } = await query<StudentRow>(
    `SELECT ${STUDENT_COLS} FROM students
      WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Student not found');
  return rows[0];
}

/**
 * Promote/move a student to another section and append a history row in a
 * single transaction so the move and its trail can never diverge.
 */
export async function promote(actor: AccessClaims, id: string, sectionId: string, note?: string) {
  return withTransaction(async (client) => {
    const before = await loadOrThrow(actor, id);
    const { rows } = await client.query<StudentRow>(
      `UPDATE students SET section_id = $3
        WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}
        RETURNING ${STUDENT_COLS}`,
      [id, actor.schoolId, sectionId],
    );
    await client.query(
      `INSERT INTO student_history
         (school_id, student_id, event_type, from_value, to_value, note, created_by)
       VALUES ($1,$2,'promote',$3,$4,$5,$6)`,
      [actor.schoolId, id, before.section_id, sectionId, note ?? null, actor.sub],
    );
    return { before: toStudentDto(before), after: toStudentDto(rows[0]) };
  });
}

/**
 * Lifecycle status transition (transfer/suspend/reinstate) that records the
 * status change in student_history. Tenant-scoped + transactional.
 */
async function changeStatus(
  actor: AccessClaims,
  id: string,
  newStatus: string,
  eventType: string,
  note?: string,
) {
  return withTransaction(async (client) => {
    const before = await loadOrThrow(actor, id);
    const { rows } = await client.query<StudentRow>(
      `UPDATE students SET status = $3
        WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}
        RETURNING ${STUDENT_COLS}`,
      [id, actor.schoolId, newStatus],
    );
    await client.query(
      `INSERT INTO student_history
         (school_id, student_id, event_type, from_value, to_value, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [actor.schoolId, id, eventType, before.status, newStatus, note ?? null, actor.sub],
    );
    return { before: toStudentDto(before), after: toStudentDto(rows[0]) };
  });
}

export const transfer = (actor: AccessClaims, id: string, reason?: string) =>
  changeStatus(actor, id, 'transferred', 'transfer', reason);

export const suspend = (actor: AccessClaims, id: string, reason?: string) =>
  changeStatus(actor, id, 'suspended', 'suspend', reason);

export const reinstate = (actor: AccessClaims, id: string) =>
  changeStatus(actor, id, 'active', 'reinstate');

/** Lifecycle history for a student (tenant-scoped), newest first. */
export async function history(actor: AccessClaims, id: string) {
  // Confirms the student exists in this tenant before exposing its history.
  await loadOrThrow(actor, id);
  const { rows } = await query<HistoryRow>(
    `SELECT id, event_type, from_value, to_value, note, created_at
       FROM student_history
      WHERE student_id = $1 AND school_id = $2
      ORDER BY created_at DESC`,
    [id, actor.schoolId],
  );
  return rows.map(toHistoryDto);
}
