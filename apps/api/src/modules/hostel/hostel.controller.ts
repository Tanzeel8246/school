import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './hostel.service.js';

// ── Hostels ────────────────────────────────────────────────────────────────

export async function listHostels(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listHostels(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createHostel(req: Request, res: Response, next: NextFunction) {
  try {
    const hostel = await service.createHostel(req.user!, req.body);
    await audit(req, 'hostel.create', 'hostel', hostel.id, null, hostel);
    res.status(201).json({ data: hostel });
  } catch (e) { next(e); }
}

export async function updateHostel(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateHostel(req.user!, req.params.id, req.body);
    await audit(req, 'hostel.update', 'hostel', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteHostel(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteHostel(req.user!, req.params.id);
    await audit(req, 'hostel.delete', 'hostel', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Rooms ──────────────────────────────────────────────────────────────────

export async function listHostelRooms(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listHostelRooms(req.user!, req.params.id, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createHostelRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const room = await service.createHostelRoom(req.user!, req.params.id, req.body);
    await audit(req, 'hostel.room.create', 'hostel_room', room.id, null, room);
    res.status(201).json({ data: room });
  } catch (e) { next(e); }
}

export async function updateHostelRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateHostelRoom(req.user!, req.params.id, req.body);
    await audit(req, 'hostel.room.update', 'hostel_room', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteHostelRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteHostelRoom(req.user!, req.params.id);
    await audit(req, 'hostel.room.delete', 'hostel_room', req.params.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Allocations ────────────────────────────────────────────────────────────

export async function listAllocations(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listAllocations(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function allocateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const alloc = await service.allocateStudent(req.user!, req.body);
    await audit(req, 'hostel.allocate', 'hostel_allocation', alloc.id, null, alloc);
    res.status(201).json({ data: alloc });
  } catch (e) { next(e); }
}

export async function vacateAllocation(req: Request, res: Response, next: NextFunction) {
  try {
    const alloc = await service.vacateAllocation(req.user!, req.params.id, req.body);
    await audit(req, 'hostel.vacate', 'hostel_allocation', alloc.id, null, alloc);
    res.json({ data: alloc });
  } catch (e) { next(e); }
}

export async function getCurrentAllocation(req: Request, res: Response, next: NextFunction) {
  try {
    const alloc = await service.getCurrentAllocation(req.user!, req.params.studentId);
    res.json({ data: alloc });
  } catch (e) { next(e); }
}

// ── Mess Menu ──────────────────────────────────────────────────────────────

export async function getMessMenu(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getMessMenu(req.user!, req.query.hostelId as string);
    res.json(result);
  } catch (e) { next(e); }
}

export async function upsertMessMenu(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.upsertMessMenu(req.user!, req.body);
    await audit(req, 'hostel.mess_update', 'mess_menu', req.body.hostelId, null, result);
    res.json(result);
  } catch (e) { next(e); }
}
