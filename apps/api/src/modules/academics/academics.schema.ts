import { z } from 'zod';

// ── Sessions ──────────────────────────────────────────────────────────────

export const listSessionsQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

export const createSessionSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().date(),
  endDate: z.string().date(),
  isActive: z.boolean().optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

// ── Classes ───────────────────────────────────────────────────────────────

export const listClassesQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;

export const createClassSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().min(1).max(100),
  level: z.number().int().min(0).max(20),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const updateClassSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    level: z.number().int().min(0).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateClassInput = z.infer<typeof updateClassSchema>;

// ── Sections ──────────────────────────────────────────────────────────────

export const listSectionsQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListSectionsQuery = z.infer<typeof listSectionsQuerySchema>;

export const createSectionSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(500).optional(),
  teacherId: z.string().uuid().optional(),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const updateSectionSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    teacherId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

// ── Subjects ──────────────────────────────────────────────────────────────

export const listSubjectsQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;

export const createSubjectSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  isElective: z.boolean().optional(),
});
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().max(20).nullable().optional(),
    isElective: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;

// ── Timetable ─────────────────────────────────────────────────────────────

export const listTimetableQuerySchema = z.object({
  sectionId: z.string().uuid().optional(),
});

export const createTimetableSlotSchema = z.object({
  sectionId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  period: z.number().int().min(1).max(10),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
});
export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;

export const updateTimetableSlotSchema = z
  .object({
    subjectId: z.string().uuid().optional(),
    teacherId: z.string().uuid().optional(),
    weekday: z.number().int().min(1).max(7).optional(),
    period: z.number().int().min(1).max(10).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM').optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM').optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateTimetableSlotInput = z.infer<typeof updateTimetableSlotSchema>;
