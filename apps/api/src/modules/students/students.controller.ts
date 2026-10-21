import type { Request, Response, NextFunction } from 'express';
import * as service from './students.service.js';
import { audit } from '../../utils/audit.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.list(req.user!, req.query as never));
  } catch (e) {
    next(e);
  }
}

export async function listGuardians(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.listGuardians(req.user!) });
  } catch (e) {
    next(e);
  }
}

export async function resetGuardianPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await service.resetGuardianPassword(req.user!, req.params.id, req.body.password);
    await audit(req, 'parent.password_reset', 'user', req.params.id, null, { action: 'reset' });
    res.json({ data: { ok: true } });
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
    const student = await service.create(req.user!, req.body);
    await audit(req, 'student.create', 'student', student.id, null, student);
    res.status(201).json({ data: student });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.update(req.user!, req.params.id, req.body);
    await audit(req, 'student.update', 'student', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const student = await service.softDelete(req.user!, req.params.id);
    await audit(req, 'student.delete', 'student', student.id, student, null);
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
}

export async function promote(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.promote(req.user!, req.params.id, req.body.sectionId);
    await audit(req, 'student.promote', 'student', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

export async function transfer(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.transfer(req.user!, req.params.id, req.body?.reason);
    await audit(req, 'student.transfer', 'student', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

export async function suspend(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.suspend(req.user!, req.params.id, req.body?.reason);
    await audit(req, 'student.suspend', 'student', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

export async function reinstate(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.reinstate(req.user!, req.params.id);
    await audit(req, 'student.reinstate', 'student', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

export async function history(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.history(req.user!, req.params.id) });
  } catch (e) {
    next(e);
  }
}
