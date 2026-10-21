/**
 * twofa.controller.ts — 2FA controller for Email OTP.
 */
import type { Request, Response, NextFunction } from 'express';
import * as service from './twofa.service.js';
import { query } from '../../config/db.js';
import {
  verifyChallengeToken,
  signAccessToken,
  newRefreshToken,
} from '../../utils/jwt.js';
import { unauthorized, badRequest } from '../../utils/http-error.js';
import { env } from '../../config/env.js';
import { markChallengeJtiUsed } from '../../config/redis.js';
import crypto from 'node:crypto';

const refreshCookie = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TTL_DAYS * 86_400_000,
};

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function sendEmailOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) throw unauthorized('Challenge token required');
    const rawToken = authHeader.slice(7);

    let claims;
    try {
      claims = verifyChallengeToken(rawToken);
    } catch {
      throw unauthorized('Invalid or expired challenge token');
    }
    if (claims.scope !== 'twofa_challenge') throw unauthorized('Invalid token scope');

    const userId = claims.sub;
    
    // Fetch email
    const { rows } = await query<{ email: string }>(
      `SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    const email = rows[0]?.email;
    if (!email) throw unauthorized('User not found');

    const result = await service.sendEmailOtp(userId, email);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /twofa/verify
 * Body: { code }
 * Authorization: Bearer <challengeToken>
 */
export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) throw unauthorized('Challenge token required');
    const rawToken = authHeader.slice(7);

    let claims;
    try {
      claims = verifyChallengeToken(rawToken);
    } catch {
      throw unauthorized('Invalid or expired challenge token');
    }
    if (claims.scope !== 'twofa_challenge') throw unauthorized('Invalid token scope');

    // ── Redis SETNX atomic replay prevention ─────────────────────────────────
    const accepted = await markChallengeJtiUsed(claims.jti);
    if (!accepted) {
      throw unauthorized('Challenge token already used');
    }

    const userId          = claims.sub;
    const { schoolId }   = claims;
    const { code } = req.body as { code?: string };
    
    if (!code) throw badRequest('code is required');

    const { valid } = await service.verifyEmailOtp(userId, code);
    if (!valid) throw unauthorized('Invalid verification code');

    // Fetch user info to issue full tokens.
    const { rows } = await query<{
      id: string;
      full_name: string;
      role_name: string;
      permissions: string[];
    }>(
      `SELECT u.id, u.full_name, r.name AS role_name, r.permissions
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 AND u.school_id = $2 AND u.deleted_at IS NULL`,
      [userId, schoolId],
    );
    const user = rows[0];
    if (!user) throw unauthorized('User not found');

    const accessToken = signAccessToken({
      sub: user.id,
      schoolId,
      role: user.role_name,
      permissions: user.permissions ?? [],
    });

    const { raw, hash } = newRefreshToken();
    const familyId  = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400_000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
       VALUES ($1,$2,$3,$4)`,
      [user.id, hash, familyId, expiresAt],
    );
    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

    res.cookie('rt', raw, refreshCookie);
    res.json({
      data: {
        accessToken,
        user: { id: user.id, name: user.full_name, role: user.role_name },
      },
    });
  } catch (e) {
    next(e);
  }
}
