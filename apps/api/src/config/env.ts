import { z } from 'zod';

/**
 * Single, validated source of truth for configuration.
 * Fail fast at boot if anything required is missing.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // ── TOTP Secret Encryption ────────────────────────────────────────────────
  // AES-256-GCM key — must be exactly 64 hex chars (32 bytes).
  // Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  // Required in production; optional in development/test (app warns but continues).
  TOTP_ENCRYPTION_KEY: z.string().optional(),

  // Twilio (SMS + WhatsApp) — all optional; providers degrade gracefully when unconfigured.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),     // e.g. +15005550006
  TWILIO_WHATSAPP_FROM: z.string().optional(),   // e.g. whatsapp:+14155238886

  // Redis — required for BullMQ job queues. Falls back to localhost for local dev.
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // SMTP Email (Nodemailer) — optional; system boots without these.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional().default('noreply@educore.app'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// ── Production safety guards ──────────────────────────────────────────────────
// Refuse to start in production if secrets are still placeholder values.
const PLACEHOLDER_PATTERN = /^REPLACE_ME/;
if (env.NODE_ENV === 'production') {
  const fatal: string[] = [];

  if (PLACEHOLDER_PATTERN.test(env.JWT_ACCESS_SECRET) || PLACEHOLDER_PATTERN.test(env.JWT_REFRESH_SECRET)) {
    fatal.push('JWT secrets are still set to placeholder values.');
  }

  // TOTP encryption key is mandatory in production (blueprint §3 — credentials hygiene).
  if (!env.TOTP_ENCRYPTION_KEY || env.TOTP_ENCRYPTION_KEY.length !== 64) {
    fatal.push(
      'TOTP_ENCRYPTION_KEY must be exactly 64 hex characters.\n' +
      '  Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  if (fatal.length > 0) {
    console.error('❌ FATAL configuration errors:\n' + fatal.map((m) => `  • ${m}`).join('\n'));
    console.error('  Run: bash infra/scripts/generate-secrets.sh >> .env\n  then restart.');
    process.exit(1);
  }
}

// Development / test warning — remind developers to set the key.
if (env.NODE_ENV !== 'production' && !env.TOTP_ENCRYPTION_KEY) {
  console.warn(
    '⚠️  TOTP_ENCRYPTION_KEY is not set. ' +
    'TOTP secrets will be stored as plaintext in dev/test. ' +
    'Set this before going to production.',
  );
}

