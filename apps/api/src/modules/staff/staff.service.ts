import { query } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, conflict } from '../../utils/http-error.js';
import type {
  ListStaffQuery,
  CreateStaffInput,
  UpdateStaffInput,
  AttendanceQuery,
  MarkAttendanceInput,
  ListLeavesQuery,
  CreateLeaveInput,
  PayslipsQuery,
  RunPayrollInput,
} from './staff.schema.js';
import { hashPassword } from '../../utils/password.js';
import { withTransaction } from '../../config/db.js';

// All staff reads are tenant-scoped and exclude soft-deleted rows (blueprint §3).
const NOT_DELETED = 'deleted_at IS NULL';
const STAFF_COLS = `id, user_id, employee_id, staff_type, full_name, email, phone, cnic, gender, address,
  qualification, experience_years, designation, base_salary, joining_date, leaving_date, status`;

// ---------- Row types ----------
interface StaffRow {
  id: string;
  user_id: string | null;
  employee_id: string;
  staff_type: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  cnic: string | null;
  gender: string | null;
  address: string | null;
  qualification: string | null;
  experience_years: number | null;
  designation: string | null;
  base_salary: string | number;
  joining_date: string | null;
  leaving_date: string | null;
  status: string;
}

interface AttendanceRow {
  id: string;
  staff_id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
}

