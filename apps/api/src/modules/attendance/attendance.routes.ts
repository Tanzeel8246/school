/**
 * Attendance router.
 * Literal paths (/report, /summary) must be declared BEFORE param paths (/:studentId/single).
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  bulkMarkSchema,
  singleMarkSchema,
  sectionAttendanceQuerySchema,
  reportQuerySchema,
  summaryQuerySchema,
} from './attendance.schema.js';
import * as ctrl from './attendance.controller.js';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

// Literal paths first
attendanceRouter.get(
  '/report',
  requirePermission('students:read'),
  validate(reportQuerySchema, 'query'),
  ctrl.getReport,
);

attendanceRouter.get(
  '/summary',
  requirePermission('students:read'),
  validate(summaryQuerySchema, 'query'),
  ctrl.getDailySummary,
);

// Section roster + bulk mark
attendanceRouter.get(
  '/section/:sectionId',
  requirePermission('students:read'),
  validate(sectionAttendanceQuerySchema, 'query'),
  ctrl.getSectionRoster,
);

attendanceRouter.post(
  '/section/:sectionId/bulk',
  requirePermission('attendance:mark'),
  validate(bulkMarkSchema),
  ctrl.bulkMark,
);

// Single student mark
attendanceRouter.post(
  '/:studentId/single',
  requirePermission('attendance:mark'),
  validate(singleMarkSchema),
  ctrl.singleMark,
);
