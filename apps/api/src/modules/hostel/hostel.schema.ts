import { z } from 'zod';

// ── Hostels ────────────────────────────────────────────────────────────────

export const createHostelSchema = z.object({
  name:          z.string().min(1).max(150),
  hostelType:    z.enum(['boys', 'girls', 'mixed']).optional().default('boys'),
  address:       z.string().optional(),
  wardenId:      z.string().uuid().optional(),
  totalCapacity: z.number().int().nonnegative().optional().default(0),
});
export type CreateHostelInput = z.infer<typeof createHostelSchema>;

export const updateHostelSchema = createHostelSchema.partial();
export type UpdateHostelInput = z.infer<typeof updateHostelSchema>;

export const listHostelsQuerySchema = z.object({
  q:     z.string().optional(),
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
});
export type ListHostelsQuery = z.infer<typeof listHostelsQuerySchema>;

// ── Rooms ──────────────────────────────────────────────────────────────────

export const createHostelRoomSchema = z.object({
  roomNo:     z.string().min(1).max(20),
  roomType:   z.enum(['single', 'double', 'triple', 'dormitory']).optional().default('double'),
  floor:      z.number().int().nonnegative().optional().default(0),
  capacity:   z.number().int().positive().optional().default(2),
  monthlyFee: z.number().int().nonnegative().optional().default(0),
  isActive:   z.boolean().optional().default(true),
});
export type CreateHostelRoomInput = z.infer<typeof createHostelRoomSchema>;

export const updateHostelRoomSchema = createHostelRoomSchema.partial();
export type UpdateHostelRoomInput = z.infer<typeof updateHostelRoomSchema>;

export const listHostelRoomsQuerySchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
});
export type ListHostelRoomsQuery = z.infer<typeof listHostelRoomsQuerySchema>;

// ── Allocations ────────────────────────────────────────────────────────────

export const createHostelAllocationSchema = z.object({
  studentId:     z.string().uuid(),
  hostelId:      z.string().uuid(),
  roomId:        z.string().uuid(),
  bedNo:         z.string().optional(),
  allocatedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  allocatedTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  monthlyFee:    z.number().int().nonnegative().optional().default(0),
  notes:         z.string().optional(),
});
export type CreateHostelAllocationInput = z.infer<typeof createHostelAllocationSchema>;

export const vacateAllocationSchema = z.object({
  notes: z.string().optional(),
});
export type VacateAllocationInput = z.infer<typeof vacateAllocationSchema>;

export const listAllocationsQuerySchema = z.object({
  hostelId: z.string().uuid().optional(),
  roomId:   z.string().uuid().optional(),
  status:   z.enum(['active', 'vacated', 'expired']).optional(),
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(1000).default(20),
});
export type ListAllocationsQuery = z.infer<typeof listAllocationsQuerySchema>;

// ── Mess Menu ──────────────────────────────────────────────────────────────

export const messMenuItemSchema = z.object({
  dayOfWeek:  z.number().int().min(1).max(7),
  mealType:   z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  menuItems:  z.string().min(1),
});

export const upsertMessMenuSchema = z.object({
  hostelId: z.string().uuid(),
  menu:     z.array(messMenuItemSchema).min(1),
});
export type UpsertMessMenuInput = z.infer<typeof upsertMessMenuSchema>;

export const getMessMenuQuerySchema = z.object({
  hostelId: z.string().uuid(),
});