interface LeaveRow {
  id: string;
  staff_id: string;
  staff_name: string | null;
  leave_type: string;
  from_date: string;
  to_date: string;
  days: number | null;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface PayslipRow {
  id: string;
  staff_id: string;
  staff_name: string | null;
  period_month: string;
  base_salary: string | number;
  allowances: string | number;
  deductions: string | number;
  net_salary: string | number;
  status: string;
}

// ---------- DTO mappers (snake_case row -> camelCase DTO) ----------
function toStaffDto(r: StaffRow) {
  return {
    id: r.id,
    userId: r.user_id,
    employeeId: r.employee_id,
    staffType: r.staff_type,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    cnic: r.cnic,
    gender: r.gender,
    address: r.address,
    qualification: r.qualification,
    experienceYears: r.experience_years,
    designation: r.designation,
    baseSalary: Number(r.base_salary), // BIGINT minor units -> number
    joiningDate: r.joining_date,
    leavingDate: r.leaving_date,
    status: r.status,
  };
}

const toAttendanceDto = (r: AttendanceRow) => ({
  id: r.id,
  staffId: r.staff_id,
  date: r.date,
  status: r.status,
  checkIn: r.check_in,
  checkOut: r.check_out,
});

const toLeaveDto = (r: LeaveRow) => ({
  id: r.id,
  staffId: r.staff_id,
  staffName: r.staff_name,
  leaveType: r.leave_type,
  fromDate: r.from_date,
  toDate: r.to_date,
  days: r.days,
  reason: r.reason,
  status: r.status,
  reviewedBy: r.reviewed_by,
  reviewedAt: r.reviewed_at,
  createdAt: r.created_at,
});

const toPayslipDto = (r: PayslipRow) => ({
  id: r.id,
  staffId: r.staff_id,
  staffName: r.staff_name,
  periodMonth: r.period_month,
  baseSalary: Number(r.base_salary),
  allowances: Number(r.allowances),
  deductions: Number(r.deductions),
  netSalary: Number(r.net_salary),
  status: r.status,
});

// ---------- Staff CRUD ----------
export async function list(actor: AccessClaims, q: ListStaffQuery) {
  const where: string[] = ['school_id = $1', NOT_DELETED];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`(full_name ILIKE $${params.length} OR employee_id ILIKE $${params.length})`);
  }
  if (q.staffType) {
    params.push(q.staffType);
    where.push(`staff_type ILIKE $${params.length}`);
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
    data: dataRes.rows.map(toStaffDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function getById(actor: AccessClaims, id: string) {
  const { rows } = await query<StaffRow>(
    `SELECT ${STAFF_COLS} FROM staff WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Staff not found');
  
  const { rows: subRows } = await query<{ subject_id: string }>(`SELECT subject_id FROM teacher_subjects WHERE staff_id = $1`, [id]);
  const { rows: secRows } = await query<{ id: string }>(`SELECT id FROM sections WHERE teacher_id = $1 LIMIT 1`, [id]);

  return {
    ...toStaffDto(rows[0]),
    subjectIds: subRows.map(r => r.subject_id),
    inchargeSectionId: secRows[0]?.id || null,
  };
}

export async function create(actor: AccessClaims, input: CreateStaffInput) {
  return withTransaction(async (client) => {
    let userId: string | null = null;
    
    if (input.createUser && input.username && input.password) {
      let roleName = 'staff';
      if (input.staffType.toLowerCase().includes('accountant') || input.designation?.toLowerCase().includes('accountant')) {
        roleName = 'accountant';
      }
      
      const roleRes = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE school_id = $1 AND name = $2`,
        [actor.schoolId, roleName]
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

    try {
      const { rows } = await client.query<StaffRow>(
        `INSERT INTO staff
           (school_id, user_id, employee_id, staff_type, full_name, email, phone, cnic, gender, address,
            qualification, experience_years, designation, base_salary, joining_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14,0),$15)
         RETURNING ${STAFF_COLS}`,
        [
          actor.schoolId, userId, input.employeeId, input.staffType, input.fullName, input.email ?? null,
          input.phone ?? null, input.cnic ?? null, input.gender ?? null, input.address ?? null,
          input.qualification ?? null, input.experienceYears ?? null, input.designation ?? null,
          input.baseSalary ?? null, input.joiningDate ?? null,
        ],
      );
      const staffRow = rows[0];

      if (input.subjectIds && input.subjectIds.length > 0) {
        for (const sid of input.subjectIds) {
          await client.query(
            `INSERT INTO teacher_subjects (staff_id, subject_id, school_id) VALUES ($1, $2, $3)`,
            [staffRow.id, sid, actor.schoolId]
          );
        }
      }

      if (input.inchargeSectionId) {
        await client.query(
          `UPDATE sections SET teacher_id = $1 WHERE id = $2`,
          [staffRow.id, input.inchargeSectionId]
        );
      }

      return toStaffDto(staffRow);
    } catch (err: any) {
      if (err?.code === '23505') throw conflict('Employee ID already in use');
      throw err;
    }
  });
}

export async function update(actor: AccessClaims, id: string, input: UpdateStaffInput) {
  return withTransaction(async (client) => {
    const { rows: beforeRows } = await client.query<StaffRow>(
      `SELECT ${STAFF_COLS} FROM staff WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}`,
      [id, actor.schoolId],
    );
    const before = beforeRows[0];
    if (!before) throw notFound('Staff not found');

    let userId = before.user_id;

    if (input.createUser && input.username && input.password) {
      if (!userId) {
        let roleName = 'staff';
        if ((input.staffType || before.staff_type).toLowerCase().includes('accountant') || 
            (input.designation || before.designation)?.toLowerCase().includes('accountant')) {
          roleName = 'accountant';
        }
        
        const roleRes = await client.query<{ id: string }>(
          `SELECT id FROM roles WHERE school_id = $1 AND name = $2`,
          [actor.schoolId, roleName]
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
              staff_type       = COALESCE($4, staff_type),
              full_name        = COALESCE($5, full_name),
              email            = COALESCE($6, email),
              phone            = COALESCE($7, phone),
              cnic             = COALESCE($8, cnic),
              gender           = COALESCE($9, gender),
              address          = COALESCE($10, address),
              qualification    = COALESCE($11, qualification),
              experience_years = COALESCE($12, experience_years),
              designation      = COALESCE($13, designation),
              base_salary      = COALESCE($14, base_salary),
              joining_date     = COALESCE($15, joining_date),
              leaving_date     = COALESCE($16, leaving_date),
              status           = COALESCE($17, status)
        WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}
        RETURNING ${STAFF_COLS}`,
      [
        id, actor.schoolId, userId, input.staffType ?? null, input.fullName ?? null, input.email ?? null,
        input.phone ?? null, input.cnic ?? null, input.gender ?? null, input.address ?? null,
        input.qualification ?? null, input.experienceYears ?? null, input.designation ?? null,
        input.baseSalary ?? null, input.joiningDate ?? null, input.leavingDate ?? null,
        input.status ?? null,
      ],
    );
    const staffRow = rows[0];

    if (input.subjectIds !== undefined) {
      await client.query(`DELETE FROM teacher_subjects WHERE staff_id = $1 AND school_id = $2`, [id, actor.schoolId]);
      if (input.subjectIds.length > 0) {
        for (const sid of input.subjectIds) {
          await client.query(
            `INSERT INTO teacher_subjects (staff_id, subject_id, school_id) VALUES ($1, $2, $3)`,
            [id, sid, actor.schoolId]
          );
        }
      }
    }

    if (input.inchargeSectionId !== undefined) {
      await client.query(`UPDATE sections SET teacher_id = NULL WHERE teacher_id = $1`, [id]);
      if (input.inchargeSectionId) {
        await client.query(
          `UPDATE sections SET teacher_id = $1 WHERE id = $2`,
          [id, input.inchargeSectionId]
        );
      }
    }

    return { before: toStaffDto(before), after: toStaffDto(staffRow) };
  });
}

export async function softDelete(actor: AccessClaims, id: string) {
  const { rows } = await query<StaffRow>(
    `UPDATE staff SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}
      RETURNING ${STAFF_COLS}`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Staff not found');
  return toStaffDto(rows[0]);
}

/** Internal: assert a staff row exists in this tenant (else notFound). */
async function assertStaffExists(actor: AccessClaims, staffId: string) {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM staff WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}`,
    [staffId, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Staff not found');
}

// ---------- Attendance ----------
export async function listAttendance(actor: AccessClaims, staffId: string, q: AttendanceQuery) {
  await assertStaffExists(actor, staffId);
  const where: string[] = ['school_id = $1', 'staff_id = $2'];
  const params: unknown[] = [actor.schoolId, staffId];
  if (q.from) {
    params.push(q.from);
    where.push(`date >= $${params.length}`);
  }
  if (q.to) {
    params.push(q.to);
    where.push(`date <= $${params.length}`);
  }
  const { rows } = await query<AttendanceRow>(
    `SELECT id, staff_id, date, status, check_in, check_out
       FROM staff_attendance
      WHERE ${where.join(' AND ')}
      ORDER BY date DESC`,
    params,
  );
  return rows.map(toAttendanceDto);
}

/** Mark/update today's attendance — upsert on (staff_id, date). */
export async function markAttendance(
  actor: AccessClaims,
  staffId: string,
  input: MarkAttendanceInput,
) {
  await assertStaffExists(actor, staffId);
  const { rows } = await query<AttendanceRow>(
    `INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in, check_out, marked_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (staff_id, date) DO UPDATE
       SET status = EXCLUDED.status,
           check_in = EXCLUDED.check_in,
           check_out = EXCLUDED.check_out,
           marked_by = EXCLUDED.marked_by
     RETURNING id, staff_id, date, status, check_in, check_out`,
    [actor.schoolId, staffId, input.date, input.status, input.checkIn ?? null, input.checkOut ?? null, actor.sub],
  );
  return toAttendanceDto(rows[0]);
}

// ---------- Leaves ----------
export async function listLeaves(actor: AccessClaims, q: ListLeavesQuery) {
  const where: string[] = ['l.school_id = $1', 'l.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];
  if (q.status) {
    params.push(q.status);
    where.push(`l.status = $${params.length}`);
  }
  if (q.staffId) {
    params.push(q.staffId);
    where.push(`l.staff_id = $${params.length}`);
  }
  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<LeaveRow>(
      `SELECT l.id, l.staff_id, st.full_name AS staff_name, l.leave_type, l.from_date, l.to_date,
              l.days, l.reason, l.status, l.reviewed_by, l.reviewed_at, l.created_at
         FROM staff_leaves l
         JOIN staff st ON st.id = l.staff_id
        WHERE ${whereSql}
        ORDER BY l.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM staff_leaves l WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toLeaveDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createLeave(actor: AccessClaims, input: CreateLeaveInput) {
  await assertStaffExists(actor, input.staffId);
  // Inclusive day count between fromDate and toDate.
  const { rows } = await query<LeaveRow>(
    `WITH ins AS (
       INSERT INTO staff_leaves
         (school_id, staff_id, leave_type, from_date, to_date, days, reason, status)
       VALUES ($1,$2,$3,$4,$5,($5::date - $4::date) + 1,$6,'pending')
       RETURNING *
     )
     SELECT ins.id, ins.staff_id, st.full_name AS staff_name, ins.leave_type, ins.from_date,
            ins.to_date, ins.days, ins.reason, ins.status, ins.reviewed_by, ins.reviewed_at,
            ins.created_at
       FROM ins JOIN staff st ON st.id = ins.staff_id`,
    [actor.schoolId, input.staffId, input.leaveType, input.fromDate, input.toDate, input.reason ?? null],
  );
  return toLeaveDto(rows[0]);
}

/** Internal: transition a leave's status (approve/reject), tenant-scoped. */
async function reviewLeave(
  actor: AccessClaims,
  id: string,
  newStatus: 'approved' | 'rejected',
  reason?: string,
) {
  const { rows: beforeRows } = await query<LeaveRow>(
    `SELECT l.id, l.staff_id, st.full_name AS staff_name, l.leave_type, l.from_date, l.to_date,
            l.days, l.reason, l.status, l.reviewed_by, l.reviewed_at, l.created_at
       FROM staff_leaves l JOIN staff st ON st.id = l.staff_id
      WHERE l.id = $1 AND l.school_id = $2 AND l.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  const before = beforeRows[0];
  if (!before) throw notFound('Leave request not found');

  const { rows } = await query<LeaveRow>(
    `WITH upd AS (
       UPDATE staff_leaves
          SET status = $3,
              reviewed_by = $4,
              reviewed_at = now(),
              reason = COALESCE($5, reason)
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
        RETURNING *
     )
     SELECT upd.id, upd.staff_id, st.full_name AS staff_name, upd.leave_type, upd.from_date,
            upd.to_date, upd.days, upd.reason, upd.status, upd.reviewed_by, upd.reviewed_at,
            upd.created_at
       FROM upd JOIN staff st ON st.id = upd.staff_id`,
    [id, actor.schoolId, newStatus, actor.sub, reason ?? null],
  );
  return { before: toLeaveDto(before), after: toLeaveDto(rows[0]) };
}

export const approveLeave = (actor: AccessClaims, id: string) =>
  reviewLeave(actor, id, 'approved');

export const rejectLeave = (actor: AccessClaims, id: string, reason?: string) =>
  reviewLeave(actor, id, 'rejected', reason);

// ---------- Payroll ----------
export async function listPayslips(actor: AccessClaims, q: PayslipsQuery) {
  const where: string[] = ['p.school_id = $1'];
  const params: unknown[] = [actor.schoolId];
  if (q.period) {
    params.push(`${q.period}-01`);
    where.push(`p.period_month = date_trunc('month', $${params.length}::date)`);
  }
  if (q.staffId) {
    params.push(q.staffId);
    where.push(`p.staff_id = $${params.length}`);
  }
  const { rows } = await query<PayslipRow>(
    `SELECT p.id, p.staff_id, st.full_name AS staff_name, p.period_month, p.base_salary,
            p.allowances, p.deductions, p.net_salary, p.status
       FROM payslips p
       JOIN staff st ON st.id = p.staff_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.period_month DESC, st.full_name`,
    params,
  );
  return rows.map(toPayslipDto);
}

/**
 * Generate one draft payslip per active staff for the given month, skipping any
 * that already exist (ON CONFLICT DO NOTHING makes the run idempotent).
 * net = base + allowances - deductions. Returns the count generated.
 */
export async function runPayroll(actor: AccessClaims, input: RunPayrollInput) {
  const periodDate = `${input.period}-01`;
  const allowances = input.allowances ?? 0;
  const deductions = input.deductions ?? 0;

  const { rows } = await query<{ id: string }>(
    `INSERT INTO payslips
       (school_id, staff_id, period_month, base_salary, allowances, deductions, net_salary, status)
     SELECT s.school_id, s.id, date_trunc('month', $2::date)::date,
            s.base_salary, $3, $4, (s.base_salary + $3 - $4), 'draft'
       FROM staff s
      WHERE s.school_id = $1 AND s.status = 'active' AND s.deleted_at IS NULL
     ON CONFLICT (staff_id, period_month) DO NOTHING
     RETURNING id`,
    [actor.schoolId, periodDate, allowances, deductions],
  );
  return { generated: rows.length };
}

/** Salary summary for one staff member + their most recent payslip (if any). */
export async function getStaffPayroll(actor: AccessClaims, staffId: string) {
  const { rows: staffRows } = await query<{ base_salary: string | number }>(
    `SELECT base_salary FROM staff WHERE id = $1 AND school_id = $2 AND ${NOT_DELETED}`,
    [staffId, actor.schoolId],
  );
  if (!staffRows[0]) throw notFound('Staff not found');

  const { rows } = await query<PayslipRow>(
    `SELECT p.id, p.staff_id, st.full_name AS staff_name, p.period_month, p.base_salary,
            p.allowances, p.deductions, p.net_salary, p.status
       FROM payslips p
       JOIN staff st ON st.id = p.staff_id
      WHERE p.staff_id = $1 AND p.school_id = $2
      ORDER BY p.period_month DESC
      LIMIT 1`,
    [staffId, actor.schoolId],
  );
  return {
    baseSalary: Number(staffRows[0].base_salary),
    lastPayslip: rows[0] ? toPayslipDto(rows[0]) : null,
  };
}
