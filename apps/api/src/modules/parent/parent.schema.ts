import { z } from 'zod';

export const attendanceQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

export const feesQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type FeesQuery = z.infer<typeof feesQuerySchema>;

export const resultsQuerySchema = z.object({
  examId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ResultsQuery = z.infer<typeof resultsQuerySchema>;

export const studentParamSchema = z.object({
  studentId: z.string().uuid(),
});

export const changePasswordSchema = z.object({
  password: z.string().min(6),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

