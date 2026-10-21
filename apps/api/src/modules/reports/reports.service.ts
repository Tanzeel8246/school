/**
 * Reports service — multi-tenant, all queries strictly scoped to actor.schoolId.
 * Each function returns { data, meta?, summary } ready for the controller to
 * pass directly to the JSON response or the export layer.
 *
 * Money values (fee/payroll) are BIGINT minor units (paisa) in the DB;
 * they are returned as Number() here — callers should not do further math.
 * COALESCE / NULLIF guards ensure empty tables never yield null in summaries.
 */
import { query } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import type {
  StudentsQuery,
  AttendanceQuery,
  FeesQuery,
  PayrollQuery,
  AccountingQuery,
} from './reports.schema.js';

// ── Helper: date defaults ─────────────────────────────────────────────────

function startOfMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function startOfYear(d = new Date()): string {
  return `${d.getFullYear()}-01-01`;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Row types (snake_case from pg) ─────────────────────────────────────────

interface StudentRow {
  id: string;
  admission_no: string;
  roll_no: string | null;
  full_name: string;
  father_name: string | null;
  gender: string;
  dob: string | null;
  mobile: string | null;
  status: string;
  admission_date: string | null;
  section_name: string | null;
  class_name: string | null;
}

interface StudentSummaryRow {
  total: string;
  active: string;
  suspended: string;
  transferred: string;
  left: string;
  alumni: string;
}

interface AttendanceRow {
  id: string;
  full_name: string;
  admission_no: string;
  section_name: string | null;
  present_days: string;
  absent_days: string;
  late_days: string;
  leave_days: string;
  total_marked: string;
  attendance_pct: string | null;
}

interface AttendanceSummaryRow {
  total_students: string;
  avg_attendance_pct: string | null;
  total_present: string;
  total_absent: string;
}

interface FeesRow {
  id: string;
  challan_no: string;
  billing_month: string | null;
  total: string;
  paid: string;
  outstanding: string;
  due_date: string;
  status: string;
  student_name: string;
  admission_no: string;
}

interface FeesSummaryRow {
  total_invoices: string;
  total_charged: string;
  total_collected: string;
  total_outstanding: string;
  defaulters_count: string;
}

interface PayrollRow {
  id: string;
  period_month: string;
  base_salary: string;
  allowances: string;
  deductions: string;
  net_salary: string;
  status: string;
  staff_name: string;
  employee_id: string;
  staff_type: string;
  designation: string | null;
}

interface PayrollSummaryRow {
  total_staff: string;
  total_net_salary: string;
  total_allowances: string;
  total_deductions: string;
}

interface AccountingRow {
  month: string;
  fee_income: string;
  payroll_expense: string;
  net: string;
}

// ── DTO mappers (snake_case → camelCase) ─────────────────────────────────

const toStudentDto = (r: StudentRow) => ({
  id:            r.id,
  admissionNo:   r.admission_no,
  rollNo:        r.roll_no,
  fullName:      r.full_name,
  fatherName:    r.father_name,
  gender:        r.gender,
  dob:           r.dob,
  mobile:        r.mobile,
  status:        r.status,
  admissionDate: r.admission_date,
  sectionName:   r.section_name,
  className:     r.class_name,
});

const toAttendanceDto = (r: AttendanceRow) => ({
  id:            r.id,
  fullName:      r.full_name,
  admissionNo:   r.admission_no,
  sectionName:   r.section_name,
  presentDays:   Number(r.present_days),
  absentDays:    Number(r.absent_days),
  lateDays:      Number(r.late_days),
  leaveDays:     Number(r.leave_days),
  totalMarked:   Number(r.total_marked),
  attendancePct: r.attendance_pct !== null ? Number(r.attendance_pct) : null,
});

const toFeesDto = (r: FeesRow) => ({
  id:           r.id,
  challanNo:    r.challan_no,
  billingMonth: r.billing_month,
  total:        Number(r.total),
  paid:         Number(r.paid),
  outstanding:  Number(r.outstanding),
  dueDate:      r.due_date,
  status:       r.status,
  studentName:  r.student_name,
  admissionNo:  r.admission_no,
});

const toPayrollDto = (r: PayrollRow) => ({
  id:          r.id,
  periodMonth: r.period_month,
  baseSalary:  Number(r.base_salary),
  allowances:  Number(r.allowances),
  deductions:  Number(r.deductions),
  netSalary:   Number(r.net_salary),
  status:      r.status,
  staffName:   r.staff_name,
  employeeId:  r.employee_id,
  staffType:   r.staff_type,
  designation: r.designation,
});

const toAccountingDto = (r: AccountingRow) => ({
  month:          r.month,
  feeIncome:      Number(r.fee_income),
  payrollExpense: Number(r.payroll_expense),
  net:            Number(r.net),
});

// ═══════════════════════════════════════════════════════════════════════════
// STUDENTS REPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Student listing scoped to actor.schoolId.
 * Filters: admission_date range, status, sectionId.
 */
export async function getStudentsReport(
  actor: AccessClaims,
  q: StudentsQuery,
): Promise<{ data: ReturnType<typeof toStudentDto>[]; meta: object; summary: object }> {
  const where: string[] = ['s.school_id = $1', 's.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.from) {
    params.push(q.from);
    where.push(`s.admission_date >= $${params.length}`);
  }
  if (q.to) {
    params.push(q.to);
    where.push(`s.admission_date <= $${params.length}`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`s.status = $${params.length}`);
  }
  if (q.sectionId) {
    params.push(q.sectionId);
    where.push(`s.section_id = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset   = (q.page - 1) * q.limit;

  const [dataRes, countRes, summaryRes] = await Promise.all([
    query<StudentRow>(
      `SELECT s.id, s.admission_no, s.roll_no, s.full_name, s.father_name,
              s.gender, s.dob, s.mobile, s.status, s.admission_date,
              sec.name AS section_name, c.name AS class_name
         FROM students s
         LEFT JOIN sections sec ON sec.id = s.section_id
         LEFT JOIN classes c ON c.id = sec.class_id
        WHERE ${whereSql}
        ORDER BY s.full_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: string }>(
      `SELECT count(*)::text AS total FROM students s WHERE ${whereSql}`,
      params,
    ),
    // Summary uses same filters (no page/limit) — separate query for correctness.
    query<StudentSummaryRow>(
      `SELECT
         count(*)::text                                            AS total,
         count(*) FILTER (WHERE s.status = 'active')::text        AS active,
         count(*) FILTER (WHERE s.status = 'suspended')::text     AS suspended,
         count(*) FILTER (WHERE s.status = 'transferred')::text   AS transferred,
         count(*) FILTER (WHERE s.status = 'left')::text          AS left,
         count(*) FILTER (WHERE s.status = 'alumni')::text        AS alumni
       FROM students s
      WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  const s     = summaryRes.rows[0];

  return {
    data: dataRes.rows.map(toStudentDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    summary: {
      total:       Number(s?.total ?? 0),
      active:      Number(s?.active ?? 0),
      suspended:   Number(s?.suspended ?? 0),
      transferred: Number(s?.transferred ?? 0),
      left:        Number(s?.left ?? 0),
      alumni:      Number(s?.alumni ?? 0),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTENDANCE REPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Per-student attendance aggregate for the given date range.
 * Defaults: from = start of current month, to = today.
 */
export async function getAttendanceReport(
  actor: AccessClaims,
  q: AttendanceQuery,
): Promise<{ data: ReturnType<typeof toAttendanceDto>[]; meta: object; summary: object }> {
  const fromDate = q.from ?? startOfMonth();
  const toDate   = q.to   ?? today();

  // Outer WHERE params — only school_id (and optional sectionId).
  // $1 = schoolId. sectionId, if present, will be at a dynamic position.
  const outerWhere: string[] = ['s.school_id = $1', 's.deleted_at IS NULL'];
  const outerParams: unknown[] = [actor.schoolId];

  if (q.sectionId) {
    outerParams.push(q.sectionId);
    outerWhere.push(`s.section_id = $${outerParams.length}`);
  }

  const outerWhereSql = outerWhere.join(' AND ');
  const offset        = (q.page - 1) * q.limit;

  // Full params for attendance queries:
  // $1=schoolId, $2=fromDate, $3=toDate [, $4=sectionId]
  const fullParams: unknown[] = [actor.schoolId, fromDate, toDate];

  // Rebuild sectionId filter with new positional offset for full queries.
  const fullWhere: string[] = ['s.school_id = $1', 's.deleted_at IS NULL'];
  if (q.sectionId) {
    fullParams.push(q.sectionId);
    fullWhere.push(`s.section_id = $${fullParams.length}`);
  }
  const fullWhereSql = fullWhere.join(' AND ');

  // Total count of students (for pagination) — uses outerParams only.
  const countRes = await query<{ total: string }>(
    `SELECT count(*)::text AS total FROM students s WHERE ${outerWhereSql}`,
    outerParams,
  );
  const total = Number(countRes.rows[0]?.total ?? 0);

  const [dataRes, summaryRes] = await Promise.all([
    query<AttendanceRow>(
      `SELECT s.id, s.full_name, s.admission_no, sec.name AS section_name,
              COALESCE(count(*) FILTER (WHERE a.status = 'present'), 0)::text AS present_days,
              COALESCE(count(*) FILTER (WHERE a.status = 'absent'),  0)::text AS absent_days,
              COALESCE(count(*) FILTER (WHERE a.status = 'late'),    0)::text AS late_days,
              COALESCE(count(*) FILTER (WHERE a.status = 'leave'),   0)::text AS leave_days,
              COALESCE(count(*), 0)::text AS total_marked,
              ROUND(
                100.0 * COALESCE(count(*) FILTER (WHERE a.status = 'present'), 0)
                / NULLIF(COALESCE(count(*), 0), 0)
              , 1)::text AS attendance_pct
         FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id
                                AND a.date BETWEEN $2 AND $3
         LEFT JOIN sections sec ON sec.id = s.section_id
        WHERE ${fullWhereSql}
        GROUP BY s.id, s.full_name, s.admission_no, sec.name
        ORDER BY s.full_name
        LIMIT $${fullParams.length + 1} OFFSET $${fullParams.length + 2}`,
      [...fullParams, q.limit, offset],
    ),

    // Summary — LATERAL subquery captures per-student attendance counts.
    query<AttendanceSummaryRow>(
      `SELECT
         count(DISTINCT s.id)::text AS total_students,
         ROUND(AVG(
           100.0 * COALESCE(sub.present_days, 0) / NULLIF(COALESCE(sub.total_marked, 0), 0)
         ), 1)::text AS avg_attendance_pct,
         COALESCE(SUM(sub.present_days), 0)::text AS total_present,
         COALESCE(SUM(sub.absent_days),  0)::text AS total_absent
       FROM students s
       LEFT JOIN LATERAL (
         SELECT
           count(*) FILTER (WHERE a2.status = 'present') AS present_days,
           count(*) FILTER (WHERE a2.status = 'absent')  AS absent_days,
           count(*)                                       AS total_marked
         FROM attendance a2
         WHERE a2.student_id = s.id AND a2.date BETWEEN $2 AND $3
       ) sub ON true
      WHERE ${fullWhereSql}`,
      fullParams,
    ),
  ]);

  const sm = summaryRes.rows[0];

  return {
    data: dataRes.rows.map(toAttendanceDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    summary: {
      totalStudents:    Number(sm?.total_students ?? 0),
      avgAttendancePct: sm?.avg_attendance_pct !== null ? Number(sm?.avg_attendance_pct ?? 0) : null,
      totalPresent:     Number(sm?.total_present ?? 0),
      totalAbsent:      Number(sm?.total_absent ?? 0),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FEES REPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fee invoice listing scoped to actor.schoolId.
 * Filters: due_date range, status.
 */
export async function getFeesReport(
  actor: AccessClaims,
  q: FeesQuery,
): Promise<{ data: ReturnType<typeof toFeesDto>[]; meta: object; summary: object }> {
  const where: string[] = ['fi.school_id = $1'];
  const params: unknown[] = [actor.schoolId];

  if (q.from) {
    params.push(q.from);
    where.push(`fi.due_date >= $${params.length}`);
  }
  if (q.to) {
    params.push(q.to);
    where.push(`fi.due_date <= $${params.length}`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`fi.status = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset   = (q.page - 1) * q.limit;

  const [dataRes, countRes, summaryRes] = await Promise.all([
    query<FeesRow>(
      `SELECT fi.id, fi.challan_no, fi.billing_month,
              fi.total, fi.paid,
              fi.total - fi.paid AS outstanding,
              fi.due_date, fi.status,
              s.full_name AS student_name, s.admission_no
         FROM fee_invoices fi
         JOIN students s ON s.id = fi.student_id
        WHERE ${whereSql}
        ORDER BY fi.due_date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: string }>(
      `SELECT count(*)::text AS total FROM fee_invoices fi WHERE ${whereSql}`,
      params,
    ),
    query<FeesSummaryRow>(
      `SELECT
         count(*)::text                                                  AS total_invoices,
         COALESCE(SUM(fi.total), 0)::text                               AS total_charged,
         COALESCE(SUM(fi.paid),  0)::text                               AS total_collected,
         COALESCE(SUM(fi.total - fi.paid), 0)::text                     AS total_outstanding,
         count(*) FILTER (WHERE fi.status IN ('unpaid','overdue'))::text AS defaulters_count
       FROM fee_invoices fi
      WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  const sm    = summaryRes.rows[0];

  return {
    data: dataRes.rows.map(toFeesDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    summary: {
      totalInvoices:   Number(sm?.total_invoices ?? 0),
      totalCharged:    Number(sm?.total_charged ?? 0),
      totalCollected:  Number(sm?.total_collected ?? 0),
      totalOutstanding: Number(sm?.total_outstanding ?? 0),
      defaultersCount: Number(sm?.defaulters_count ?? 0),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYROLL REPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Payslip listing for a given period scoped to actor.schoolId.
 * period defaults to the current month (YYYY-MM).
 */
export async function getPayrollReport(
  actor: AccessClaims,
  q: PayrollQuery,
): Promise<{ data: ReturnType<typeof toPayrollDto>[]; meta: object; summary: object }> {
  const period = q.period ?? currentPeriod();

  const where: string[] = ['p.school_id = $1', 'st.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  // period_month is a DATE column (first of month); match by truncating.
  params.push(`${period}-01`);
  where.push(`p.period_month = date_trunc('month', $${params.length}::date)`);

  if (q.staffType) {
    params.push(q.staffType);
    where.push(`st.staff_type = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset   = (q.page - 1) * q.limit;

  const [dataRes, countRes, summaryRes] = await Promise.all([
    query<PayrollRow>(
      `SELECT p.id, p.period_month, p.base_salary, p.allowances, p.deductions,
              p.net_salary, p.status,
              st.full_name AS staff_name, st.employee_id, st.staff_type, st.designation
         FROM payslips p
         JOIN staff st ON st.id = p.staff_id
        WHERE ${whereSql}
        ORDER BY st.full_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: string }>(
      `SELECT count(*)::text AS total
         FROM payslips p
         JOIN staff st ON st.id = p.staff_id
        WHERE ${whereSql}`,
      params,
    ),
    query<PayrollSummaryRow>(
      `SELECT
         count(*)::text                            AS total_staff,
         COALESCE(SUM(p.net_salary),   0)::text    AS total_net_salary,
         COALESCE(SUM(p.allowances),   0)::text    AS total_allowances,
         COALESCE(SUM(p.deductions),   0)::text    AS total_deductions
       FROM payslips p
       JOIN staff st ON st.id = p.staff_id
      WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  const sm    = summaryRes.rows[0];

  return {
    data: dataRes.rows.map(toPayrollDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    summary: {
      totalStaff:      Number(sm?.total_staff ?? 0),
      totalNetSalary:  Number(sm?.total_net_salary ?? 0),
      totalAllowances: Number(sm?.total_allowances ?? 0),
      totalDeductions: Number(sm?.total_deductions ?? 0),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNTING REPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Monthly income vs expense overview scoped to actor.schoolId.
 * No pagination — monthly rows are always manageable (<= 12 per year).
 * Defaults: from = start of current year, to = today.
 */
export async function getAccountingReport(
  actor: AccessClaims,
  q: AccountingQuery,
): Promise<{ data: ReturnType<typeof toAccountingDto>[]; summary: object }> {
  const fromDate = q.from ?? startOfYear();
  const toDate   = q.to   ?? today();

  const { rows } = await query<AccountingRow>(
    `WITH monthly_income AS (
       SELECT date_trunc('month', fp.paid_at)::DATE AS month,
              COALESCE(SUM(fp.amount), 0) AS fee_income
         FROM fee_payments fp
         JOIN fee_invoices fi ON fi.id = fp.invoice_id
        WHERE fi.school_id = $1
          AND fp.paid_at BETWEEN $2 AND $3
        GROUP BY 1
     ),
     monthly_expense AS (
       SELECT p.period_month AS month,
              COALESCE(SUM(p.net_salary), 0) AS payroll_expense
         FROM payslips p
        WHERE p.school_id = $1
          AND p.period_month BETWEEN date_trunc('month', $2::date)
                                 AND date_trunc('month', $3::date)
        GROUP BY 1
     )
     SELECT COALESCE(i.month, e.month)                          AS month,
            COALESCE(i.fee_income, 0)                           AS fee_income,
            COALESCE(e.payroll_expense, 0)                      AS payroll_expense,
            COALESCE(i.fee_income, 0) - COALESCE(e.payroll_expense, 0) AS net
       FROM monthly_income i
       FULL OUTER JOIN monthly_expense e USING (month)
      ORDER BY month`,
    [actor.schoolId, fromDate, toDate],
  );

  const data = rows.map(toAccountingDto);

  // Summary derived from returned monthly rows (no extra DB round-trip).
  const totalIncome  = data.reduce((s, r) => s + r.feeIncome, 0);
  const totalExpense = data.reduce((s, r) => s + r.payrollExpense, 0);

  return {
    data,
    summary: {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
    },
  };
}
