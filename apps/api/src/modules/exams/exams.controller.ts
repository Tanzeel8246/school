/**
 * Exams controller — thin layer that delegates to the service, wraps in
 * the standard { data } / { data, meta } envelope, and fires audit trails.
 */
import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './exams.service.js';

// ── Exams CRUD ─────────────────────────────────────────────────────────────

export async function listExams(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listExams(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createExam(req: Request, res: Response, next: NextFunction) {
  try {
    const exam = await service.createExam(req.user!, req.body);
    await audit(req, 'exam.create', 'exam', exam.id, null, exam);
    res.status(201).json({ data: exam });
  } catch (e) { next(e); }
}

export async function getExam(req: Request, res: Response, next: NextFunction) {
  try {
    const exam = await service.getExamById(req.user!, req.params.id);
    res.json({ data: exam });
  } catch (e) { next(e); }
}

export async function updateExam(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateExam(req.user!, req.params.id, req.body);
    await audit(req, 'exam.update', 'exam', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteExam(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteExam(req.user!, req.params.id);
    await audit(req, 'exam.delete', 'exam', result.id, { id: result.id }, null);
    res.json({ data: result });
  } catch (e) { next(e); }
}

export async function publishExam(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.publishExam(req.user!, req.params.id);
    await audit(req, 'exam.publish', 'exam', result.id, { isPublished: false }, result);
    res.json({ data: result });
  } catch (e) { next(e); }
}

export async function unpublishExam(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.unpublishExam(req.user!, req.params.id);
    await audit(req, 'exam.unpublish', 'exam', result.id, { isPublished: true }, result);
    res.json({ data: result });
  } catch (e) { next(e); }
}

export async function patchExamSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const subjects = await service.patchExamSubjects(req.user!, req.params.id, req.body);
    await audit(req, 'exam.subjects_replaced', 'exam', req.params.id, null, { subjects });
    res.json({ data: subjects });
  } catch (e) { next(e); }
}

// ── Marks entry ────────────────────────────────────────────────────────────

export async function getMarksRoster(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getMarksRoster(req.user!, req.params.id, req.query as never);
    res.json({ data: result });
  } catch (e) { next(e); }
}

export async function enterMarks(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.enterMarks(req.user!, req.params.id, req.body);
    await audit(req, 'exam.marks_entry', 'exam', req.params.id, null, {
      subjectId: result.subjectId,
      sectionId: result.sectionId,
      count:     result.entriesUpserted,
    });
    res.json({ data: result });
  } catch (e) { next(e); }
}

// ── Results ───────────────────────────────────────────────────────────────

export async function listResults(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listResults(req.user!, req.params.id, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getStudentResult(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getStudentResult(req.user!, req.params.id, req.params.studentId);
    res.json(result);
  } catch (e) { next(e); }
}

// ── Analysis ──────────────────────────────────────────────────────────────

export async function getClassAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getClassAnalysis(req.user!, req.params.id, req.query as never);
    res.json({ data: result });
  } catch (e) { next(e); }
}

export async function getSubjectAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getSubjectAnalysis(
      req.user!, req.params.id, req.params.subjectId,
    );
    res.json({ data: result });
  } catch (e) { next(e); }
}

// ── Grade config ──────────────────────────────────────────────────────────

export async function getGradeConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await service.getGradeConfig(req.user!);
    res.json({ data: config });
  } catch (e) { next(e); }
}

export async function putGradeConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await service.putGradeConfig(req.user!, req.body);
    await audit(req, 'grade_config.update', 'grade_config', null, null, { grades: config });
    res.json({ data: config });
  } catch (e) { next(e); }
}
