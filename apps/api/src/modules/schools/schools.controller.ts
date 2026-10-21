import type { Request, Response, NextFunction } from 'express';
import * as service from './schools.service.js';
import { audit } from '../../utils/audit.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.list(req.query as never));
  } catch (e) {
    next(e);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getById(req.params.id) });
  } catch (e) {
    next(e);
  }
}

/** Self-service read of the caller's own tenant (req.user.schoolId). */
export async function getCurrent(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getCurrent(req.user!) });
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await service.create(req.body);
    await audit(req, 'school.create', 'school', school.id, null, school);
    res.status(201).json({ data: school });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.update(req.params.id, req.body);
    await audit(req, 'school.update', 'school', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

/**
 * Update the caller's own tenant (the "School setup form"). Forced to the
 * authenticated schoolId so a tenant admin can never edit another tenant.
 */
export async function updateCurrent(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.update(req.user!.schoolId, req.body);
    await audit(req, 'school.update', 'school', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await service.softDelete(req.params.id);
    await audit(req, 'school.delete', 'school', school.id, school, null);
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
}

export async function suspend(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await service.suspend(req.params.id);
    await audit(req, 'school.suspend', 'school', school.id, null, school);
    res.json({ data: school });
  } catch (e) {
    next(e);
  }
}

export async function reactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await service.reactivate(req.params.id);
    await audit(req, 'school.reactivate', 'school', school.id, null, school);
    res.json({ data: school });
  } catch (e) {
    next(e);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await service.cancel(req.params.id);
    await audit(req, 'school.cancel', 'school', school.id, null, school);
    res.json({ data: school });
  } catch (e) {
    next(e);
  }
}

export async function renew(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await service.reactivate(req.params.id); // renew does the same as reactivate
    await audit(req, 'school.renew', 'school', school.id, null, school);
    res.json({ data: school });
  } catch (e) {
    next(e);
  }
}
