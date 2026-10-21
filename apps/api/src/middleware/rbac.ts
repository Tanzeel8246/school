import type { Request, Response, NextFunction } from 'express';
import { forbidden, unauthorized } from '../utils/http-error.js';

/**
 * Coarse permission gate (blueprint §6). Permissions are `resource:action`
 * strings carried in the access token. Fine-grained data scopes
 * (own/child/self) are resolved later in the service layer.
 *
 *   router.post('/', requirePermission('students:write'), create)
 */
export function requirePermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    const granted = new Set(req.user.permissions);
    const ok = required.every((p) => granted.has(p) || granted.has('*'));
    if (!ok) return next(forbidden(`Missing permission: ${required.join(', ')}`));
    next();
  };
}

/** Guard that the row's tenant matches the caller's tenant. */
export function assertSameTenant(req: Request, rowSchoolId: string) {
  if (req.user?.schoolId !== rowSchoolId) throw forbidden('Cross-tenant access blocked');
}
