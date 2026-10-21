-- EduCore ERP — foundation schema (Auth/RBAC/Students/Fees slice).
-- Full schema for all modules is documented in school-erp-blueprint.html §5.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- SaaS & Tenancy ----------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  fee          BIGINT NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'lifetime')),
  max_students INT,
  max_teachers INT,
  features     TEXT[],
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_id        UUID NOT NULL REFERENCES subscription_plans(id),
  requested_by   UUID REFERENCES users(id),
  transaction_id TEXT,
  screenshot_url TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schools (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    UUID REFERENCES subscription_plans(id),
  name       TEXT NOT NULL,
  code       TEXT UNIQUE NOT NULL,
  address    TEXT,
  timezone   TEXT NOT NULL DEFAULT 'Asia/Karachi',
  logo_url   TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled')),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Soft-delete marker (blueprint §3 — tenants are never hard-deleted).
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES roles(id),
  email         CITEXT NOT NULL,
  username      CITEXT,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  theme         TEXT NOT NULL DEFAULT 'emerald',
  twofa_secret  TEXT,
  twofa_enabled BOOLEAN NOT NULL DEFAULT false,
  permission_overrides TEXT[] DEFAULT '{}',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (school_id, email),
  UNIQUE (school_id, username)
);
CREATE INDEX IF NOT EXISTS idx_users_school_role ON users(school_id, role_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  family_id  UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens(token_hash);

-- Append-only record of authentication attempts (blueprint §3 — auditability).
CREATE TABLE IF NOT EXISTS login_history (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID,
  school_id   UUID,
  email       TEXT,
  success     BOOLEAN,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at);

-- ---------- Academics ----------
CREATE TABLE IF NOT EXISTS academic_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  employee_id   TEXT NOT NULL,
  staff_type    TEXT NOT NULL,
  full_name     TEXT,
  email         CITEXT,
  phone         TEXT,
  gender        TEXT,
  address       TEXT,
  cnic          TEXT,
  qualification TEXT,
  experience_years INT,
  designation   TEXT,
  base_salary   BIGINT NOT NULL DEFAULT 0,
  joining_date  DATE,
  leaving_date  DATE,
  status        TEXT NOT NULL DEFAULT 'active',
  -- Soft-delete marker (blueprint §3 — staff are never hard-deleted).
  deleted_at    TIMESTAMPTZ,
  UNIQUE (school_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_school_type ON staff(school_id, staff_type) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS classes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID REFERENCES schools(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  level      INT NOT NULL,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_session_active ON classes(session_id, level) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES staff(id),
  name       TEXT NOT NULL,
  capacity   INT NOT NULL DEFAULT 40,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sections_class_active ON sections(class_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT,
  is_elective BOOLEAN DEFAULT false,
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_subjects_class_active ON subjects(class_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS timetable_slots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id),
  teacher_id UUID NOT NULL REFERENCES staff(id),
  weekday    SMALLINT NOT NULL,
  period     SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_timetable_active_slot ON timetable_slots(section_id, weekday, period) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_no_double_booking ON timetable_slots(teacher_id, weekday, period) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timetable_section_active ON timetable_slots(section_id) WHERE deleted_at IS NULL;

-- ---------- Students ----------
CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  section_id    UUID REFERENCES sections(id),
  admission_no  TEXT NOT NULL,
  roll_no       TEXT,
  full_name     TEXT NOT NULL,
  father_name   TEXT,
  mother_name   TEXT,
  cnic_bform    TEXT,
  dob           DATE,
  gender        TEXT CHECK (gender IN ('male','female','other')),
  blood_group   TEXT,
  religion      TEXT,
  address       TEXT,
  mobile        TEXT,
  emergency_contact TEXT,
  previous_school   TEXT,
  admission_date    DATE NOT NULL DEFAULT current_date,
  photo_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','suspended','transferred','left','alumni')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (school_id, admission_no)
);
CREATE INDEX IF NOT EXISTS idx_students_section ON students(section_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_name_trgm ON students USING gin (full_name gin_trgm_ops);

-- ---------- Guardians (parent portal) ----------
-- guardians: parent/guardian profiles; linked to a portal user account when they register.
CREATE TABLE IF NOT EXISTS guardians (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id),
  full_name TEXT NOT NULL,
  relation  TEXT,          -- father | mother | guardian
  cnic      TEXT,
  phone     TEXT,
  occupation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many: one guardian can have multiple children; one student can have multiple guardians.
CREATE TABLE IF NOT EXISTS guardian_students (
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (guardian_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_guardian_students_student ON guardian_students(student_id);

-- ---------- Attendance ----------
-- Daily per-student attendance marks, scoped by tenant (blueprint §5).
CREATE TABLE IF NOT EXISTS attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id  UUID REFERENCES sections(id),
  date        DATE NOT NULL DEFAULT current_date,
  status      TEXT NOT NULL DEFAULT 'present'
              CHECK (status IN ('present','absent','late','leave','half_day')),
  marked_by   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance(school_id, date);

-- ---------- Exams ----------
-- Multi-tenant exams table. class_id scopes the exam to a particular class.
-- total_marks / passing_marks are aggregate thresholds stored for fast reads.
-- Soft-deleted via deleted_at; exam_type constrained to known types.
CREATE TABLE IF NOT EXISTS exams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id   UUID REFERENCES academic_sessions(id),
  class_id     UUID REFERENCES classes(id),
  name         TEXT NOT NULL,
  exam_type    TEXT NOT NULL DEFAULT 'monthly'
               CHECK (exam_type IN ('monthly','midterm','final','quarterly','annual')),
  total_marks  NUMERIC(6,2) NOT NULL DEFAULT 100,
  passing_marks NUMERIC(6,2) NOT NULL DEFAULT 40,
  start_date   DATE,
  end_date     DATE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_exams_school ON exams(school_id) WHERE deleted_at IS NULL;

-- exam_subjects: links subjects to an exam with per-subject mark allocations.
-- Multi-tenant: school_id denormalised for tenant-scoped reads (blueprint §3).
-- UNIQUE(exam_id, subject_id) prevents duplicate subject entries per exam.
CREATE TABLE IF NOT EXISTS exam_subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id       UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  total_marks   NUMERIC(6,2) NOT NULL DEFAULT 100,
  passing_marks NUMERIC(6,2) NOT NULL DEFAULT 40,
  UNIQUE (exam_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON exam_subjects(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_school ON exam_subjects(school_id);

-- exam_results: one row per (exam, student, subject) — the atomic marks record.
-- marks_obtained / total_marks use NUMERIC(6,2) for precise fractional marks.
-- total_marks denormalised from exam_subjects for fast aggregate queries.
-- is_absent flag: when true, marks_obtained should be 0 and grade NULL.
-- grade is computed by the API via grade_config and stored after entry.
-- UNIQUE(exam_id, student_id, subject_id) makes upsert safe.
CREATE TABLE IF NOT EXISTS exam_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  marks_obtained  NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_marks     NUMERIC(6,2) NOT NULL DEFAULT 100,
  is_absent       BOOLEAN NOT NULL DEFAULT false,
  grade           TEXT,
  entered_by      UUID REFERENCES users(id),
  entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_student ON exam_results(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_school_exam ON exam_results(school_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id);

-- grade_config: school-specific letter-grade boundaries and GPA points.
-- If no config exists the API falls back to hard-coded defaults (grading §).
-- UNIQUE(school_id, grade_letter) allows per-tenant customisation.
CREATE TABLE IF NOT EXISTS grade_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_letter    TEXT NOT NULL,
  min_percentage  NUMERIC(5,2) NOT NULL,
  max_percentage  NUMERIC(5,2) NOT NULL,
  grade_point     NUMERIC(3,2) NOT NULL,
  display_order   INT NOT NULL DEFAULT 0,
  UNIQUE (school_id, grade_letter)
);
CREATE INDEX IF NOT EXISTS idx_grade_config_school ON grade_config(school_id);

-- ---------- Fees ----------
-- fee_heads: named fee line-items for a tenant. Amount is BIGINT minor units (paisa).
-- Soft-deleted via deleted_at (blueprint §3).
CREATE TABLE IF NOT EXISTS fee_heads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id),
  name          TEXT NOT NULL,
  is_recurring  BOOLEAN DEFAULT true,
  -- Extended columns (Phase 4)
  amount        BIGINT NOT NULL DEFAULT 0,
  applicable_to TEXT NOT NULL DEFAULT 'all',
  display_order INT  NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMPTZ
);

-- fee_invoices: one challan per student per billing month.
-- Soft-deleted via deleted_at; billing_month stored as first-of-month DATE.
CREATE TABLE IF NOT EXISTS fee_invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id),
  student_id    UUID NOT NULL REFERENCES students(id),
  challan_no    TEXT NOT NULL,
  billing_month DATE,
  subtotal      BIGINT NOT NULL DEFAULT 0,
  discount      BIGINT NOT NULL DEFAULT 0,
  fine          BIGINT NOT NULL DEFAULT 0,
  total         BIGINT NOT NULL,
  paid          BIGINT NOT NULL DEFAULT 0,
  due_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'unpaid'
                CHECK (status IN ('unpaid','partial','paid','overdue','waived')),
  -- Extended columns (Phase 4)
  created_by    UUID REFERENCES users(id),
  notes         TEXT,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, challan_no)
);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON fee_invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_student ON fee_invoices(school_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_month ON fee_invoices(school_id, billing_month) WHERE deleted_at IS NULL;

-- fee_invoice_lines: each line records which fee_head and amount was charged.
CREATE TABLE IF NOT EXISTS fee_invoice_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
  fee_head_id   UUID NOT NULL REFERENCES fee_heads(id),
  fee_head_name TEXT NOT NULL,
  amount        BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON fee_invoice_lines(invoice_id);

CREATE TABLE IF NOT EXISTS fee_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES fee_invoices(id),
  amount        BIGINT NOT NULL,
  method        TEXT NOT NULL,
  received_by   UUID REFERENCES users(id),
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Extended columns (Phase 4)
  reference_no  TEXT,
  notes         TEXT
);

-- fee_discounts: percentage or fixed discounts assigned to a student.
-- Applied to invoices in the given month; multi-tenant scoped.
CREATE TABLE IF NOT EXISTS fee_discounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id),
  name            TEXT NOT NULL,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  value           BIGINT NOT NULL,
  applied_month   DATE,
  reason          TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_fee_discounts_student ON fee_discounts(school_id, student_id);

-- ---------- HR: teacher↔subject assignment, attendance, leaves, payroll ----------

-- Many-to-many link between teaching staff and the subjects they teach.
-- school_id is denormalised so every read stays tenant-scoped (blueprint §3).
CREATE TABLE IF NOT EXISTS teacher_subjects (
  staff_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_school ON teacher_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject ON teacher_subjects(subject_id);

-- Daily per-staff attendance marks, upserted on (staff_id, date).
CREATE TABLE IF NOT EXISTS staff_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT current_date,
  status      TEXT NOT NULL DEFAULT 'present'
              CHECK (status IN ('present','absent','leave','late','half_day')),
  check_in    TIME,
  check_out   TIME,
  marked_by   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, date)
);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_school_date ON staff_attendance(school_id, date);

-- Staff leave requests with a pending → approved/rejected lifecycle.
-- Soft-deleted via deleted_at (blueprint §3).
CREATE TABLE IF NOT EXISTS staff_leaves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type  TEXT NOT NULL,
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  days        INT,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_school_status ON staff_leaves(school_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_leaves_staff ON staff_leaves(staff_id) WHERE deleted_at IS NULL;

-- Monthly payslips. Money is BIGINT minor units (paisa).
-- One draft per (staff_id, period_month) — UNIQUE makes payroll runs idempotent.
-- Extended in Phase 4 with bonus, notes, finalized_at.
CREATE TABLE IF NOT EXISTS payslips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id      UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period_month  DATE NOT NULL,
  base_salary   BIGINT NOT NULL DEFAULT 0,
  allowances    BIGINT NOT NULL DEFAULT 0,
  deductions    BIGINT NOT NULL DEFAULT 0,
  net_salary    BIGINT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Extended columns (Phase 4)
  bonus         BIGINT NOT NULL DEFAULT 0,
  notes         TEXT,
  finalized_at  TIMESTAMPTZ,
  UNIQUE (staff_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_payslips_school_period ON payslips(school_id, period_month);

-- ---------- Payroll: salary structures & components ----------
-- salary_structures: one active structure per staff member (partial UNIQUE via WHERE).
-- Soft-deleted; replaced via upsert pattern in service layer.
CREATE TABLE IF NOT EXISTS salary_structures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id       UUID NOT NULL REFERENCES staff(id),
  name           TEXT NOT NULL,
  effective_from DATE NOT NULL DEFAULT current_date,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_structures_school_staff ON salary_structures(school_id, staff_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_salary_structures_school ON salary_structures(school_id) WHERE deleted_at IS NULL;

-- salary_components: allowances and deductions within a structure.
-- Amount is BIGINT minor units; is_percentage means value is basis-points / 100.
CREATE TABLE IF NOT EXISTS salary_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id    UUID NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  component_type  TEXT NOT NULL CHECK (component_type IN ('allowance','deduction')),
  amount          BIGINT NOT NULL DEFAULT 0,
  is_percentage   BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_salary_components_structure ON salary_components(structure_id) WHERE deleted_at IS NULL;

-- ---------- Accounting: Chart of Accounts ----------
-- Double-entry: every journal must balance (SUM debit = SUM credit).
-- balance is a cached running total; source-of-truth is journal_lines (blueprint §5).
CREATE TABLE IF NOT EXISTS accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_id   UUID REFERENCES accounts(id),
  balance     BIGINT NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_accounts_school_type ON accounts(school_id, type) WHERE deleted_at IS NULL;

-- journal_entries: header for each double-entry transaction.
-- status: 'posted' | 'reversed'. Reversals create a new opposite entry (blueprint §5).
CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  ref_no      TEXT NOT NULL,
  description TEXT,
  entry_date  DATE NOT NULL DEFAULT current_date,
  status      TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (school_id, ref_no)
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_school_date ON journal_entries(school_id, entry_date) WHERE deleted_at IS NULL;

-- journal_lines: individual debit/credit lines.
-- CHECK ensures each line moves money in only one direction.
CREATE TABLE IF NOT EXISTS journal_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id  UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id),
  debit       BIGINT NOT NULL DEFAULT 0,
  credit      BIGINT NOT NULL DEFAULT 0,
  description TEXT,
  CHECK (debit >= 0 AND credit >= 0 AND (debit > 0 OR credit > 0))
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal ON journal_lines(journal_id);

-- ---------- Student lifecycle history ----------
-- Append-only trail of lifecycle events (promote/transfer/suspend/reinstate).
CREATE TABLE IF NOT EXISTS student_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('promote','suspend','transfer','reinstate','enroll','leave','re_enroll')),
  from_value  TEXT,
  to_value    TEXT,
  note        TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_history_student ON student_history(student_id);

-- ---------- Audit ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  school_id   UUID,
  actor_id    UUID,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  before      JSONB,
  after       JSONB,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ══════════════════════════════════════════════════════════════════════════
-- Phase 6: Library, Transport, Hostel, Inventory
-- ══════════════════════════════════════════════════════════════════════════

-- ---------- Library ----------

CREATE TABLE IF NOT EXISTS book_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category_id UUID REFERENCES book_categories(id),
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  publisher TEXT,
  edition TEXT,
  total_copies INT NOT NULL DEFAULT 1,
  available_copies INT NOT NULL DEFAULT 1,
  fine_per_day BIGINT NOT NULL DEFAULT 500,  -- minor units (default PKR 5/day)
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_books_school ON books(school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn) WHERE isbn IS NOT NULL;

CREATE TABLE IF NOT EXISTS book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  barcode TEXT UNIQUE,
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good','fair','poor','damaged')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','issued','lost','damaged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_book_copies_book ON book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_barcode ON book_copies(barcode) WHERE barcode IS NOT NULL;

CREATE TABLE IF NOT EXISTS book_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  book_copy_id UUID NOT NULL REFERENCES book_copies(id),
  book_id UUID NOT NULL REFERENCES books(id),
  borrower_id UUID NOT NULL REFERENCES users(id),
  borrower_type TEXT NOT NULL DEFAULT 'student' CHECK (borrower_type IN ('student','staff')),
  issued_by UUID REFERENCES users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date DATE NOT NULL,
  returned_at TIMESTAMPTZ,
  fine_amount BIGINT NOT NULL DEFAULT 0,
  fine_paid BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','returned','overdue','lost')),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_book_issues_school ON book_issues(school_id, status);
CREATE INDEX IF NOT EXISTS idx_book_issues_borrower ON book_issues(borrower_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_copy ON book_issues(book_copy_id);

-- ---------- Transport ----------

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  reg_no TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'bus' CHECK (vehicle_type IN ('bus','van','car','minibus')),
  make TEXT,
  model TEXT,
  capacity INT NOT NULL DEFAULT 40,
  driver_id UUID REFERENCES staff(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(school_id, reg_no)
);
CREATE INDEX IF NOT EXISTS idx_vehicles_school ON vehicles(school_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  vehicle_id UUID REFERENCES vehicles(id),
  monthly_fee BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stop_order INT NOT NULL DEFAULT 1,
  pickup_time TIME,
  drop_time TIME
);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);

CREATE TABLE IF NOT EXISTS student_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id),
  stop_id UUID REFERENCES route_stops(id),
  valid_from DATE NOT NULL DEFAULT current_date,
  valid_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_student_transport_student ON student_transport(student_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_route ON student_transport(route_id);

-- ---------- Hostel ----------

CREATE TABLE IF NOT EXISTS hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hostel_type TEXT NOT NULL DEFAULT 'boys' CHECK (hostel_type IN ('boys','girls','mixed')),
  address TEXT,
  warden_id UUID REFERENCES staff(id),
  total_capacity INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hostels_school ON hostels(school_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hostel_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_no TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'double' CHECK (room_type IN ('single','double','triple','dormitory')),
  floor INT NOT NULL DEFAULT 0,
  capacity INT NOT NULL DEFAULT 2,
  occupied INT NOT NULL DEFAULT 0,
  monthly_fee BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(hostel_id, room_no)
);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_hostel ON hostel_rooms(hostel_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hostel_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  hostel_id UUID NOT NULL REFERENCES hostels(id),
  room_id UUID NOT NULL REFERENCES hostel_rooms(id),
  bed_no TEXT,
  allocated_from DATE NOT NULL DEFAULT current_date,
  allocated_to DATE,
  monthly_fee BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','vacated','expired')),
  notes TEXT,
  allocated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hostel_alloc_student ON hostel_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_alloc_room ON hostel_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_hostel_alloc_school ON hostel_allocations(school_id, status);

CREATE TABLE IF NOT EXISTS mess_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),  -- 1=Monday..7=Sunday
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  menu_items TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hostel_id, day_of_week, meal_type)
);

