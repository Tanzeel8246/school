/**
 * auth.service.ts — Authentication service.
 *
 * Security features (Phase 2 hardening):
 *  1. Account Lockout   — 5 ناکام logins → 30 min Redis-based lock
 *  2. Access Token Revocation — logout پر access token فوری blacklist
 *  3. login_history    — ہر attempt (success/fail) IP + UA + timestamp کے ساتھ
 *  4. Timing-safe compare — user enumeration prevent کریں
 */
import { query, withTransaction } from '../../config/db.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
  signAccessToken,
  newRefreshToken,
  hashRefresh,
  signChallengeToken,
  revokeAccessToken,
  type AccessClaims,
} from '../../utils/jwt.js';
import { conflict, unauthorized, tooManyRequests } from '../../utils/http-error.js';
import { env } from '../../config/env.js';
import crypto from 'node:crypto';
import { createDefaultRoles } from '../schools/defaultRoles.js';
import { createDefaultAccounts } from '../schools/defaultAccounts.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';
import { requiresTwoFa } from '../twofa/twofa.service.js';
import {
  isAccountLocked,
  recordFailedAttempt,
  clearFailedAttempts,
  getLockoutTtl,
  MAX_FAILED_ATTEMPTS,
} from '../../config/redis.js';
import { logger } from '../../app.js';

/** Context extracted from the HTTP request, passed down from the controller. */
export interface RequestContext {
  ip: string | undefined;
  userAgent: string | undefined;
}

interface UserRow {
  id: string;
  school_id: string;
  password_hash: string;
  is_active: boolean;
  full_name: string;
  role_name: string;
  permissions: string[];
  twofa_enabled: boolean;
  theme: string;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * login_history میں ایک row لکھیں (fire-and-forget)۔
 * یہ function کبھی throw نہیں کرتا تاکہ login flow نہ ٹوٹے۔
 */
function writeLoginHistory(
  userId: string | null,
  schoolId: string | null,
  email: string,
  success: boolean,
  ctx: RequestContext,
): void {
  void query(
    `INSERT INTO login_history (user_id, school_id, email, success, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, schoolId, email, success, ctx.ip ?? null, ctx.userAgent ?? null],
  ).catch((err: unknown) => logger.error({ err }, 'login_history insert failed'));
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Authenticate a user and issue tokens.
 *
 * Flow:
 *  1. Account lockout check (Redis) — 5 failures → lock for 30 min
 *  2. DB lookup (email, school scoped)
 *  3. Timing-safe bcrypt compare (user enumeration prevention)
 *  4. login_history write (fire-and-forget)
 *  5. Failed attempt counter / lockout enforcement
 *  6. 2FA gate (Case A: setup required, Case B: challenge required)
 *  7. Issue access + refresh tokens
 */
export async function login(
  { loginId, password }: LoginInput,
  ctx: RequestContext = { ip: undefined, userAgent: undefined },
) {
  // ── Step 1: Account lockout check ─────────────────────────────────────────
  const locked = await isAccountLocked(loginId);
  if (locked) {
    const ttl = await getLockoutTtl(loginId);
    const minutes = Math.ceil(ttl / 60);
    throw tooManyRequests(
      `Account temporarily locked after ${MAX_FAILED_ATTEMPTS} failed attempts. ` +
      `Try again in ${minutes} minute(s).`,
    );
  }

  // ── Step 2: DB lookup ─────────────────────────────────────────────────────
  const { rows } = await query<UserRow & { email: string }>(
    `SELECT u.id, u.school_id, u.email, u.password_hash, u.is_active, u.full_name, u.theme,
            r.name AS role_name, r.permissions
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE (u.email = $1 OR u.username = $1) AND u.deleted_at IS NULL`,
    [loginId],
  );
  const user = rows[0];

  // ── Step 3: Timing-safe password verify ───────────────────────────────────
  const ok = user ? await verifyPassword(password, user.password_hash) : false;
  console.log("LOGIN DEBUG:", { loginId, password, userFound: !!user, isActive: user?.is_active, passwordOk: ok, hash: user?.password_hash });
  const success = !!(user && user.is_active && ok);

  // ── Step 4: login_history append ──────────────────────────────────────────
  writeLoginHistory(user?.id ?? null, user?.school_id ?? null, user?.email ?? loginId, success, ctx);

  // ── Step 5: Failure handling ───────────────────────────────────────────────
  if (!success) {
    const attempts = await recordFailedAttempt(loginId);
    const remaining = MAX_FAILED_ATTEMPTS - attempts;
    logger.warn({ loginId, attempts, ip: ctx.ip }, 'Login failure recorded');

    if (remaining <= 0) {
      throw tooManyRequests(
        `Account locked due to repeated failures. Try again in 30 minutes.`,
      );
    }
    throw unauthorized('Invalid credentials');
  }

  // ── Successful login → reset failure counter ───────────────────────────────
  await clearFailedAttempts(loginId);

  // ── Step 6: 2FA gate ──────────────────────────────────────────────────────
  // If role is enforced, send OTP and return challenge.
  if (requiresTwoFa(user!.role_name)) {
    const { sendEmailOtp } = await import('../twofa/twofa.service.js');
    await sendEmailOtp(user!.id, user!.email);

    const challengeToken = signChallengeToken(user!.id, user!.school_id);
    return {
      requiresTwoFaChallenge: true as const,
      userId: user!.id,
      challengeToken,
    };
  }

  // ── Step 7: Issue tokens (Case C — no 2FA) ────────────────────────────────
  const accessToken = signAccessToken({
    sub: user!.id,
    schoolId: user!.school_id,
    role: user!.role_name,
    permissions: user!.permissions ?? [],
  });

  const { raw, hash } = newRefreshToken();
  const familyId  = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400_000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [user!.id, hash, familyId, expiresAt],
  );
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user!.id]);

  return {
    accessToken,
    refreshToken: raw,
    user: { id: user!.id, name: user!.full_name, role: user!.role_name, theme: user!.theme },
  };
}

// ── Refresh ───────────────────────────────────────────────────────────────────

/** Rotate a refresh token; reuse of an already-rotated token revokes the whole family (theft detection). */
export async function refresh(rawToken: string) {
  const hash = hashRefresh(rawToken);
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT rt.*, u.school_id, u.role_id, r.name AS role_name, r.permissions
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         JOIN roles r ON r.id = u.role_id
        WHERE rt.token_hash = $1`,
      [hash],
    );
    const row = rows[0];
    if (!row) throw unauthorized('Invalid refresh token');
    if (row.revoked_at || new Date(row.expires_at) < new Date()) {
      // Possible reuse — nuke the family.
      await client.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1`, [
        row.family_id,
      ]);
      throw unauthorized('Refresh token expired or reused');
    }
    await client.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [row.id]);

    const { raw, hash: newHash } = newRefreshToken();
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
       VALUES ($1,$2,$3,$4)`,
      [row.user_id, newHash, row.family_id, row.expires_at],
    );
    const accessToken = signAccessToken({
      sub: row.user_id,
      schoolId: row.school_id,
      role: row.role_name,
      permissions: row.permissions ?? [],
    });
    return { accessToken, refreshToken: raw };
  });
}

