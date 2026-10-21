import { z } from 'zod';

const usernameOrEmpty = z.string().min(3).optional().catch(undefined);
const passwordOrEmpty = z.string().min(6).optional().catch(undefined);

// ---------- Staff CRUD ----------
export const listStaffQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  staffType: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;

export const createStaffSchema = z.object({
  employeeId: z.string().min(1).max(40),
  staffType: z.string().min(1).max(40),
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(160).optional().catch(undefined),
  phone: z.string().max(40).optional(),
  cnic: z.string().max(40).optional(),
  gender: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  qualification: z.string().max(160).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  designation: z.string().max(80).optional(),
  baseSalary: z.coerce.number().int().min(0).optional(),
  joiningDate: z.string().date().optional().catch(undefined),
  createUser: z.boolean().optional(),
  username: usernameOrEmpty,
  password: passwordOrEmpty,
  subjectIds: z.array(z.string().uuid()).optional(),
  inchargeSectionId: z.string().uuid().optional().nullable(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z
  .object({
    staffType: z.string().min(1).max(40).optional(),
    fullName: z.string().min(2).max(120).optional(),
    email: z.string().email().max(160).optional().catch(undefined),
    phone: z.string().max(40).optional(),
    cnic: z.string().max(40).optional(),
    gender: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
    qualification: z.string().max(160).optional(),
    experienceYears: z.coerce.number().int().min(0).max(80).optional(),
    designation: z.string().max(80).optional(),
    baseSalary: z.coerce.number().int().min(0).optional(),
    joiningDate: z.string().date().optional().catch(undefined),
    leavingDate: z.string().date().optional().catch(undefined),
    status: z.string().max(20).optional(),
    createUser: z.boolean().optional(),
    username: usernameOrEmpty,
    password: passwordOrEmpty,
    subjectIds: z.array(z.string().uuid()).optional(),
    inchargeSectionId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

// ---------- Attendance ----------
export const attendanceQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

export const markAttendanceSchema = z.object({
  date: z.string().date(),
  status: z.enum(['present', 'absent', 'leave', 'late', 'half_day']),
  checkIn: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  checkOut: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

// ---------- Leaves ----------
export const listLeavesQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  staffId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListLeavesQuery = z.infer<typeof listLeavesQuerySchema>;

export const createLeaveSchema = z.object({
  staffId: z.string().uuid(),
  leaveType: z.string().min(1).max(40),
  fromDate: z.string().date(),
  toDate: z.string().date(),
  reason: z.string().max(500).optional(),
});
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;

export const rejectLeaveSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>;

// ---------- Payroll ----------
export const payslipsQuerySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  staffId: z.string().uuid().optional(),
});
export type PayslipsQuery = z.infer<typeof payslipsQuerySchema>;

export const runPayrollSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM'),
  allowances: z.coerce.number().int().min(0).optional(),
  deductions: z.coerce.number().int().min(0).optional(),
});
export type RunPayrollInput = z.infer<typeof runPayrollSchema>;
