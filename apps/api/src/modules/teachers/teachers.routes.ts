import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listQuerySchema,
  createTeacherSchema,
  updateTeacherSchema,
  setSubjectsSchema,
} from './teachers.schema.js';
import * as ctrl from './teachers.controller.js';
import { enforceUsageLimit } from '../../middleware/saas.js';

export const teachersRouter = Router();
teachersRouter.use(authenticate);

teachersRouter.get('/', requirePermission('teachers:read'), validate(listQuerySchema, 'query'), ctrl.list);
teachersRouter.post(
  '/',
  requirePermission('teachers:write'),
  enforceUsageLimit('teachers'),
  validate(createTeacherSchema),
  ctrl.create,
);

teachersRouter.get('/:id', requirePermission('teachers:read'), ctrl.getById);
teachersRouter.patch('/:id', requirePermission('teachers:write'), validate(updateTeacherSchema), ctrl.update);
teachersRouter.delete('/:id', requirePermission('teachers:write'), ctrl.remove);

teachersRouter.get('/:id/subjects', requirePermission('teachers:read'), ctrl.getSubjects);
teachersRouter.put(
  '/:id/subjects',
  requirePermission('teachers:write'),
  validate(setSubjectsSchema),
  ctrl.setSubjects,
);