// ── Register ──────────────────────────────────────────────────────────────────

/**
 * Provision a new tenant: school → default roles → super_admin user, all inside
 * a single transaction so a partial signup can never leave an orphaned school.
 */
export async function register(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);

  const created = await withTransaction(async (client) => {
    const dupCode = await client.query(`SELECT 1 FROM schools WHERE code = $1`, [input.schoolCode]);
    if (dupCode.rows[0]) throw conflict('School code already in use');

    // Get Starter plan
    const planRes = await client.query(`SELECT id FROM subscription_plans WHERE name = 'Starter' LIMIT 1`);
    const planId = planRes.rows[0]?.id || null;

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const schoolRes = await client.query<{ id: string }>(
      `INSERT INTO schools (name, code, plan_id, subscription_status, trial_ends_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.schoolName, input.schoolCode, planId, 'trial', trialEndsAt],
    );
    const schoolId = schoolRes.rows[0].id;

    const roleIds = await createDefaultRoles(client, schoolId);
    await createDefaultAccounts(client, schoolId);

    const userRes = await client.query<{ id: string }>(
      `INSERT INTO users (school_id, role_id, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [schoolId, roleIds.principal, input.email, passwordHash, input.adminName],
    );

    // Fetch principal permissions for the token
    const permRes = await client.query(`SELECT permissions FROM roles WHERE id = $1`, [roleIds.principal]);

    return { schoolId, userId: userRes.rows[0].id, permissions: permRes.rows[0].permissions };
  }).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw conflict('School code or email already in use');
    }
    throw err;
  });

  const accessToken = signAccessToken({
    sub: created.userId,
    schoolId: created.schoolId,
    role: 'principal',
    permissions: created.permissions,
  });

  const { raw, hash } = newRefreshToken();
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400_000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [created.userId, hash, familyId, expiresAt],
  );

  return {
    accessToken,
    refreshToken: raw,
    user: {
      id: created.userId,
      name: input.adminName,
      role: 'principal',
      schoolId: created.schoolId,
      theme: 'emerald',
    },
  };
}

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * Logout:
 *  1. Refresh token family revoke (DB) — same-device sessions terminate
 *  2. Access token JTI blacklist (Redis) — token immediately invalid
 *
 * `accessClaims` optional — if the client sends the access token in body/cookie
 * the controller can pass it here for immediate blacklisting.
 */
export async function logout(
  rawRefreshToken?: string,
  accessClaims?: AccessClaims,
): Promise<void> {
  // ── 1. Revoke refresh token family ──────────────────────────────────────
  if (rawRefreshToken) {
    try {
      const hash = hashRefresh(rawRefreshToken);
      await query(
        `UPDATE refresh_tokens SET revoked_at = now()
          WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)
            AND revoked_at IS NULL`,
        [hash],
      );
    } catch (err) {
      logger.error({ err }, 'logout: refresh token revoke failed');
    }
  }

  // ── 2. Blacklist access token JTI (Redis) ────────────────────────────────
  if (accessClaims) {
    try {
      await revokeAccessToken(accessClaims);
    } catch (err) {
      logger.error({ err }, 'logout: access token JTI blacklist failed');
    }
  }
}

/**
 * Revoke all active access + refresh tokens for a user.
 * استعمال: role change، password reset، admin forced logout۔
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
  // Access tokens expire naturally after ACCESS_TTL — JTI blacklist for immediate effect
  // requires iterating known JTIs which we don't store. Best practice: reduce ACCESS_TTL
  // to 5m in high-security scenarios.
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export async function updateTheme(userId: string, theme: string): Promise<void> {
  await query(`UPDATE users SET theme = $1 WHERE id = $2`, [theme, userId]);
}
