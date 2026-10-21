/**
 * auth.routes.ts — Authentication router.
 *
 * Rate Limiting Strategy (Security Phase 2):
 *
 *  loginLimiter (IP-based, express-rate-limit):
 *    10 req / 15 min per IP — covers credential stuffing from one source.
 *
 *  loginByEmailLimiter (email-based, express-rate-limit):
 *    5 req / 15 min per email — اگر attacker IPs rotate کرے تو بھی block ہو۔
 *    NOTE: یہ per-email limiter صرف HTTP layer پر ہے۔ Redis-based
 *    account lockout (auth.service.ts) بھی independently چلتا ہے۔
 *
 *  refreshLimiter (IP-based):
 *    30 rotations / 5 min — refresh endpoint hammering prevent کریں۔
 *
 * Single-process MemoryStore: single-VPS deployment کے لیے کافی ہے۔
 * Horizontal scaling کے لیے rate-limit-redis package سے RedisStore لگائیں۔
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import * as ctrl from './auth.controller.js';
import { twofaRouter } from '../twofa/twofa.routes.js';

// ── IP-based login limiter (covers bots / credential stuffing) ────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,   // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts from this IP — try again later.' } },
});

// ── Email-based login limiter (covers distributed IP attacks) ─────────────────
// keyGenerator: IP + lowercased email composite — granular per-account protection۔
const loginByEmailLimiter = rateLimit({
  windowMs: 15 * 60_000,   // 15 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keyGenerator: (req: any) => {
    const loginId = (req.body?.loginId ?? '').toString().toLowerCase();
    return `${req.ip}::${loginId}`;
  },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts for this account — try again in 15 minutes.' } },
  // Skip successful requests so valid multi-tab sessions don't count.
  skipSuccessfulRequests: true,
});

// ── Refresh token rotation limiter ────────────────────────────────────────────
const refreshLimiter = rateLimit({
  windowMs: 5 * 60_000,    // 5 minutes
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many refresh requests — slow down.' } },
  skipSuccessfulRequests: true,
});

export const authRouter = Router();

// Register
authRouter.post('/register', loginLimiter, validate(registerSchema), ctrl.register);

// Login — both IP limiter AND email limiter applied (defense in depth)
authRouter.post('/login', loginLimiter, loginByEmailLimiter, validate(loginSchema), ctrl.login);

// Logout — requires authenticate so we can extract the access token claims
// for JTI blacklisting. Errors are silenced (logout should always succeed).
authRouter.post('/logout', ctrl.logout);

// Token rotation
authRouter.post('/refresh', refreshLimiter, ctrl.refresh);

// Current user info
authRouter.get('/me', authenticate, ctrl.me);

// Update user theme
authRouter.patch('/theme', authenticate, ctrl.updateTheme);

// 2FA sub-router: /api/v1/auth/2fa/*
authRouter.use('/2fa', twofaRouter);
