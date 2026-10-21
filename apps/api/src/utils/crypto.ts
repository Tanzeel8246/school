/**
 * crypto.ts — AES-256-GCM symmetric encryption helpers.
 *
 * استعمال: TOTP secrets کو database میں plaintext کی بجائے encrypted رکھنا۔
 *
 * AES-256-GCM کیوں؟
 *  - Authenticated encryption: confidentiality + integrity دونوں۔
 *  - 256-bit key: NIST-approved، quantum-resistant level 1۔
 *  - Random 12-byte IV: ہر encrypt call پر نیا — same plaintext، مختلف ciphertext۔
 *  - 16-byte auth tag: tamper detection یقینی کرتا ہے۔
 *
 * Wire format (colon-separated hex):
 *   <iv_hex>:<ciphertext_hex>:<tag_hex>
 *
 * IMPORTANT: TOTP_ENCRYPTION_KEY env var 64 hex chars (32 bytes) ہونی چاہیے۔
 *   Generate:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12;   // GCM recommended IV length
const TAG_BYTES  = 16;   // Full 128-bit auth tag

/** Lazily-resolved 32-byte key buffer derived from TOTP_ENCRYPTION_KEY env var. */
function getKey(): Buffer {
  const hex = process.env['TOTP_ENCRYPTION_KEY'];
  if (!hex || hex.length !== 64) {
    throw new Error(
      '❌ TOTP_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).\n' +
      '   Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt plaintext string with AES-256-GCM.
 *
 * مثال:
 *   const cipher = encryptSecret('JBSWY3DPEHPK3PXP');
 *   // cipher = "a1b2c3...:d4e5f6...:789abc..."
 */
export function encryptSecret(plaintext: string): string {
  const key    = getKey();
  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypt a ciphertext produced by `encryptSecret`.
 * Throws if the auth tag verification fails (tampered data).
 *
 * مثال:
 *   const plain = decryptSecret(cipher); // 'JBSWY3DPEHPK3PXP'
 */
export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format — expected iv:enc:tag');
  }
  const [ivHex, encHex, tagHex] = parts as [string, string, string];

  const key      = getKey();
  const iv       = Buffer.from(ivHex, 'hex');
  const enc      = Buffer.from(encHex, 'hex');
  const tag      = Buffer.from(tagHex, 'hex');

  if (tag.length !== TAG_BYTES) {
    throw new Error('Invalid auth tag length');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/**
 * کیا یہ string encrypted format میں ہے؟
 * Legacy plaintext secrets (migration کے دوران) detect کرنے کے لیے۔
 */
export function isEncrypted(value: string): boolean {
  // Encrypted format: exactly 3 colon-separated hex strings
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  return parts.every((p) => /^[0-9a-f]+$/i.test(p));
}
