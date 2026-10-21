/**
 * Zod validation schemas for the Exams module (Phase 5).
 * All money fields use z.number() — marks are NUMERIC(6,2) not integers.
 * Grading is school-configurable via grade_config; defaults in service.
 */
import { z } from 'zod';

// ── Exam subject entry (used inside create / patch-subjects) ───────────────

export const examSubjectInputSchema = z.object({
  subjectId:    z.string().uuid(),
  totalMarks:   z.number().positive().max(999.99).default(100),
  passingMarks: z.number().nonnegative().max(999.99).default(40),
});
export type ExamSubjectInput = z.infer<typeof examSubjectInputSchema>;

// ── Create exam ────────────────────────────────────────────────────────────

export const createExamSchema = z.object({
  name:      z.string().min(1).max(200),
  examType:  z.enum(['monthly', 'midterm', 'final', 'quarterly', 'annual']),
  sessionId: z.string().uuid().optional(),
  classId:   z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  subjects:  z.array(examSubjectInputSchema).min(0).default([]),
});
export type CreateExamInput = z.infer<typeof createExamSchema>;

// ── Update exam (partial) ──────────────────────────────────────────────────

export const updateExamSchema = z.object({
  name:      z.string().min(1).max(200).optional(),
  examType:  z.enum(['monthly', 'midterm', 'final', 'quarterly', 'annual']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  classId:   z.string().uuid().optional(),
});
export type UpdateExamInput = z.infer<typeof updateExamSchema>;

// ── List exams query ───────────────────────────────────────────────────────

export const listExamsQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
  classId:   z.string().uuid().optional(),
  examType:  z.enum(['monthly', 'midterm', 'final', 'quarterly', 'annual']).optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(1000).default(20),
});
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;

// ── Replace subject list ───────────────────────────────────────────────────

export const patchSubjectsSchema = z.object({
  subjects: z.array(examSubjectInputSchema).min(1),
});
export type PatchSubjectsInput = z.infer<typeof patchSubjectsSchema>;

// ── Marks entry ───────────────────────────────────────────────────────────

export const marksEntryRowSchema = z.object({
  studentId:      z.string().uuid(),
  marksObtained:  z.number().nonnegative().max(999.99),
  isAbsent:       z.boolean().optional().default(false),
});
export type MarksEntryRow = z.infer<typeof marksEntryRowSchema>;

export const enterMarksSchema = z.object({
  sectionId: z.string().uuid(),
  subjectId: z.string().uuid(),
  entries:   z.array(marksEntryRowSchema).min(1),
});
export type EnterMarksInput = z.infer<typeof enterMarksSchema>;

export const marksQuerySchema = z.object({
  sectionId: z.string().uuid(),
  subjectId: z.string().uuid(),
});
export type MarksQuery = z.infer<typeof marksQuerySchema>;

// ── Results query ─────────────────────────────────────────────────────────

export const resultsQuerySchema = z.object({
  sectionId: z.string().uuid().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(1000).default(50),
});
export type ResultsQuery = z.infer<typeof resultsQuerySchema>;

// ── Analysis query ────────────────────────────────────────────────────────

export const classAnalysisQuerySchema = z.object({
  sectionId: z.string().uuid().optional(),
});
export type ClassAnalysisQuery = z.infer<typeof classAnalysisQuerySchema>;

// ── Grade config ──────────────────────────────────────────────────────────

export const gradeConfigRowSchema = z.object({
  gradeLetter:   z.string().min(1).max(3),
  minPercentage: z.number().nonnegative().max(100),
  maxPercentage: z.number().nonnegative().max(100),
  gradePoint:    z.number().nonnegative().max(4),
  displayOrder:  z.number().int().nonnegative().default(0),
});
export type GradeConfigRow = z.infer<typeof gradeConfigRowSchema>;

export const putGradeConfigSchema = z.object({
  grades: z.array(gradeConfigRowSchema).min(1),
});
export type PutGradeConfigInput = z.infer<typeof putGradeConfigSchema>;
