/**
 * Parent portal router — read-only endpoints scoped to the authenticated
 * parent's own children via guardian_students.
 * All routes require authentication; ownership is enforced in the service layer.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  attendanceQuerySchema,
  feesQuerySchema,
  resultsQuerySchema,
  studentParamSchema,
  changePasswordSchema,
} from './parent.schema.js';
import * as ctrl from './parent.controller.js';

export const parentRouter = Router();
parentRouter.use(authenticate);

parentRouter.get('/children', ctrl.getChildren);

parentRouter.post(
  '/change-password',
  validate(changePasswordSchema, 'body'),
  ctrl.changePassword,
);

parentRouter.get(
  '/children/:studentId/attendance',
  validate(studentParamSchema, 'params'),
  validate(attendanceQuerySchema, 'query'),
  ctrl.getChildAttendance,
);

parentRouter.get(
  '/children/:studentId/fees',
  validate(studentParamSchema, 'params'),
  validate(feesQuerySchema, 'query'),
  ctrl.getChildFees,
);

parentRouter.get(
  '/children/:studentId/results',
  validate(studentParamSchema, 'params'),
  validate(resultsQuerySchema, 'query'),
  ctrl.getChildResults,
);

parentRouter.get(
  '/children/:studentId/timetable',
  validate(studentParamSchema, 'params'),
  ctrl.getChildTimetable,
);

