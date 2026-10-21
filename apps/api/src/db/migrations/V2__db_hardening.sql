-- ============================================================================
-- EduCore ERP — Database Hardening Migration
-- File: V2__db_hardening.sql
--
-- یہ migration ایک idempotent script ہے (IF NOT EXISTS / IF EXISTS patterns)۔
-- پہلی بار چلانے پر سب کچھ apply ہو گا؛ دوبارہ چلانے پر کوئی error نہیں آئے گی۔
--
-- Tasks covered:
--   T1: Soft Delete — classes, sections, subjects, timetable_slots
--   T2: student_history event_type CHECK constraint
--   T3: Teacher double-booking prevention (UNIQUE index)
--   T5: accounts.balance reconciliation (trigger + verify function)
-- ============================================================================

BEGIN;

-- ============================================================================
-- T1: SOFT DELETE
-- ----------------------------------------------------------------------------
-- مسئلہ: classes, sections, subjects, timetable_slots میں deleted_at نہیں ہے۔
-- اثر: hard DELETE سے related records (students, attendance, results) orphan ہو جاتے ہیں
--      اور audit trail غائب ہو جاتی ہے۔
-- حل: deleted_at TIMESTAMPTZ column + partial indexes شامل کریں۔
-- ============================================================================

-- ── classes ──────────────────────────────────────────────────────────────────
-- کیا ضروری ہے: session → class → section → student chain میں class کا history محفوظ رہے۔

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index: deleted classes queries میں skip ہوں
CREATE INDEX IF NOT EXISTS idx_classes_session_active
  ON classes(session_id, level)
  WHERE deleted_at IS NULL;

-- school_id denormalization (audit report recommendation)
-- NOTE: classes کو school_id کی ضرورت ہے تاکہ direct tenant-scoped queries ممکن ہوں۔
-- یہ optional column ہے — service layer migration کے بعد populate کرے گی۔
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Backfill school_id from academic_sessions (existing data)
UPDATE classes cl
   SET school_id = s.school_id
  FROM academic_sessions s
 WHERE s.id = cl.session_id
   AND cl.school_id IS NULL;

-- Index for direct school-scoped lookups
CREATE INDEX IF NOT EXISTS idx_classes_school
  ON classes(school_id)
  WHERE deleted_at IS NULL AND school_id IS NOT NULL;

-- ── sections ─────────────────────────────────────────────────────────────────
-- کیا ضروری ہے: section کو soft-delete کریں تاکہ assigned students کے records محفوظ رہیں۔

ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sections_class_active
  ON sections(class_id)
  WHERE deleted_at IS NULL;

-- ── subjects ─────────────────────────────────────────────────────────────────
-- کیا ضروری ہے: subject delete ہو تو exam_results orphan نہ ہوں۔

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subjects_class_active
  ON subjects(class_id)
  WHERE deleted_at IS NULL;

