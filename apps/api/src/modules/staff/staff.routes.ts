import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listStaffQuerySchema,
  createStaffSchema,
  updateStaffSchema,
  attendanceQuerySchema,
  markAttendanceSchema,
  listLeavesQuerySchema,
  createLeaveSchema,
  rejectLeaveSchema,
  payslipsQuerySchema,
  runPayrollSchema,
} from './staff.schema.js';
import * as ctrl from './staff.controller.js';

export const staffRouter = Router();
staffRouter.use(authenticate);

// IMPORTANT: literal paths (/leaves, /payslips, /payroll/run) are declared BEFORE
// '/:id' so Express does not capture them as the :id param.

// ---------- Leaves ----------
staffRouter.get('/leaves', requirePermission('leaves:read'), validate(listLeavesQuerySchema, 'query'), ctrl.listLeaves);
staffRouter.post('/leaves', requirePermission('staff:write'), validate(createLeaveSchema), ctrl.createLeave);
staffRouter.patch('/leaves/:id/approve', requirePermission('leaves:manage'), ctrl.approveLeave);
staffRouter.patch(
  '/leaves/:id/reject',
  requirePermission('leaves:manage'),
  validate(rejectLeaveSchema),
  ctrl.rejectLeave,
);

// ---------- Payroll ----------
staffRouter.get('/payslips', requirePermission('payroll:read'), validate(payslipsQuerySchema, 'query'), ctrl.listPayslips);
staffRouter.post('/payroll/run', requirePermission('payroll:run'), validate(runPayrollSchema), ctrl.runPayroll);

// ---------- Staff CRUD ----------
staffRouter.get('/', requirePermission('staff:read'), validate(listStaffQuerySchema, 'query'), ctrl.list);
staffRouter.post('/', requirePermission('staff:write'), validate(createStaffSchema), ctrl.create);
staffRouter.get('/:id', requirePermission('staff:read'), ctrl.getById);
staffRouter.patch('/:id', requirePermission('staff:write'), validate(updateStaffSchema), ctrl.update);
staffRouter.delete('/:id', requirePermission('staff:write'), ctrl.remove);

// ---------- Per-staff attendance + payroll ----------
staffRouter.get(
  '/:id/attendance',
  requirePermission('staff:read'),
  validate(attendanceQuerySchema, 'query'),
  ctrl.listAttendance,
);
staffRouter.post(
  '/:id/attendance',
  requirePermission('staff_attendance:mark'),
  validate(markAttendanceSchema),
  ctrl.markAttendance,
);
staffRouter.get('/:id/payroll', requirePermission('payroll:read'), ctrl.getStaffPayroll);
