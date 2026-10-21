import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createSchoolSchema,
  listSchoolsQuerySchema,
  updateSchoolSchema,
} from './schools.schema.js';
import * as ctrl from './schools.controller.js';

export const schoolsRouter = Router();
schoolsRouter.use(authenticate);

// --- Self-service routes for the caller's own tenant ---
// NOTE: these literal paths MUST be declared before '/:id' so 'current' is not
// captured as an :id param.
schoolsRouter.get('/current', ctrl.getCurrent);
schoolsRouter.patch(
  '/current',
  requirePermission('settings:manage'),
  validate(updateSchoolSchema),
  ctrl.updateCurrent,
);

// --- Cross-tenant administration (super_admin / schools:* permissions) ---
schoolsRouter.get(
  '/',
  requirePermission('schools:read'),
  validate(listSchoolsQuerySchema, 'query'),
  ctrl.list,
);
schoolsRouter.post(
  '/',
  requirePermission('schools:write'),
  validate(createSchoolSchema),
  ctrl.create,
);
schoolsRouter.get('/:id', requirePermission('schools:read'), ctrl.getById);
schoolsRouter.patch(
  '/:id',
  requirePermission('schools:write'),
  validate(updateSchoolSchema),
  ctrl.update,
);
schoolsRouter.delete('/:id', requirePermission('schools:write'), ctrl.remove);

schoolsRouter.post('/:id/suspend', requirePermission('schools:write'), ctrl.suspend);
schoolsRouter.post('/:id/reactivate', requirePermission('schools:write'), ctrl.reactivate);
schoolsRouter.post('/:id/cancel', requirePermission('schools:write'), ctrl.cancel);
schoolsRouter.post('/:id/renew', requirePermission('schools:write'), ctrl.renew);
