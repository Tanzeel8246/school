/**
 * Transport router — all routes require authentication.
 * Literal paths (/students) declared BEFORE /:id routes (blueprint §routing).
 * Permissions: transport:read, transport:write.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listVehiclesQuerySchema,
  createVehicleSchema,
  updateVehicleSchema,
  listRoutesQuerySchema,
  createRouteSchema,
  updateRouteSchema,
  createRouteStopSchema,
  listStudentTransportQuerySchema,
  createStudentTransportSchema,
} from './transport.schema.js';
import * as ctrl from './transport.controller.js';

export const transportRouter = Router();
transportRouter.use(authenticate);

// ── Vehicles ───────────────────────────────────────────────────────────────
transportRouter.get('/vehicles', requirePermission('transport:read'), validate(listVehiclesQuerySchema, 'query'), ctrl.listVehicles);
transportRouter.post('/vehicles', requirePermission('transport:write'), validate(createVehicleSchema), ctrl.createVehicle);
transportRouter.patch('/vehicles/:id', requirePermission('transport:write'), validate(updateVehicleSchema), ctrl.updateVehicle);
transportRouter.delete('/vehicles/:id', requirePermission('transport:write'), ctrl.deleteVehicle);

// ── Student assignments — literal /students BEFORE /:id ───────────────────
transportRouter.get('/students', requirePermission('transport:read'), validate(listStudentTransportQuerySchema, 'query'), ctrl.listStudentTransport);
transportRouter.post('/students', requirePermission('transport:write'), validate(createStudentTransportSchema), ctrl.assignStudentTransport);
transportRouter.delete('/students/:id', requirePermission('transport:write'), ctrl.removeStudentTransport);

// ── Routes CRUD ────────────────────────────────────────────────────────────
transportRouter.get('/routes', requirePermission('transport:read'), validate(listRoutesQuerySchema, 'query'), ctrl.listRoutes);
transportRouter.post('/routes', requirePermission('transport:write'), validate(createRouteSchema), ctrl.createRoute);
transportRouter.patch('/routes/:id', requirePermission('transport:write'), validate(updateRouteSchema), ctrl.updateRoute);
transportRouter.delete('/routes/:id', requirePermission('transport:write'), ctrl.deleteRoute);

// ── Stops (sub-resource of route) ─────────────────────────────────────────
transportRouter.get('/routes/:id/stops', requirePermission('transport:read'), ctrl.listRouteStops);
transportRouter.post('/routes/:id/stops', requirePermission('transport:write'), validate(createRouteStopSchema), ctrl.createRouteStop);
transportRouter.delete('/routes/:id/stops/:stopId', requirePermission('transport:write'), ctrl.deleteRouteStop);
