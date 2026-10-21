import { z } from 'zod';

const attendanceStatus = z.enum(['present', 'absent', 'late', 'leave', 'half_day']);
const attendanceMethod = z.enum(['manual', 'qr', 'rfid', 'biometric']);

export const bulkMarkSchema = z.object({
  date: z.string().date(),
  method: attendanceMethod,
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: attendanceStatus,
      }),
    )
    .min(1)
    .max(200),
});
export type BulkMarkInput = z.infer<typeof bulkMarkSchema>;

export const singleMarkSchema = z.object({
  date: z.string().date(),
  status: attendanceStatus,
  method: attendanceMethod.optional(),
});
export type SingleMarkInput = z.infer<typeof singleMarkSchema>;

export const sectionAttendanceQuerySchema = z.object({
  date: z.string().date().optional(),
});

export const reportQuerySchema = z.object({
  sectionId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  status: z.string().optional(),
});

export const summaryQuerySchema = z.object({
  date: z.string().date().optional(),
});
