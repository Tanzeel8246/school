import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './academics.service.js';

// ── Sessions ──────────────────────────────────────────────────────────────

export async function listSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listSessions(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await service.createSession(req.user!, req.body);
    await audit(req, 'academics.session.create', 'academic_session', session.id, null, session);
    res.status(201).json({ data: session });
  } catch (e) { next(e); }
}

export async function updateSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateSession(req.user!, req.params.id, req.body);
    await audit(req, 'academics.session.update', 'academic_session', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteSession(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteSession(req.user!, req.params.id);
    await audit(req, 'academics.session.delete', 'academic_session', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Classes ───────────────────────────────────────────────────────────────

export async function listClasses(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listClasses(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createClass(req: Request, res: Response, next: NextFunction) {
  try {
    const cls = await service.createClass(req.user!, req.body);
    await audit(req, 'academics.class.create', 'class', cls.id, null, cls);
    res.status(201).json({ data: cls });
  } catch (e) { next(e); }
}

export async function updateClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateClass(req.user!, req.params.id, req.body);
    await audit(req, 'academics.class.update', 'class', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteClass(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteClass(req.user!, req.params.id);
    await audit(req, 'academics.class.delete', 'class', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Sections ──────────────────────────────────────────────────────────────

export async function listSections(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listSections(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createSection(req: Request, res: Response, next: NextFunction) {
  try {
    const section = await service.createSection(req.user!, req.body);
    await audit(req, 'academics.section.create', 'section', section.id, null, section);
    res.status(201).json({ data: section });
  } catch (e) { next(e); }
}

export async function updateSection(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateSection(req.user!, req.params.id, req.body);
    await audit(req, 'academics.section.update', 'section', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteSection(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteSection(req.user!, req.params.id);
    await audit(req, 'academics.section.delete', 'section', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Subjects ──────────────────────────────────────────────────────────────

export async function listSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listSubjects(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const subject = await service.createSubject(req.user!, req.body);
    await audit(req, 'academics.subject.create', 'subject', subject.id, null, subject);
    res.status(201).json({ data: subject });
  } catch (e) { next(e); }
}

export async function updateSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateSubject(req.user!, req.params.id, req.body);
    await audit(req, 'academics.subject.update', 'subject', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteSubject(req.user!, req.params.id);
    await audit(req, 'academics.subject.delete', 'subject', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Timetable ─────────────────────────────────────────────────────────────

export async function listTimetable(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listTimetable(
      req.user!,
      (req.query as Record<string, string>).sectionId,
    );
    res.json(result);
  } catch (e) { next(e); }
}

export async function createTimetableSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const slot = await service.createTimetableSlot(req.user!, req.body);
    await audit(req, 'academics.timetable.create', 'timetable_slot', slot.id, null, slot);
    res.status(201).json({ data: slot });
  } catch (e) { next(e); }
}

export async function updateTimetableSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateTimetableSlot(req.user!, req.params.id, req.body);
    await audit(req, 'academics.timetable.update', 'timetable_slot', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteTimetableSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteTimetableSlot(req.user!, req.params.id);
    await audit(req, 'academics.timetable.delete', 'timetable_slot', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}
