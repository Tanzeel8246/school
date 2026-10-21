import { z } from 'zod';

// ── Vehicles ───────────────────────────────────────────────────────────────

export const createVehicleSchema = z.object({
  regNo:       z.string().min(1).max(50),
  vehicleType: z.enum(['bus', 'van', 'car', 'minibus']).optional().default('bus'),
  make:        z.string().optional(),
  model:       z.string().optional(),
  capacity:    z.number().int().positive().optional().default(40),
  driverId:    z.string().uuid().optional(),
  isActive:    z.boolean().optional().default(true),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema.partial();
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const listVehiclesQuerySchema = z.object({
  q:        z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(1000).default(20),
});
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;

// ── Routes ─────────────────────────────────────────────────────────────────

export const createRouteSchema = z.object({
  name:        z.string().min(1).max(150),
  description: z.string().optional(),
  vehicleId:   z.string().uuid().optional(),
  monthlyFee:  z.number().int().nonnegative().optional().default(0),
  isActive:    z.boolean().optional().default(true),
});
export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const updateRouteSchema = createRouteSchema.partial();
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;

export const listRoutesQuerySchema = z.object({
  q:        z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(1000).default(20),
});
export type ListRoutesQuery = z.infer<typeof listRoutesQuerySchema>;

// ── Stops ──────────────────────────────────────────────────────────────────

export const createRouteStopSchema = z.object({
  name:        z.string().min(1).max(150),
  stopOrder:   z.number().int().nonnegative().optional().default(1),
  pickupTime:  z.string().optional(),   // HH:MM
  dropTime:    z.string().optional(),   // HH:MM
});
export type CreateRouteStopInput = z.infer<typeof createRouteStopSchema>;

// ── Student Transport ──────────────────────────────────────────────────────

export const createStudentTransportSchema = z.object({
  studentId:  z.string().uuid(),
  routeId:    z.string().uuid(),
  stopId:     z.string().uuid().optional(),
  validFrom:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  validTo:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CreateStudentTransportInput = z.infer<typeof createStudentTransportSchema>;

export const listStudentTransportQuerySchema = z.object({
  routeId:  z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(1000).default(20),
});
export type ListStudentTransportQuery = z.infer<typeof listStudentTransportQuerySchema>;
