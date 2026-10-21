import type { Request, Response, NextFunction } from 'express';
import * as service from './billing.service.js';

export async function listPlans(_req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await service.listPlans();
    res.json({ data: plans });
  } catch (err) {
    next(err);
  }
}

export async function requestSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { planId, transactionId } = req.body;
    if (!planId) {
      res.status(400).json({ error: { message: 'planId is required' } });
      return;
    }
    const screenshotUrl = req.file ? `/uploads/${req.file.filename}` : null;
    if (!screenshotUrl) {
      res.status(400).json({ error: { message: 'Payment screenshot is required' } });
      return;
    }
    const result = await service.requestSubscription(req.user!, planId, transactionId || '', screenshotUrl);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getMyRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getMyRequests(req.user!);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function listAllRequests(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listAllRequests();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function approveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const result = await service.approveRequest(id, notes);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function rejectRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const result = await service.rejectRequest(id, notes);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
