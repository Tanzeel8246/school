import type { Request, Response, NextFunction } from 'express';
import * as service from './parent.service.js';

export async function getChildren(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getChildren(req.user!);
    res.json(result);
  } catch (e) { next(e); }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    await service.changePassword(req.user!, req.body.password);
    res.json({ data: { ok: true } });
  } catch (e) { next(e); }
}

export async function getChildAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getChildAttendance(req.user!, req.params.studentId, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getChildFees(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getChildFees(req.user!, req.params.studentId, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getChildResults(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getChildResults(req.user!, req.params.studentId, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getChildTimetable(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getChildTimetable(req.user!, req.params.studentId);
    res.json(result);
  } catch (e) { next(e); }
}
