import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './attendance.service.js';

export async function getSectionRoster(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getSectionRoster(
      req.user!,
      req.params.sectionId,
      (req.query as Record<string, string>).date,
    );
    res.json(result);
  } catch (e) { next(e); }
}

export async function bulkMark(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.bulkMark(req.user!, req.params.sectionId, req.body);
    await audit(req, 'attendance.bulk_mark', 'attendance', null, null, {
      count: req.body.records?.length ?? 0,
      date: req.body.date,
      method: req.body.method,
    });
    res.json({ data: result });
  } catch (e) { next(e); }
}

export async function singleMark(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await service.singleMark(req.user!, req.params.studentId, req.body);
    await audit(req, 'attendance.single_mark', 'attendance', row.id, null, row);
    res.json({ data: row });
  } catch (e) { next(e); }
}

export async function getReport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getReport(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getDailySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getDailySummary(
      req.user!,
      (req.query as Record<string, string>).date,
    );
    res.json(result);
  } catch (e) { next(e); }
}
