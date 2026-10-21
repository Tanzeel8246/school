import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './transport.service.js';

// ── Vehicles ───────────────────────────────────────────────────────────────

export async function listVehicles(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listVehicles(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const vehicle = await service.createVehicle(req.user!, req.body);
    await audit(req, 'transport.vehicle.create', 'vehicle', vehicle.id, null, vehicle);
    res.status(201).json({ data: vehicle });
  } catch (e) { next(e); }
}

export async function updateVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateVehicle(req.user!, req.params.id, req.body);
    await audit(req, 'transport.vehicle.update', 'vehicle', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteVehicle(req.user!, req.params.id);
    await audit(req, 'transport.vehicle.delete', 'vehicle', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Routes ─────────────────────────────────────────────────────────────────

export async function listRoutes(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listRoutes(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const route = await service.createRoute(req.user!, req.body);
    await audit(req, 'transport.route.create', 'route', route.id, null, route);
    res.status(201).json({ data: route });
  } catch (e) { next(e); }
}

export async function updateRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateRoute(req.user!, req.params.id, req.body);
    await audit(req, 'transport.route.update', 'route', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteRoute(req.user!, req.params.id);
    await audit(req, 'transport.route.delete', 'route', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Stops ──────────────────────────────────────────────────────────────────

export async function listRouteStops(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listRouteStops(req.user!, req.params.id);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createRouteStop(req: Request, res: Response, next: NextFunction) {
  try {
    const stop = await service.createRouteStop(req.user!, req.params.id, req.body);
    await audit(req, 'transport.stop.create', 'route_stop', stop.id, null, stop);
    res.status(201).json({ data: stop });
  } catch (e) { next(e); }
}

export async function deleteRouteStop(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteRouteStop(req.user!, req.params.id, req.params.stopId);
    await audit(req, 'transport.stop.delete', 'route_stop', req.params.stopId, null, null);
    res.json({ data: result });
  } catch (e) { next(e); }
}

// ── Student Transport ──────────────────────────────────────────────────────

export async function listStudentTransport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listStudentTransport(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function assignStudentTransport(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await service.assignStudentTransport(req.user!, req.body);
    await audit(req, 'transport.student.assign', 'student_transport', assignment.id, null, assignment);
    res.status(201).json({ data: assignment });
  } catch (e) { next(e); }
}

export async function removeStudentTransport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.removeStudentTransport(req.user!, req.params.id);
    await audit(req, 'transport.student.remove', 'student_transport', req.params.id, null, null);
    res.json({ data: result });
  } catch (e) { next(e); }
}
