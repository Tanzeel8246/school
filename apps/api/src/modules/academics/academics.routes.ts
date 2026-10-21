/**
 * Academics router.
 * Covers: academic sessions, classes, sections, subjects, timetable slots.
 * All routes require authentication. CRUD is split by academics:read / academics:write.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listSessionsQuerySchema,
  createSessionSchema,
  updateSessionSchema,
  listClassesQuerySchema,
  createClassSchema,
  updateClassSchema,
  listSectionsQuerySchema,
  createSectionSchema,
  updateSectionSchema,
  listSubjectsQuerySchema,
  createSubjectSchema,
  updateSubjectSchema,
  listTimetableQuerySchema,
  createTimetableSlotSchema,
  updateTimetableSlotSchema,
} from './academics.schema.js';
import * as ctrl from './academics.controller.js';

export const academicsRouter = Router();
academicsRouter.use(authenticate);

// ── Academic Sessions ─────────────────────────────────────────────────────
academicsRouter.get(
  '/sessions',
  requirePermission('academics:read'),
  validate(listSessionsQuerySchema, 'query'),
  ctrl.listSessions,
);
academicsRouter.post(
  '/sessions',
  requirePermission('academics:write'),
  validate(createSessionSchema),
  ctrl.createSession,
);
academicsRouter.patch(
  '/sessions/:id',
  requirePermission('academics:write'),
  validate(updateSessionSchema),
  ctrl.updateSession,
);
academicsRouter.delete(
  '/sessions/:id',
  requirePermission('academics:write'),
  ctrl.deleteSession,
);

// ── Classes ───────────────────────────────────────────────────────────────
academicsRouter.get(
  '/classes',
  requirePermission('academics:read'),
  validate(listClassesQuerySchema, 'query'),
  ctrl.listClasses,
);
academicsRouter.post(
  '/classes',
  requirePermission('academics:write'),
  validate(createClassSchema),
  ctrl.createClass,
);
academicsRouter.patch(
  '/classes/:id',
  requirePermission('academics:write'),
  validate(updateClassSchema),
  ctrl.updateClass,
);
academicsRouter.delete(
  '/classes/:id',
  requirePermission('academics:write'),
  ctrl.deleteClass,
);

// ── Sections ──────────────────────────────────────────────────────────────
academicsRouter.get(
  '/sections',
  requirePermission('academics:read'),
  validate(listSectionsQuerySchema, 'query'),
  ctrl.listSections,
);
academicsRouter.post(
  '/sections',
  requirePermission('academics:write'),
  validate(createSectionSchema),
  ctrl.createSection,
);
academicsRouter.patch(
  '/sections/:id',
  requirePermission('academics:write'),
  validate(updateSectionSchema),
  ctrl.updateSection,
);
academicsRouter.delete(
  '/sections/:id',
  requirePermission('academics:write'),
  ctrl.deleteSection,
);

// ── Subjects ──────────────────────────────────────────────────────────────
academicsRouter.get(
  '/subjects',
  requirePermission('academics:read'),
  validate(listSubjectsQuerySchema, 'query'),
  ctrl.listSubjects,
);
academicsRouter.post(
  '/subjects',
  requirePermission('academics:write'),
  validate(createSubjectSchema),
  ctrl.createSubject,
);
academicsRouter.patch(
  '/subjects/:id',
  requirePermission('academics:write'),
  validate(updateSubjectSchema),
  ctrl.updateSubject,
);
academicsRouter.delete(
  '/subjects/:id',
  requirePermission('academics:write'),
  ctrl.deleteSubject,
);

// ── Timetable ─────────────────────────────────────────────────────────────
academicsRouter.get(
  '/timetable',
  requirePermission('academics:read'),
  validate(listTimetableQuerySchema, 'query'),
  ctrl.listTimetable,
);
academicsRouter.post(
  '/timetable',
  requirePermission('academics:write'),
  validate(createTimetableSlotSchema),
  ctrl.createTimetableSlot,
);
academicsRouter.patch(
  '/timetable/:id',
  requirePermission('academics:write'),
  validate(updateTimetableSlotSchema),
  ctrl.updateTimetableSlot,
);
academicsRouter.delete(
  '/timetable/:id',
  requirePermission('academics:write'),
  ctrl.deleteTimetableSlot,
);
