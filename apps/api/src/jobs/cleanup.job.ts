/**
 * cleanup.job.ts — Database cleanup cron jobs.
 *
 * یہ module server startup پر register ہوتا ہے اور background میں چلتا ہے۔
 *
 * Jobs:
 *  1. OTP Cleanup        — twofa_otp_store سے expired rows ہٹائیں (ہر گھنٹے)
 *  2. Login History Trim — login_history کو 90 دن سے پرانے records سے صاف کریں (روزانہ)
 *  3. Refresh Token GC   — expired refresh tokens clean کریں (روزانہ)
 *
 * کیوں ضروری ہے؟
 *  - twofa_otp_store: ہر SMS OTP کے بعد ایک row بنتی ہے جو 10 min میں expire ہو جاتی ہے۔
 *    مگر کوئی automatic cleanup نہیں — لاکھوں rows جمع ہو سکتی ہیں۔
 *  - login_history: append-only audit table — ہر login attempt (success/fail) ریکارڈ ہوتی ہے۔
 *    90 دن سے پرانا data compliance کے لیے ضروری نہیں مگر performance کو متاثر کرتا ہے۔
 *  - refresh_tokens: revoked / expired tokens صرف space waste کرتے ہیں۔
 *
 * Node-cron کی cron expression format: minutes hours day-of-month month day-of-week
 * مثال: '0 * * * *' = ہر گھنٹے کی صفر منٹ پر
 */
import cron from 'node-cron';
import { query } from '../config/db.js';
import { logger } from '../app.js';

// ── Config ────────────────────────────────────────────────────────────────────

/** login_history کتنے دن پرانے records رکھنی چاہیے */
const LOGIN_HISTORY_RETENTION_DAYS = 90;

/** refresh_tokens کتنے دن پرانے revoked/expired tokens رکھنی چاہیے */
const REFRESH_TOKEN_RETENTION_DAYS = 30;

// ── Job Functions ─────────────────────────────────────────────────────────────

/**
 * Job 1: OTP Store Cleanup
 * ------------------------------------------------------------------
 * twofa_otp_store سے وہ rows ہٹائیں جو:
 *  - expire ہو چکی ہوں (expires_at < now())، یا
 *  - already used ہو چکی ہوں (used_at IS NOT NULL) اور 1 گھنٹے سے پرانی ہوں
 *
 * کتنی بار: ہر گھنٹے (OTP lifetime صرف 10 min ہے)
 */
async function cleanupOtpStore(): Promise<void> {
  try {
    const { rowCount } = await query(
      `DELETE FROM twofa_otp_store
        WHERE expires_at < now()                              -- expired OTPs
           OR (used_at IS NOT NULL
               AND used_at < now() - interval '1 hour')`,    // used OTPs, 1h old
      [],
    );
    const deleted = rowCount ?? 0;
    if (deleted > 0) {
      logger.info({ deleted }, 'OTP store cleanup: expired/used rows removed');
    }
  } catch (err) {
    logger.error({ err }, 'OTP store cleanup failed');
  }
}

/**
 * Job 2: Login History Trim
 * ------------------------------------------------------------------
 * login_history سے وہ rows ہٹائیں جو LOGIN_HISTORY_RETENTION_DAYS سے پرانی ہوں۔
 *
 * کیوں: یہ BIGSERIAL table بہت تیزی سے بڑھتی ہے۔ 90 دن کا retention
 *       compliance (PCI DSS / local regulations) کے لیے کافی ہے۔
 *
 * کتنی بار: رات 2 بجے روزانہ (off-peak)
 */
async function trimLoginHistory(): Promise<void> {
  try {
    const { rowCount } = await query(
      `DELETE FROM login_history
        WHERE created_at < now() - ($1 || ' days')::interval`,
      [LOGIN_HISTORY_RETENTION_DAYS],
    );
    const deleted = rowCount ?? 0;
    logger.info({ deleted, retentionDays: LOGIN_HISTORY_RETENTION_DAYS },
      'Login history trimmed');
  } catch (err) {
    logger.error({ err }, 'Login history trim failed');
  }
}

/**
 * Job 3: Refresh Token Garbage Collection
 * ------------------------------------------------------------------
 * refresh_tokens سے وہ rows ہٹائیں جو:
 *  - revoked ہو چکی ہوں اور REFRESH_TOKEN_RETENTION_DAYS سے پرانی ہوں
 *  - expire ہو چکی ہوں اور REFRESH_TOKEN_RETENTION_DAYS سے پرانی ہوں
 *
 * کیوں: Revoked/expired tokens صرف storage waste کرتے ہیں۔ کچھ وقت رکھنا
 *        مفید ہے تاکہ token-theft investigation ممکن ہو۔
 *
 * کتنی بار: رات 3 بجے روزانہ
 */
