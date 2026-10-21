import type { Request, Response, NextFunction } from 'express';
import * as service from './teachers.service.js';
import { audit } from '../../utils/audit.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.list(req.user!, req.query as never));
  } catch (e) {
    next(e);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getById(req.user!, req.params.id) });
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const teacher = await service.create(req.user!, req.body);
    await audit(req, 'teacher.create', 'staff', teacher.id, null, teacher);
    res.status(201).json({ data: teacher });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.update(req.user!, req.params.id, req.body);
    await audit(req, 'teacher.update', 'staff', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const teacher = await service.softDelete(req.user!, req.params.id);
    await audit(req, 'teacher.delete', 'staff', teacher.id, teacher, null);
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
}

export async function getSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getSubjects(req.user!, req.params.id) });
  } catch (e) {
    next(e);
  }
}

export async function setSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const subjects = await service.setSubjects(req.user!, req.params.id, req.body.subjectIds);
    await audit(req, 'teacher.subjects.set', 'staff', req.params.id, null, subjects);
    res.json({ data: subjects });
  } catch (e) {
    next(e);
  }
}
