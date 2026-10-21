import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listQuerySchema,
  createStudentSchema,
  updateStudentSchema,
  promoteStudentSchema,
  reasonSchema,
  resetPasswordSchema,
} from './students.schema.js';
import * as ctrl from './students.controller.js';
import { enforceUsageLimit } from '../../middleware/saas.js';

export const studentsRouter = Router();
studentsRouter.use(authenticate);

// Collection routes.
studentsRouter.get('/', requirePermission('students:read'), validate(listQuerySchema, 'query'), ctrl.list);
studentsRouter.post(
  '/',
  requirePermission('students:write'),
  enforceUsageLimit('students'),
  validate(createStudentSchema),
  ctrl.create,
);

studentsRouter.get('/guardians', requirePermission('students:read'), ctrl.listGuardians);
studentsRouter.post('/guardians/:id/password', requirePermission('students:write'), validate(resetPasswordSchema), ctrl.resetGuardianPassword);

// Item + lifecycle routes. Literal sub-paths are declared via specific verbs;
// '/:id' itself only handles GET/PATCH/DELETE so no literal collides with it.
studentsRouter.get('/:id', requirePermission('students:read'), ctrl.getById);
studentsRouter.patch('/:id', requirePermission('students:write'), validate(updateStudentSchema), ctrl.update);
studentsRouter.delete('/:id', requirePermission('students:write'), ctrl.remove);

studentsRouter.post(
  '/:id/promote',
  requirePermission('students:write'),
  validate(promoteStudentSchema),
  ctrl.promote,
);
studentsRouter.post('/:id/transfer', requirePermission('students:write'), validate(reasonSchema), ctrl.transfer);
studentsRouter.post('/:id/suspend', requirePermission('students:write'), validate(reasonSchema), ctrl.suspend);
studentsRouter.post('/:id/reinstate', requirePermission('students:write'), ctrl.reinstate);
studentsRouter.get('/:id/history', requirePermission('students:read'), ctrl.history);
