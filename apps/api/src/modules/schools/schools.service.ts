import { query, withTransaction } from '../../config/db.js';
import { conflict, notFound } from '../../utils/http-error.js';
import { createDefaultRoles } from './defaultRoles.js';
import type { AccessClaims } from '../../utils/jwt.js';
import type { CreateSchoolInput, ListSchoolsQuery, UpdateSchoolInput } from './schools.schema.js';

/** Columns returned to clients — never leak internal-only fields. */
const SCHOOL_COLS = 'id, name, code, address, timezone, logo_url, created_at, plan_id, subscription_status, trial_ends_at';

// Every read excludes soft-deleted tenants (blueprint §3 — soft delete).
const NOT_DELETED = 'deleted_at IS NULL';

/**
 * Paginated list of NON-deleted schools. This is a cross-tenant view, so it is
 * gated by the schools:read permission which only super_admin ('*') holds.
 */
export async function list(q: ListSchoolsQuery) {
  const where: string[] = [NOT_DELETED];
  const params: unknown[] = [];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query(
      `SELECT ${SCHOOL_COLS}
         FROM schools
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(`SELECT count(*)::int AS total FROM schools WHERE ${whereSql}`, params),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

/** Fetch one non-deleted school by id (cross-tenant read; super_admin only). */
export async function getById(id: string) {
  const { rows } = await query(
    `SELECT ${SCHOOL_COLS} FROM schools WHERE id = $1 AND ${NOT_DELETED}`,
    [id],
  );
  if (!rows[0]) throw notFound('School not found');
  return rows[0];
}

/** The caller's own tenant, resolved from the access token (no cross-tenant leak). */
export async function getCurrent(actor: AccessClaims) {
  const { rows } = await query(
    `SELECT s.${SCHOOL_COLS.replace(/,/g, ', s.')},
            sp.name as plan_name, sp.max_students, sp.max_teachers
     FROM schools s
     LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
     WHERE s.id = $1 AND s.${NOT_DELETED}`,
    [actor.schoolId],
  );
  if (!rows[0]) throw notFound('School not found');
  
  const school = rows[0];

  // Fetch usage
  const [{ rows: studentRows }, { rows: teacherRows }] = await Promise.all([
    query(`SELECT count(*) as total FROM students WHERE school_id = $1 AND deleted_at IS NULL`, [actor.schoolId]),
    query(`SELECT count(*) as total FROM users u JOIN roles r ON u.role_id = r.id WHERE u.school_id = $1 AND r.name = 'teacher' AND u.deleted_at IS NULL`, [actor.schoolId])
  ]);

  return {
    ...school,
    usage: {
      students: { current: parseInt(studentRows[0].total, 10), max: school.max_students },
      teachers: { current: parseInt(teacherRows[0].total, 10), max: school.max_teachers }
    }
  };
}

/**
 * Create a school and seed its six default roles in one transaction so a tenant
 * can never exist without its roles (blueprint §2/§6).
 */
export async function create(input: CreateSchoolInput) {
  return withTransaction(async (client) => {
    const dup = await client.query(`SELECT 1 FROM schools WHERE code = $1`, [input.code]);
    if (dup.rows[0]) throw conflict('School code already in use');

    const { rows } = await client.query(
      `INSERT INTO schools (name, code, address, timezone, logo_url)
       VALUES ($1, $2, $3, COALESCE($4, 'Asia/Karachi'), $5)
       RETURNING ${SCHOOL_COLS}`,
      [input.name, input.code, input.address ?? null, input.timezone ?? null, input.logoUrl ?? null],
    );
    const school = rows[0];

    await createDefaultRoles(client, school.id);
    return school;
  }).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw conflict('School code already in use');
    }
    throw err;
  });
}

/**
 * Patch a school by id. Only the provided fields are updated (COALESCE keeps the
 * existing value when a field is omitted). Returns the prior row alongside the
 * updated one so the controller can write a before/after audit entry.
 */
export async function update(id: string, input: UpdateSchoolInput) {
  const { rows: beforeRows } = await query(
    `SELECT ${SCHOOL_COLS} FROM schools WHERE id = $1 AND ${NOT_DELETED}`,
    [id],
  );
  const before = beforeRows[0];
  if (!before) throw notFound('School not found');

  const { rows } = await query(
    `UPDATE schools
        SET name      = COALESCE($2, name),
            address   = COALESCE($3, address),
            timezone  = COALESCE($4, timezone),
            logo_url  = COALESCE($5, logo_url)
      WHERE id = $1 AND ${NOT_DELETED}
      RETURNING ${SCHOOL_COLS}`,
    [id, input.name ?? null, input.address ?? null, input.timezone ?? null, input.logoUrl ?? null],
  );
  return { before, after: rows[0] };
}

export async function softDelete(id: string) {
  const { rows } = await query(
    `UPDATE schools
        SET deleted_at = now()
      WHERE id = $1 AND ${NOT_DELETED}
      RETURNING ${SCHOOL_COLS}`,
    [id],
  );
  if (!rows[0]) throw notFound('School not found');
  return rows[0];
}

export async function suspend(id: string) {
  const { rows } = await query(
    `UPDATE schools
        SET subscription_status = 'past_due'
      WHERE id = $1 AND ${NOT_DELETED}
      RETURNING ${SCHOOL_COLS}`,
    [id]
  );
  if (!rows[0]) throw notFound('School not found');
  return rows[0];
}

export async function reactivate(id: string) {
  const { rows } = await query(
    `UPDATE schools
        SET subscription_status = 'active'
      WHERE id = $1 AND ${NOT_DELETED}
      RETURNING ${SCHOOL_COLS}`,
    [id]
  );
  if (!rows[0]) throw notFound('School not found');
  return rows[0];
}

export async function cancel(id: string) {
  const { rows } = await query(
    `UPDATE schools
        SET subscription_status = 'canceled'
      WHERE id = $1 AND ${NOT_DELETED}
      RETURNING ${SCHOOL_COLS}`,
    [id]
  );
  if (!rows[0]) throw notFound('School not found');
  return rows[0];
}
