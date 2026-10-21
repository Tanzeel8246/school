/**
 * Reports controller — single entry point for all five report types.
 * JSON preview and file export (PDF/XLSX/CSV) share the same /:type route;
 * the `format` query param determines the response shape.
 * No audit needed for read-only report requests.
 */
import type { Request, Response, NextFunction } from 'express';
import { badRequest } from '../../utils/http-error.js';
import { reportTypeSchema } from './reports.schema.js';
import type { ReportQuery } from './reports.schema.js';
import {
  getStudentsReport,
  getAttendanceReport,
  getFeesReport,
  getPayrollReport,
  getAccountingReport,
} from './reports.service.js';
import { exportCsv, exportExcel, exportPdf } from './reports.export.js';

// Human-readable title for file headers / PDF cover.
const REPORT_TITLES: Record<string, string> = {
  students:   'Students Report',
  attendance: 'Attendance Report',
  fees:       'Fees Report',
  payroll:    'Payroll Report',
  accounting: 'Accounting Report',
};

export async function getReport(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Validate report type (must be one of the five known types).
    const typeParse = reportTypeSchema.safeParse(req.params.type);
    if (!typeParse.success) {
      throw badRequest(
        `Unknown report type '${req.params.type}'. Must be one of: students, attendance, fees, payroll, accounting`,
      );
    }
    const reportType = typeParse.data;

    // 2. Validated query is already coerced by validate() middleware.
    const q = req.query as unknown as ReportQuery;

    // 3. Dispatch to the appropriate service function (all tenant-scoped by actor.schoolId).
    let result: { data: unknown[]; meta?: object; summary: object };

    switch (reportType) {
      case 'students':
        result = await getStudentsReport(req.user!, q);
        break;
      case 'attendance':
        result = await getAttendanceReport(req.user!, q);
        break;
      case 'fees':
        result = await getFeesReport(req.user!, q as any);
        break;
      case 'payroll':
        result = await getPayrollReport(req.user!, q);
        break;
      case 'accounting':
        // Accounting returns no pagination meta.
        result = await getAccountingReport(req.user!, q);
        break;
    }

    const title = REPORT_TITLES[reportType] ?? reportType;

    // 4. Export branch — stream file if format param is present.
    if (q.format === 'csv') {
      await exportCsv(res, reportType, result.data, result.summary, title);
      return;
    }
    if (q.format === 'xlsx') {
      await exportExcel(res, reportType, result.data, result.summary, title);
      return;
    }
    if (q.format === 'pdf') {
      await exportPdf(res, reportType, result.data, result.summary, title);
      return;
    }

    // 5. Default: JSON preview with { data, meta?, summary } envelope.
    res.json(result);
  } catch (e) {
    next(e);
  }
}
