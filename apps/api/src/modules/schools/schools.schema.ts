import { z } from 'zod';

const urlOrEmpty = z.union([z.string().url().max(500), z.literal('')]).optional().transform(v => v === '' ? undefined : v);
const stringOrEmpty = z.union([z.string().min(1).max(60), z.literal('')]).optional().transform(v => v === '' ? undefined : v);

/** Pagination + free-text search for the schools listing (super_admin only). */
export const listSchoolsQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListSchoolsQuery = z.infer<typeof listSchoolsQuerySchema>;

/** Create a new tenant (also seeds its default roles). */
export const createSchoolSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().trim().min(2).max(40),
  address: z.string().max(500).optional(),
  timezone: stringOrEmpty,
  logoUrl: urlOrEmpty,
});
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

/**
 * Partial update of an existing tenant. At least one field must be supplied.
 * Powers both PATCH /schools/:id and the self-service PATCH /schools/current
 * "School setup form".
 */
export const updateSchoolSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    address: z.string().max(500).optional(),
    timezone: stringOrEmpty,
    logoUrl: urlOrEmpty,
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