-- ── timetable_slots ──────────────────────────────────────────────────────────
-- کیا ضروری ہے: historical timetable کے records audit کے لیے محفوظ رہیں۔

ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Drop the old UNIQUE constraint (won't work with soft delete — same slot can be "re-created")
-- اور اسے partial UNIQUE سے replace کریں
ALTER TABLE timetable_slots
  DROP CONSTRAINT IF EXISTS timetable_slots_section_id_weekday_period_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_timetable_active_slot
  ON timetable_slots(section_id, weekday, period)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_timetable_section_active
  ON timetable_slots(section_id)
  WHERE deleted_at IS NULL;


-- ============================================================================
-- T2: STUDENT HISTORY — event_type CONSTRAINT
-- ----------------------------------------------------------------------------
-- مسئلہ: student_history.event_type TEXT NOT NULL ہے مگر کوئی CHECK constraint نہیں۔
--         کوئی بھی string جا سکتی ہے — data inconsistency۔
-- حل: CHECK constraint لگائیں تاکہ صرف valid lifecycle events store ہوں۔
--
-- Valid events:
--   promote   — اگلی class میں promote
--   suspend   — تادیبی معطلی
--   transfer  — دوسرے school میں منتقلی
--   reinstate — suspension ختم، واپس active
--   enroll    — نئے داخلے کا ریکارڈ
--   leave     — voluntarily چلا گیا
--   re_enroll — واپس آیا
-- ============================================================================

-- پہلے existing invalid values ٹھیک کریں (اگر کوئی ہو)
UPDATE student_history
   SET event_type = 'enroll'
 WHERE event_type NOT IN ('promote','suspend','transfer','reinstate','enroll','leave','re_enroll');

-- پھر CHECK constraint add کریں
ALTER TABLE student_history
  DROP CONSTRAINT IF EXISTS chk_student_history_event_type;

ALTER TABLE student_history
  ADD CONSTRAINT chk_student_history_event_type
  CHECK (event_type IN ('promote','suspend','transfer','reinstate','enroll','leave','re_enroll'));

-- ============================================================================
-- T3: TEACHER DOUBLE-BOOKING PREVENTION
-- ----------------------------------------------------------------------------
-- مسئلہ: ایک teacher کو ایک ہی weekday اور period پر دو sections میں assign کیا
--         جا سکتا ہے — physically impossible!
-- حل: (teacher_id, weekday, period) پر UNIQUE index شامل کریں۔
--      Partial index (deleted_at IS NULL) تاکہ soft-deleted slots clash نہ کریں۔
-- ============================================================================

-- Existing duplicate slots (اگر کوئی ہوں تو) نکالیں
-- NOTE: یہ آپ کو manually دیکھنا ہوگا کہ کون سی duplicate ہے
-- Query to find conflicts (read-only diagnostic):
-- SELECT teacher_id, weekday, period, count(*) FROM timetable_slots
--   WHERE deleted_at IS NULL GROUP BY teacher_id, weekday, period HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_no_double_booking
  ON timetable_slots(teacher_id, weekday, period)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- T5: FINANCIAL RECONCILIATION — accounts.balance TRIGGER
-- ----------------------------------------------------------------------------
-- مسئلہ: accounts.balance manually updated ہوتا ہے۔
--         Journal line insert/update/delete کے بعد balance stale ہو سکتا ہے۔
-- حل: PostgreSQL trigger جو ہر journal_lines INSERT/UPDATE/DELETE پر balance update کرے۔
--
-- Double-entry مثال:
--   Debit Fees Receivable ₨ 1000 → balance += 1000
--   Credit Revenue Account  ₨ 1000 → balance -= 1000
--   (یہ asset account کے لیے ہے — credit reduces balance)
-- ============================================================================

-- ── Trigger function ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- نئی line: balance += debit - credit
    UPDATE accounts
       SET balance = balance + NEW.debit - NEW.credit
     WHERE id = NEW.account_id;
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- پرانی line undo کریں، نئی line apply کریں
    UPDATE accounts
       SET balance = balance
                    - OLD.debit + OLD.credit   -- undo old
                    + NEW.debit - NEW.credit   -- apply new
     WHERE id = NEW.account_id;
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    -- line ہٹائی: balance -= debit - credit (یعنی undo)
    UPDATE accounts
       SET balance = balance - OLD.debit + OLD.credit
     WHERE id = OLD.account_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_journal_line_balance ON journal_lines;

-- Create trigger
CREATE TRIGGER trg_journal_line_balance
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION fn_update_account_balance();

-- ── Balance Verify Function ───────────────────────────────────────────────────
-- یہ function کسی بھی وقت چلایا جا سکتا ہے تاکہ cached balance کو verify کیا جائے۔
-- اگر result empty آئے تو سب accounts balanced ہیں۔
-- اگر rows آئیں تو ان accounts کی balance fix کریں۔

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
  LEFT JOIN journal_entries je ON je.id = jl.journal_id
                               AND je.status = 'posted'
                               AND je.deleted_at IS NULL
  WHERE a.deleted_at IS NULL
    AND (p_school_id IS NULL OR a.school_id = p_school_id)
  GROUP BY a.id, a.code, a.name, a.balance
  HAVING a.balance != COALESCE(SUM(jl.debit - jl.credit), 0)::BIGINT
  ORDER BY ABS(a.balance - COALESCE(SUM(jl.debit - jl.credit), 0)::BIGINT) DESC;
END;
$$;

-- ── Balance Repair Function ───────────────────────────────────────────────────
-- اگر کوئی discrepancy ہو تو یہ function balance recalculate کر کے fix کرتا ہے۔
-- WARNING: صرف DBA run کرے — business logic bypass کرتا ہے۔

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
            WHERE jl.account_id = a.id
              AND je.status = 'posted'
              AND je.deleted_at IS NULL
         ), 0)
   WHERE a.deleted_at IS NULL
     AND (p_school_id IS NULL OR a.school_id = p_school_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;  -- number of accounts updated
END;
$$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 1. Verify balance consistency after migration:
--    SELECT * FROM fn_verify_account_balances();
--
-- 2. If discrepancies found, repair:
--    SELECT fn_repair_account_balances();
--
-- 3. Check teacher double-booking conflicts:
--    SELECT teacher_id, weekday, period, count(*)
--      FROM timetable_slots WHERE deleted_at IS NULL
--     GROUP BY teacher_id, weekday, period HAVING count(*) > 1;
--
-- 4. OTP cleanup: see jobs/cleanup.job.ts
-- ============================================================================
