import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { blacklistJti } from '../config/redis.js';

export interface AccessClaims {
  sub: string;          // user id
  schoolId: string;     // tenant
  role: string;
  permissions: string[];
  jti: string;
  exp?: number;         // JWT expiry (unix seconds) — added by jsonwebtoken automatically
}

export function signAccessToken(claims: Omit<AccessClaims, 'jti'>): string {
  return jwt.sign({ ...claims, jti: crypto.randomUUID() }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TTL as any,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
}

/**
 * Remaining lifetime of an already-verified access token in seconds.
 * Used to set the correct TTL on the Redis blacklist entry.
 * Returns 0 if `exp` is missing or the token is already expired.
 */
export function calcRemainingTtlSec(claims: AccessClaims): number {
  if (!claims.exp) return 0;
  return Math.max(0, claims.exp - Math.floor(Date.now() / 1_000));
}

/**
 * Revoke an access token immediately by blacklisting its JTI in Redis.
 *
 * جب استعمال کریں:
 *  - logout پر (refresh token revoke + access token blacklist)
 *  - role / permission change پر (پرانا token فوری invalid)
 *  - admin account lock / suspension پر
 *
 * Redis TTL = token کی باقی validity — expired entries automatically clean up.
 */
export async function revokeAccessToken(claims: AccessClaims): Promise<void> {
  const ttl = calcRemainingTtlSec(claims);
  if (ttl > 0) {
    await blacklistJti(claims.jti, ttl);
  }
}

/** Opaque refresh token: random value stored hashed in DB, rotated on use (§3). */
export function newRefreshToken() {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export const hashRefresh = (raw: string) =>
  crypto.createHash('sha256').update(raw).digest('hex');

// ── 2FA challenge tokens ──────────────────────────────────────────────────

export interface ChallengeClaims {
  sub: string;      // userId
  schoolId: string;
  scope: 'twofa_challenge';
  jti: string;
}

export interface SetupClaims {
  sub: string;      // userId
  scope: 'twofa_setup';
  jti: string;
}

/**
 * Short-lived (5 min) token handed to the client after Phase 1 login when the
 * user has twofa_enabled=true.  The client sends it back in the Authorization
 * header of POST /2fa/verify.
 */
export function signChallengeToken(userId: string, schoolId: string): string {
  const payload: Omit<ChallengeClaims, 'jti'> & { jti?: string } = {
    sub: userId,
    schoolId,
    scope: 'twofa_challenge',
  };
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.JWT_ACCESS_SECRET, {
    expiresIn: '5m',
  });
}

/**
 * Short-lived (5 min) token handed to an enforced-role user who has NOT yet
 * set up 2FA.  Carry scope:'twofa_setup' so the frontend knows to redirect to
 * the setup wizard.
 */
export function signSetupToken(userId: string): string {
  return jwt.sign(
    { sub: userId, scope: 'twofa_setup', jti: crypto.randomUUID() },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

export function verifyChallengeToken(token: string): ChallengeClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as ChallengeClaims;
}