async function gcRefreshTokens(): Promise<void> {
  try {
    const { rowCount } = await query(
      `DELETE FROM refresh_tokens
        WHERE (revoked_at IS NOT NULL AND revoked_at < now() - ($1 || ' days')::interval)
           OR (revoked_at IS NULL AND expires_at < now() - ($1 || ' days')::interval)`,
      [REFRESH_TOKEN_RETENTION_DAYS],
    );
    const deleted = rowCount ?? 0;
    logger.info({ deleted, retentionDays: REFRESH_TOKEN_RETENTION_DAYS },
      'Refresh tokens garbage collected');
  } catch (err) {
    logger.error({ err }, 'Refresh token GC failed');
  }
}

/**
 * Job 4: Overdue Invoice Status Update
 * ------------------------------------------------------------------
 * fee_invoices جن کی due_date گزر چکی ہو مگر status ابھی 'unpaid' ہو — انہیں 'overdue' کریں۔
 *
 * کیوں: Invoice status manually update نہیں ہوتی — یہ cron کام کرتی ہے۔
 *        Finance reports کو accurate status چاہیے۔
 *
 * کتنی بار: ہر رات 1 بجے
 */
async function markOverdueInvoices(): Promise<void> {
  try {
    const LATE_FEE = 50000; // 500 PKR in minor units
    const { rowCount } = await query(
      `UPDATE fee_invoices
          SET status = 'overdue',
              fine = fine + $1,
              total = total + $1
        WHERE status = 'unpaid'
          AND due_date < current_date
          AND deleted_at IS NULL`,
      [LATE_FEE],
    );
    const updated = rowCount ?? 0;
    if (updated > 0) {
      logger.info({ updated }, 'Fee invoices marked overdue and 500 PKR late fee added');
    }
  } catch (err) {
    logger.error({ err }, 'Overdue invoice update failed');
  }
}

/**
 * Job 5: Balance Integrity Check (Weekly)
 * ------------------------------------------------------------------
 * fn_verify_account_balances() چلا کر مسمار accounts detect کریں۔
 * صرف log کرتا ہے — automatic repair نہیں کرتا (DBA decision)۔
 *
 * کتنی بار: ہر اتوار رات 4 بجے
 */
async function verifyAccountBalances(): Promise<void> {
  try {
    const { rows } = await query<{
      account_id: string;
      account_code: string;
      account_name: string;
      cached_balance: string;
      computed_balance: string;
      difference: string;
    }>(
      `SELECT * FROM fn_verify_account_balances()`,
      [],
    );

    if (rows.length === 0) {
      logger.info('Account balance integrity check: ✅ all accounts balanced');
    } else {
      logger.warn(
        { mismatched: rows.length, accounts: rows.map((r) => ({
          code: r.account_code,
          name: r.account_name,
          diff: r.difference,
        }))},
        '⚠️ Account balance integrity check: discrepancies found! Run fn_repair_account_balances() to fix.',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Account balance integrity check failed');
  }
}

// ── Register Jobs ─────────────────────────────────────────────────────────────

/**
 * تمام cron jobs کو register کریں۔
 * server.ts میں startup پر ایک بار call کریں۔
 *
 * مثال:
 *   import { registerCleanupJobs } from './jobs/cleanup.job.js';
 *   registerCleanupJobs();
 */
export function registerCleanupJobs(): void {
  // Job 1: OTP cleanup — ہر گھنٹے (minute 5 of every hour)
  cron.schedule('5 * * * *', () => {
    void cleanupOtpStore();
  }, { name: 'otp-cleanup' });

  // Job 2: Login history trim — ہر رات 2 بجے
  cron.schedule('0 2 * * *', () => {
    void trimLoginHistory();
  }, { name: 'login-history-trim' });

  // Job 3: Refresh token GC — ہر رات 3 بجے
  cron.schedule('0 3 * * *', () => {
    void gcRefreshTokens();
  }, { name: 'refresh-token-gc' });

  // Job 4: Overdue invoices — ہر رات 1 بجے
  cron.schedule('0 1 * * *', () => {
    void markOverdueInvoices();
  }, { name: 'overdue-invoices' });

  // Job 5: Balance integrity — ہر اتوار رات 4 بجے
  cron.schedule('0 4 * * 0', () => {
    void verifyAccountBalances();
  }, { name: 'balance-integrity' });

  logger.info('✅ Cleanup cron jobs registered: otp-cleanup, login-history-trim, refresh-token-gc, overdue-invoices, balance-integrity');
}

/**
 * On-demand manual run of all cleanup jobs (useful for maintenance / testing).
 * یہ function admin endpoint یا deployment script سے call کیا جا سکتا ہے۔
 */
export async function runAllCleanupJobsNow(): Promise<void> {
  logger.info('Running all cleanup jobs manually…');
  await Promise.allSettled([
    cleanupOtpStore(),
    trimLoginHistory(),
    gcRefreshTokens(),
    markOverdueInvoices(),
    verifyAccountBalances(),
  ]);
  logger.info('Manual cleanup run complete');
}
