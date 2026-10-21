/** Display formatters shared across feature modules. */

const CURRENCY = 'Rs. ';

/** Money fields are integer MINOR units; divide by 100 -> 'Rs. X,XXX.XX'. */
export function money(minor: number | null | undefined): string {
  const value = (minor ?? 0) / 100;
  return `${CURRENCY}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Convert a rupee amount typed by a user into integer minor units for the API. */
export function toMinor(major: number | string): number {
  const n = typeof major === 'string' ? parseFloat(major) : major;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Render an ISO/date string into a readable locale date (empty -> '—'). */
export function date(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Map a status string to a Badge variant. */
export function statusVariant(
  status: string,
): 'default' | 'success' | 'warning' | 'destructive' {
  const s = status.toLowerCase();
  if (/active|approved|present|paid|reinstated|final|posted/.test(s)) return 'success';
  if (/pending|leave|transfer|on_leave|processing|partial|draft/.test(s)) return 'warning';
  if (/suspend|inactive|reject|absent|left|terminated|delete|overdue|reversed/.test(s)) return 'destructive';
  if (/waived/.test(s)) return 'default';
  return 'default';
}

/** Turn a camelCase / snake_case key into Title Case words. */
export function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
