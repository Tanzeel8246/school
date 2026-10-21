import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type AccessClaims } from '../utils/jwt.js';
import { unauthorized } from '../utils/http-error.js';
import { isJtiBlacklisted } from '../config/redis.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessClaims;
    }
  }
}

/**
 * Validates the bearer access token and attaches the claims to req.user.
 *
 * Security layers (in order):
 *  1. Bearer header present اور valid format
 *  2. JWT signature + expiry verify (jsonwebtoken)
 *  3. Redis JTI blacklist check — logout / role-change پر revoked tokens block
 *
 * JTI blacklist کیوں ضروری ہے؟
 *  JWT tokens stateless ہوتے ہیں — بغیر blacklist کے logout کے بعد بھی
 *  چرایا ہوا token 15 منٹ تک valid رہتا ہے۔ Redis blacklist سے
 *  token immediately invalid ہو جاتا ہے۔
 *
 * Fail-open strategy for Redis:
 *  اگر Redis unavailable ہو تو token valid مانا جاتا ہے (availability > security)۔
 *  اس سے production میں Redis restart کے دوران سروس برقرار رہتی ہے۔
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return next(unauthorized());

  let claims: AccessClaims;
  try {
    claims = verifyAccessToken(header.slice(7));
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }

  // ── JTI Blacklist Check (Redis) ──────────────────────────────────────────
  // اگر یہ token logout یا role-change کے بعد revoke ہو چکا ہے تو reject کریں۔
  const revoked = await isJtiBlacklisted(claims.jti);
  if (revoked) {
    return next(unauthorized('Token has been revoked'));
  }

  req.user = claims;
  next();
}
