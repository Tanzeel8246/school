import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './payroll.service.js';
import { exportPdf } from '../reports/reports.export.js';

// ── Salary Structures ─────────────────────────────────────────────────────

export async function listStructures(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listStructures(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createStructure(req: Request, res: Response, next: NextFunction) {
  try {
    const structure = await service.createStructure(req.user!, req.body);
    await audit(req, 'payroll.structure.create', 'salary_structure', structure.id, null, structure);
    res.status(201).json({ data: structure });
  } catch (e) { next(e); }
}

export async function getStructure(req: Request, res: Response, next: NextFunction) {
  try {
    const structure = await service.getStructureById(req.user!, req.params.id);
    res.json({ data: structure });
  } catch (e) { next(e); }
}

export async function updateStructure(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateStructure(req.user!, req.params.id, req.body);
    await audit(req, 'payroll.structure.update', 'salary_structure', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

// ── Payslips ──────────────────────────────────────────────────────────────

export async function listPayslips(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listPayslips(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getPayslip(req: Request, res: Response, next: NextFunction) {
  try {
    const payslip = await service.getPayslipById(req.user!, req.params.id);
    res.json({ data: payslip });
  } catch (e) { next(e); }
}

export async function approvePayslip(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.approvePayslip(req.user!, req.params.id);
    await audit(req, 'payroll.payslip.approve', 'payslip', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function finalizePayslip(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.finalizePayslip(req.user!, req.params.id);
    await audit(req, 'payroll.payslip.finalize', 'payslip', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function getPayslipPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const payslip = await service.getPayslipById(req.user!, req.params.id);
    
    // Format the data for PDF
    const data = payslip.components?.map(c => ({
      Component: c.name,
      Type: c.componentType,
      Amount: (c.amount / 100).toFixed(2)
    })) || [];

    const summary = {
      'Staff Name': payslip.staffName,
      'Period': payslip.periodMonth,
      'Base Salary': (payslip.baseSalary / 100).toFixed(2),
      'Allowances': (payslip.allowances / 100).toFixed(2),
      'Deductions': (payslip.deductions / 100).toFixed(2),
      'Net Salary': (payslip.netSalary / 100).toFixed(2),
      'Status': payslip.status.toUpperCase()
    };

    await exportPdf(res, `payslip-${payslip.id}`, data, summary, `Payslip - ${payslip.staffName}`);
  } catch (e) { next(e); }
}

// ── Payroll Run ───────────────────────────────────────────────────────────

export async function runPayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.runPayroll(req.user!, req.body);
    await audit(req, 'payroll.run', 'payslip', null, null, result);
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
}
