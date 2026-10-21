/**
 * Hostel router — all routes require authentication.
 * Literal paths (/allocations, /mess) declared BEFORE /:id routes (blueprint §routing).
 * Permissions: hostel:read, hostel:write.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listHostelsQuerySchema,
  createHostelSchema,
  updateHostelSchema,
  listHostelRoomsQuerySchema,
  createHostelRoomSchema,
  updateHostelRoomSchema,
  listAllocationsQuerySchema,
  createHostelAllocationSchema,
  vacateAllocationSchema,
  upsertMessMenuSchema,
  getMessMenuQuerySchema,
} from './hostel.schema.js';
import * as ctrl from './hostel.controller.js';

export const hostelRouter = Router();
hostelRouter.use(authenticate);

// ── Literal paths BEFORE /:id ──────────────────────────────────────────────

// Allocations
hostelRouter.get('/allocations', requirePermission('hostel:read'), validate(listAllocationsQuerySchema, 'query'), ctrl.listAllocations);
hostelRouter.post('/allocations', requirePermission('hostel:write'), validate(createHostelAllocationSchema), ctrl.allocateStudent);
hostelRouter.patch('/allocations/:id/vacate', requirePermission('hostel:write'), validate(vacateAllocationSchema), ctrl.vacateAllocation);
hostelRouter.get('/allocations/:studentId/current', requirePermission('hostel:read'), ctrl.getCurrentAllocation);

// Mess menu
hostelRouter.get('/mess', requirePermission('hostel:read'), validate(getMessMenuQuerySchema, 'query'), ctrl.getMessMenu);
hostelRouter.put('/mess', requirePermission('hostel:write'), validate(upsertMessMenuSchema), ctrl.upsertMessMenu);

// Room management (global, not sub-resource)
hostelRouter.patch('/rooms/:id', requirePermission('hostel:write'), validate(updateHostelRoomSchema), ctrl.updateHostelRoom);
hostelRouter.delete('/rooms/:id', requirePermission('hostel:write'), ctrl.deleteHostelRoom);

// ── Hostels CRUD ───────────────────────────────────────────────────────────
hostelRouter.get('/hostels', requirePermission('hostel:read'), validate(listHostelsQuerySchema, 'query'), ctrl.listHostels);
hostelRouter.post('/hostels', requirePermission('hostel:write'), validate(createHostelSchema), ctrl.createHostel);
hostelRouter.patch('/hostels/:id', requirePermission('hostel:write'), validate(updateHostelSchema), ctrl.updateHostel);
hostelRouter.delete('/hostels/:id', requirePermission('hostel:write'), ctrl.deleteHostel);

// ── Rooms (sub-resource of hostel) ────────────────────────────────────────
hostelRouter.get('/hostels/:id/rooms', requirePermission('hostel:read'), validate(listHostelRoomsQuerySchema, 'query'), ctrl.listHostelRooms);
hostelRouter.post('/hostels/:id/rooms', requirePermission('hostel:write'), validate(createHostelRoomSchema), ctrl.createHostelRoom);
