import { z } from 'zod';


const usernameOrEmpty = z.string().min(3).optional().catch(undefined);
const passwordOrEmpty = z.string().min(6).optional().catch(undefined);

/** Pagination + free-text search over teaching staff (tenant-scoped). */
export const listQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/** Create a teacher (staff_type='teacher'). Money is BIGINT minor units. */
export const createTeacherSchema = z.object({
  employeeId: z.string().min(1).max(40),
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(160).optional().catch(undefined),
  phone: z.string().max(40).optional(),
  cnic: z.string().max(40).optional(),
  gender: z.string().max(20).optional(),
  qualification: z.string().max(160).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  designation: z.string().max(80).optional(),
  baseSalary: z.coerce.number().int().min(0).optional(),
  joiningDate: z.string().date().optional().catch(undefined),
  subjectIds: z.array(z.string().uuid()).optional(),
  createUser: z.boolean().optional(),
  username: usernameOrEmpty,
  password: passwordOrEmpty,
});
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

/** Partial update of a teacher — at least one field required. */
export const updateTeacherSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    email: z.string().email().max(160).optional().catch(undefined),
    phone: z.string().max(40).optional(),
    cnic: z.string().max(40).optional(),
    gender: z.string().max(20).optional(),
    qualification: z.string().max(160).optional(),
    experienceYears: z.coerce.number().int().min(0).max(80).optional(),
    designation: z.string().max(80).optional(),
    baseSalary: z.coerce.number().int().min(0).optional(),
    joiningDate: z.string().date().optional().catch(undefined),
    status: z.string().max(20).optional(),
    createUser: z.boolean().optional(),
    username: usernameOrEmpty,
    password: passwordOrEmpty,
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;

/** Replace the full subject-assignment set for a teacher. */
export const setSubjectsSchema = z.object({
  subjectIds: z.array(z.string().uuid()),
});
export type SetSubjectsInput = z.infer<typeof setSubjectsSchema>;
