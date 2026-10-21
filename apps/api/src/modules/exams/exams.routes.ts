/**
 * Exams router — all routes require authentication.
 * Literal paths (grade-config, /:id/publish, /:id/marks, etc.) are declared
 * BEFORE /:id so Express resolves them first (blueprint §routing).
 *
 * Permission matrix:
 *   results:read      — list/get exams, results, analysis, grade config
 *   exams:enter_marks — marks roster GET + POST
 *   exams:write       — create, update, delete exams, patch subjects
 *   exams:manage      — publish/unpublish, grade config PUT
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listExamsQuerySchema,
  createExamSchema,
  updateExamSchema,
  patchSubjectsSchema,
  marksQuerySchema,
  enterMarksSchema,
  resultsQuerySchema,
  classAnalysisQuerySchema,
  putGradeConfigSchema,
} from './exams.schema.js';
import * as ctrl from './exams.controller.js';

export const examsRouter = Router();
examsRouter.use(authenticate);

// ── Grade config — literal paths BEFORE /:id ──────────────────────────────
examsRouter.get(
  '/grade-config',
  requirePermission('results:read'),
  ctrl.getGradeConfig,
);
examsRouter.put(
  '/grade-config',
  requirePermission('exams:manage'),
  validate(putGradeConfigSchema),
  ctrl.putGradeConfig,
);

// ── Exam list + create ─────────────────────────────────────────────────────
examsRouter.get(
  '/',
  requirePermission('results:read'),
  validate(listExamsQuerySchema, 'query'),
  ctrl.listExams,
);
examsRouter.post(
  '/',
  requirePermission('exams:write'),
  validate(createExamSchema),
  ctrl.createExam,
);

// ── Literal sub-paths inside /:id — declared BEFORE /:id ──────────────────
// (Express matches in registration order; /:id would eat these if placed first.)

// Marks entry: literal /:id/marks before any generic /:id handler.
examsRouter.get(
  '/:id/marks',
  requirePermission('exams:enter_marks'),
  validate(marksQuerySchema, 'query'),
  ctrl.getMarksRoster,
);
examsRouter.post(
  '/:id/marks',
  requirePermission('exams:enter_marks'),
  validate(enterMarksSchema),
  ctrl.enterMarks,
);

// Publish / unpublish.
examsRouter.post('/:id/publish',   requirePermission('exams:manage'), ctrl.publishExam);
examsRouter.post('/:id/unpublish', requirePermission('exams:manage'), ctrl.unpublishExam);

// Replace subject list.
examsRouter.patch(
  '/:id/subjects',
  requirePermission('exams:write'),
  validate(patchSubjectsSchema),
  ctrl.patchExamSubjects,
);

// Results — literal /:id/results/... before /:id.
examsRouter.get(
  '/:id/results',
  requirePermission('results:read'),
  validate(resultsQuerySchema, 'query'),
  ctrl.listResults,
);
examsRouter.get(
  '/:id/results/:studentId',
  requirePermission('results:read'),
  ctrl.getStudentResult,
);

// Analysis.
examsRouter.get(
  '/:id/analysis/class',
  requirePermission('results:read'),
  validate(classAnalysisQuerySchema, 'query'),
  ctrl.getClassAnalysis,
);
examsRouter.get(
  '/:id/analysis/subject/:subjectId',
  requirePermission('results:read'),
  ctrl.getSubjectAnalysis,
);

// ── Generic /:id CRUD — after all literal paths ────────────────────────────
examsRouter.get(
  '/:id',
  requirePermission('results:read'),
  ctrl.getExam,
);
examsRouter.patch(
  '/:id',
  requirePermission('exams:write'),
  validate(updateExamSchema),
  ctrl.updateExam,
);
examsRouter.delete(
  '/:id',
  requirePermission('exams:write'),
  ctrl.deleteExam,
);