-- ---------- Inventory ----------

CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vendors_school ON vendors(school_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category_id UUID REFERENCES inventory_categories(id),
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs' CHECK (unit IN ('pcs','kg','ltr','box','ream','set','pair')),
  quantity_in_stock INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 10,
  unit_cost BIGINT NOT NULL DEFAULT 0,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_inventory_items_school ON inventory_items(school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory_items(school_id, quantity_in_stock, reorder_level) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  po_no TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT current_date,
  expected_delivery DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','received','cancelled')),
  notes TEXT,
  total_amount BIGINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(school_id, po_no)
);
CREATE INDEX IF NOT EXISTS idx_po_school ON purchase_orders(school_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS po_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_cost BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  txn_type TEXT NOT NULL CHECK (txn_type IN ('in','out','adjustment')),
  quantity INT NOT NULL,
  reference_type TEXT,   -- 'purchase_order','direct','usage','loss','return'
  reference_id UUID,
  notes TEXT,
  performed_by UUID REFERENCES users(id),
  txn_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_txn_item ON stock_transactions(item_id, txn_at);
CREATE INDEX IF NOT EXISTS idx_stock_txn_school ON stock_transactions(school_id, txn_type);

-- ══════════════════════════════════════════════════════════════════════════
-- Phase 7: Communication — SMS, WhatsApp, Email
-- ══════════════════════════════════════════════════════════════════════════

-- ---------- Communication ----------

-- Per-school on/off switches for each notification event × channel.
-- Missing rows default to disabled; upserted on PUT /communications/settings.
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,   -- attendance_absent|fee_due|result_published|announcement|custom
  channel TEXT NOT NULL,      -- sms|whatsapp|email
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, event_type, channel)
);

