/**
 * Payroll router — salary structures, payslips, payroll run.
 * Literal paths (run) declared BEFORE /:id so Express resolves them first.
 * Multi-tenant: all service functions scoped to actor.schoolId.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createStructureSchema,
  updateStructureSchema,
  listStructuresQuerySchema,
  listPayslipsQuerySchema,
  runPayrollSchema,
} from './payroll.schema.js';
import * as ctrl from './payroll.controller.js';

export const payrollRouter = Router();
payrollRouter.use(authenticate);

// ── Salary Structures ─────────────────────────────────────────────────────
payrollRouter.get('/structures', requirePermission('payroll:read'), validate(listStructuresQuerySchema, 'query'), ctrl.listStructures);
payrollRouter.post('/structures', requirePermission('payroll:manage'), validate(createStructureSchema), ctrl.createStructure);
// Literal /structures/:id after /structures list
payrollRouter.get('/structures/:id', requirePermission('payroll:read'), ctrl.getStructure);
payrollRouter.patch('/structures/:id', requirePermission('payroll:manage'), validate(updateStructureSchema), ctrl.updateStructure);

// ── Payslips — literal paths before /:id ─────────────────────────────────
payrollRouter.get('/payslips', requirePermission('payroll:read'), validate(listPayslipsQuerySchema, 'query'), ctrl.listPayslips);

// POST /payroll/run — literal path declared before /payslips/:id
payrollRouter.post('/run', requirePermission('payroll:run'), validate(runPayrollSchema), ctrl.runPayroll);

payrollRouter.get('/payslips/:id', requirePermission('payroll:read'), ctrl.getPayslip);
// /payslips/:id/slip — same data, confirms status (for print view)
payrollRouter.get('/payslips/:id/slip', requirePermission('payroll:read'), ctrl.getPayslip);
payrollRouter.get('/payslips/:id/pdf', requirePermission('payroll:read'), ctrl.getPayslipPdf);
payrollRouter.patch('/payslips/:id/approve', requirePermission('payroll:run'), ctrl.approvePayslip);
payrollRouter.patch('/payslips/:id/finalize', requirePermission('payroll:run'), ctrl.finalizePayslip);
