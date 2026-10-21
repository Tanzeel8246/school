import type { Request, Response, NextFunction } from 'express';
import * as service from './auth.service.js';
import { env } from '../../config/env.js';
import { unauthorized } from '../../utils/http-error.js';
import { verifyAccessToken } from '../../utils/jwt.js';

const refreshCookie = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TTL_DAYS * 86_400_000,
};

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    // Pass request context so the service can write login_history (blueprint §3).
    const ctx = { ip: req.ip, userAgent: req.get('user-agent') };
    const result = await service.login(req.body, ctx);

    // 2FA Phase 1 responses — no tokens issued yet.
    if ('requiresTwoFaSetup' in result) {
      return res.json({ data: result });
    }
    if ('requiresTwoFaChallenge' in result) {
      return res.json({ data: result });
    }

    // Normal flow (no 2FA required).
    res.cookie('rt', result.refreshToken, refreshCookie);
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
  } catch (e) {
    next(e);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { accessToken, refreshToken, user } = await service.register(req.body);
    res.cookie('rt', refreshToken, refreshCookie);
    res.status(201).json({ data: { accessToken, user } });
  } catch (e) {
    next(e);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    // ── Extract access token claims for immediate JTI blacklisting ──────────
    // The client sends its current access token in the Authorization header
    // on logout so we can blacklist the JTI immediately.
    // اگر header نہ ہو تو صرف refresh token revoke ہوگا (graceful degradation)۔
    let accessClaims: ReturnType<typeof verifyAccessToken> | undefined;
    const authHeader = req.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        accessClaims = verifyAccessToken(authHeader.slice(7));
      } catch {
        // Expired / invalid access token — still logout successfully
      }
    }

    await service.logout(req.cookies?.rt, accessClaims);

    // Clear the refresh cookie.
    res.clearCookie('rt', { ...refreshCookie, maxAge: undefined });
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.rt;
    if (!token) throw unauthorized('No refresh token');
    const { accessToken, refreshToken } = await service.refresh(token);
    res.cookie('rt', refreshToken, refreshCookie);
    res.json({ data: { accessToken } });
  } catch (e) {
    next(e);
  }
}

export function me(req: Request, res: Response) {
  res.json({ data: req.user });
}

export async function updateTheme(req: Request, res: Response, next: NextFunction) {
  try {
    const { theme } = req.body;
    if (!theme || typeof theme !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid theme' } });
    }
    await service.updateTheme(req.user!.sub, theme);
    res.json({ data: { theme } });
  } catch (e) {
    next(e);
  }
}