-- Reusable message templates per event type per school.
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,   -- same enum as notification_settings
  channel TEXT NOT NULL,      -- sms|whatsapp|email
  subject TEXT,               -- email only
  body TEXT NOT NULL,         -- supports {{variables}} placeholders
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_msg_templates_school ON message_templates(school_id, event_type, channel) WHERE deleted_at IS NULL;

-- Announcements: broadcast to a target group (students/parents/staff/class/section).
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}',   -- ['sms','whatsapp','email']
  target_type TEXT NOT NULL DEFAULT 'all_users',  -- all_students|all_parents|all_staff|class|section|all_users
  target_id UUID,                           -- classId or sectionId when target_type='class'|'section'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_announcements_school ON announcements(school_id, status) WHERE deleted_at IS NULL;

-- Immutable append-only log of every outbound message attempt.
-- Never hard-deleted (audit trail — blueprint §3).
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES announcements(id),
  channel TEXT NOT NULL,          -- sms|whatsapp|email
  event_type TEXT NOT NULL,
  recipient_id UUID,              -- users.id or null for external
  recipient_phone TEXT,
  recipient_email TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','bounced')),
  provider_message_id TEXT,       -- Twilio SID or SMTP message ID
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_logs_school ON message_logs(school_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_logs_recipient ON message_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_msg_logs_announcement ON message_logs(announcement_id);

-- ══════════════════════════════════════════════════════════════════════════
-- 2FA: recovery codes + OTP store
-- ══════════════════════════════════════════════════════════════════════════

-- 2FA recovery codes (hashed, one-time use). Each user gets 10 on setup.
CREATE TABLE IF NOT EXISTS twofa_recovery_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,          -- bcrypt hash of the plain code
  used_at     TIMESTAMPTZ,            -- set when consumed; NULL = unused
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_twofa_recovery_user ON twofa_recovery_codes(user_id) WHERE used_at IS NULL;

-- OTP store for SMS/email fallback codes (short-lived, 10 min TTL).
CREATE TABLE IF NOT EXISTS twofa_otp_store (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════
-- Financial Triggers
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE accounts SET balance = balance + NEW.debit - NEW.credit WHERE id = NEW.account_id;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE accounts SET balance = balance - OLD.debit + OLD.credit + NEW.debit - NEW.credit WHERE id = NEW.account_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE accounts SET balance = balance - OLD.debit + OLD.credit WHERE id = OLD.account_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_line_balance ON journal_lines;
CREATE TRIGGER trg_journal_line_balance
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION fn_update_account_balance();

CREATE OR REPLACE FUNCTION fn_verify_account_balances(p_school_id UUID DEFAULT NULL)
RETURNS TABLE (
  account_id   UUID,
  account_code TEXT,
  account_name TEXT,
  cached_balance    BIGINT,
  computed_balance  BIGINT,
  difference        BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id                                          AS account_id,
    a.code                                        AS account_code,
    a.name                                        AS account_name,
    a.balance                                     AS cached_balance,
    COALESCE(SUM(jl.debit - jl.credit), 0)::BIGINT AS computed_balance,
    a.balance - COALESCE(SUM(jl.debit - jl.credit), 0)::BIGINT AS difference
  FROM accounts a
  LEFT JOIN journal_lines jl ON jl.account_id = a.id
  LEFT JOIN journal_entries je ON je.id = jl.journal_id AND je.status = 'posted' AND je.deleted_at IS NULL
  WHERE a.deleted_at IS NULL AND (p_school_id IS NULL OR a.school_id = p_school_id)
  GROUP BY a.id, a.code, a.name, a.balance
  HAVING a.balance != COALESCE(SUM(jl.debit - jl.credit), 0)::BIGINT
  ORDER BY ABS(a.balance - COALESCE(SUM(jl.debit - jl.credit), 0)::BIGINT) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION fn_repair_account_balances(p_school_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE accounts a
     SET balance = COALESCE((
           SELECT SUM(jl.debit - jl.credit)
             FROM journal_lines jl
             JOIN journal_entries je ON je.id = jl.journal_id
            WHERE jl.account_id = a.id AND je.status = 'posted' AND je.deleted_at IS NULL
         ), 0)
   WHERE a.deleted_at IS NULL AND (p_school_id IS NULL OR a.school_id = p_school_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
