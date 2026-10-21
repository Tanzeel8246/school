/**
 * redis.ts — General-purpose Redis client for security operations.
 *
 * یہ client تین کاموں کے لیے ہے:
 *  1. JTI Blacklist  — logout / role-change پر access token revoke
 *  2. Account Lockout — ناکام login attempts کی گنتی
 *  3. JTI Replay Prevention — 2FA challenge tokens one-time use enforce
 *
 * کیوں الگ client؟
 *  BullMQ کے redisConnection میں maxRetriesPerRequest=null ہے جو BullMQ
 *  کے لیے ضروری ہے مگر regular commands کے لیے مناسب نہیں۔
 *  یہ client standard IORedis settings استعمال کرتا ہے۔
 *
 * Redis Commands استعمال:
 *  - SET key value EX ttl NX  → atomic set-if-not-exists (JTI replay prevention)
 *  - SET key value EX ttl     → blacklist / lockout entries
 *  - GET key                   → check existence
 *  - INCR key + EXPIRE         → counter for failed attempts
 *  - DEL key                   → lockout clear (manual admin action)
 */
import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from '../app.js';

// ── Client singleton ──────────────────────────────────────────────────────────

let _client: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!_client) {
    _client = new IORedis(env.REDIS_URL, {
      // Standard retry behaviour for regular commands
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      // Reconnect on connection errors
      retryStrategy: (times) => Math.min(times * 100, 3_000),
    });

    _client.on('error', (err: Error) => {
      logger.error({ err }, 'Redis client error');
    });
  }
  return _client;
}

export async function closeSecurityRedis(): Promise<void> {
  if (_client) {
    await _client.quit().catch(() => undefined);
    _client = null;
  }
}

// ── JTI Blacklist ─────────────────────────────────────────────────────────────
//
// Access token کا JTI (JWT ID) logout یا role-change پر یہاں ڈالا جاتا ہے۔
// authenticate middleware ہر request پر اس key کی موجودگی check کرتا ہے۔
// TTL = token کی باقی validity تاکہ Redis میں garbage جمع نہ ہو۔

const BLACKLIST_PREFIX = 'jti:blacklist:';

/**
 * Access token کو blacklist میں ڈالیں۔
 * @param jti   — JWT ID from claims
 * @param ttlSec — remaining token lifetime in seconds
 */
export async function blacklistJti(jti: string, ttlSec: number): Promise<void> {
  if (ttlSec <= 0) return;  // already expired — no-op
  const redis = getRedisClient();
  await redis.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttlSec);
}

/**
 * کیا یہ JTI blacklisted ہے؟
 * Returns true اگر logout / revoked ہو چکا ہو۔
 */
export async function isJtiBlacklisted(jti: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const val = await redis.get(`${BLACKLIST_PREFIX}${jti}`);
    return val !== null;
  } catch {
    // Redis unavailable — fail open (do not block legitimate requests)
    return false;
  }
}

// ── Challenge Token JTI Replay Prevention ────────────────────────────────────
//
// 2FA challenge tokens single-use ہونے چاہیے۔
// SETNX (Set if Not eXists) atomic operation سے race condition ناممکن ہے۔

const CHALLENGE_JTI_PREFIX = 'jti:challenge:';
const CHALLENGE_TTL_SEC    = 5 * 60;  // 5 minutes (challenge token lifetime)

/**
 * Challenge JTI کو atomic SETNX سے mark کریں۔
 * Returns true اگر successfully marked (پہلی بار)۔
 * Returns false اگر پہلے سے موجود ہو (replay attempt)۔
 */
export async function markChallengeJtiUsed(jti: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    // SET key value EX ttl NX — atomic: set only if key does not exist
    const result = await redis.set(
      `${CHALLENGE_JTI_PREFIX}${jti}`,
      '1',
      'EX', CHALLENGE_TTL_SEC,
      'NX',
    );
    return result === 'OK';  // 'OK' = set successfully (first use); null = already exists
  } catch {
    // Redis unavailable — allow the request (fail open for availability)
    return true;
  }
}

// ── Account Lockout ───────────────────────────────────────────────────────────
//
// مسلسل ناکام login attempts کے بعد account عارضی طور پر lock ہوتی ہے۔
// Key = email address، Value = failed attempt count۔
// TTL = lockout window (15 minutes)۔

const LOCKOUT_PREFIX      = 'lockout:';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SEC  = 15 * 60;  // 15 minutes
const LOCKOUT_DURATION_SEC = 30 * 60; // 30 minutes locked

/**
 * ناکام attempt record کریں۔
 * Returns current attempt count۔
 */
export async function recordFailedAttempt(email: string): Promise<number> {
  try {
    const redis  = getRedisClient();
    const key    = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;
    const count  = await redis.incr(key);
    // پہلی failure پر window شروع کریں
    if (count === 1) {
      await redis.expire(key, LOCKOUT_WINDOW_SEC);
    }
    return count;
  } catch {
    return 0;  // Redis unavailable — skip lockout
  }
}

/**
 * کیا account locked ہے؟
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key   = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;
    const count = await redis.get(key);
    return count !== null && parseInt(count, 10) >= MAX_FAILED_ATTEMPTS;
  } catch {
    return false;  // fail open
  }
}

/**
 * کامیاب login کے بعد failure counter صاف کریں۔
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(`${LOCKOUT_PREFIX}${email.toLowerCase()}`);
  } catch {
    // no-op
  }
}

/**
 * Account lockout TTL (seconds remaining) واپس کریں — UX کے لیے۔
 */
export async function getLockoutTtl(email: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const ttl   = await redis.ttl(`${LOCKOUT_PREFIX}${email.toLowerCase()}`);
    return ttl > 0 ? ttl : 0;
  } catch {
    return 0;
  }
}

// Re-export constants so auth.service can use them
export { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_SEC };
