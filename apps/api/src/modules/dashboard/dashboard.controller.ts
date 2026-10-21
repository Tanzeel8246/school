import type { Request, Response, NextFunction } from 'express';
import * as service from './dashboard.service.js';

/** Returns { data: { role, widgets } } scoped to the caller's tenant. */
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getDashboard(req.user!) });
  } catch (e) {
    next(e);
  }
}
