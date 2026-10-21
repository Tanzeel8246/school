import { z } from 'zod';

const dateOrEmpty = z.string().date().optional().catch(undefined);
const uuidOrEmpty = z.string().uuid().optional().catch(undefined);
const urlOrEmpty = z.string().url().max(500).optional().catch(undefined);

const usernameOrEmpty = z.union([z.literal(''), z.string().min(3)]).transform(v => v === '' ? undefined : v).optional();
const passwordOrEmpty = z.union([z.literal(''), z.string().min(6)]).transform(v => v === '' ? undefined : v).optional();

export const listQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'suspended', 'transferred', 'left', 'alumni']).optional(),
  sectionId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const createStudentSchema = z.object({
  admissionNo: z.string().min(1),
  rollNo: z.string().optional(),
  fullName: z.string().min(2),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  cnicBform: z.string().optional(),
  dob: dateOrEmpty,
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodGroup: z.string().optional(),
  religion: z.string().optional(),
  address: z.string().optional(),
  mobile: z.string().optional(),
  emergencyContact: z.string().optional(),
  previousSchool: z.string().optional(),
  sectionId: uuidOrEmpty,
  admissionDate: dateOrEmpty,
  createUser: z.boolean().optional(),
  username: usernameOrEmpty,
  password: passwordOrEmpty,
  parentMode: z.enum(['none', 'new', 'existing']).optional(),
  parentFullName: z.string().optional(),
  parentRelation: z.string().optional(),
  parentCnic: z.string().optional(),
  parentPhone: z.string().optional(),
  parentUsername: usernameOrEmpty,
  parentPassword: passwordOrEmpty,
  existingGuardianId: uuidOrEmpty,
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

/** Partial update — at least one field required (mirrors schools.updateSchema). */
export const updateStudentSchema = z
  .object({
    rollNo: z.string().optional(),
    fullName: z.string().min(2).optional(),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    cnicBform: z.string().optional(),
    dob: dateOrEmpty,
    gender: z.enum(['male', 'female', 'other']).optional(),
    bloodGroup: z.string().optional(),
    religion: z.string().optional(),
    address: z.string().optional(),
    mobile: z.string().optional(),
    emergencyContact: z.string().optional(),
    previousSchool: z.string().optional(),
    sectionId: uuidOrEmpty,
    photoUrl: urlOrEmpty,
    createUser: z.boolean().optional(),
    username: usernameOrEmpty,
    password: passwordOrEmpty,
    parentMode: z.enum(['none', 'new', 'existing']).optional(),
    parentFullName: z.string().optional(),
    parentRelation: z.string().optional(),
    parentCnic: z.string().optional(),
    parentPhone: z.string().optional(),
    parentUsername: usernameOrEmpty,
    parentPassword: passwordOrEmpty,
    existingGuardianId: uuidOrEmpty,
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

/** Promote a student to another section (logs a history row). */
export const promoteStudentSchema = z.object({
  sectionId: z.string().uuid(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6),
});
export type PromoteStudentInput = z.infer<typeof promoteStudentSchema>;

/** Optional reason used by transfer/suspend lifecycle endpoints. */
export const reasonSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type ReasonInput = z.infer<typeof reasonSchema>;
