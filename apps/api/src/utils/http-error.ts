/** Typed application error mapped to a consistent JSON envelope (blueprint §8). */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest    = (m: string, d?: unknown) => new HttpError(400, 'BAD_REQUEST',     m, d);
export const unauthorized  = (m = 'Authentication required')  => new HttpError(401, 'UNAUTHORIZED', m);
export const forbidden     = (m = 'Permission denied')        => new HttpError(403, 'FORBIDDEN',    m);
export const notFound      = (m = 'Not found')                => new HttpError(404, 'NOT_FOUND',    m);
export const conflict      = (m: string, d?: unknown) => new HttpError(409, 'CONFLICT',      m, d);
export const unprocessable = (m: string, d?: unknown) => new HttpError(422, 'VALIDATION',    m, d);

/**
 * HTTP 429 Too Many Requests — account lockout یا rate limit کے لیے۔
 * مثال: 5 ناکام logins کے بعد account lock ہو جائے۔
 */
export const tooManyRequests = (m: string) => new HttpError(429, 'RATE_LIMITED', m);

