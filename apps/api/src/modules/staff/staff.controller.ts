import type { Request, Response, NextFunction } from 'express';
import * as service from './staff.service.js';
import { audit } from '../../utils/audit.js';

// ---------- Staff CRUD ----------
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.list(req.user!, req.query as never));
  } catch (e) {
    next(e);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getById(req.user!, req.params.id) });
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await service.create(req.user!, req.body);
    await audit(req, 'staff.create', 'staff', staff.id, null, staff);
    res.status(201).json({ data: staff });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.update(req.user!, req.params.id, req.body);
    await audit(req, 'staff.update', 'staff', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await service.softDelete(req.user!, req.params.id);
    await audit(req, 'staff.delete', 'staff', staff.id, staff, null);
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
}

// ---------- Attendance ----------
export async function listAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.listAttendance(req.user!, req.params.id, req.query as never) });
  } catch (e) {
    next(e);
  }
}

export async function markAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const mark = await service.markAttendance(req.user!, req.params.id, req.body);
    await audit(req, 'staff.attendance.mark', 'staff_attendance', mark.id, null, mark);
    res.status(201).json({ data: mark });
  } catch (e) {
    next(e);
  }
}

// ---------- Leaves ----------
export async function listLeaves(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listLeaves(req.user!, req.query as never));
  } catch (e) {
    next(e);
  }
}

export async function createLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const leave = await service.createLeave(req.user!, req.body);
    await audit(req, 'staff.leave.create', 'staff_leave', leave.id, null, leave);
    res.status(201).json({ data: leave });
  } catch (e) {
    next(e);
  }
}

export async function approveLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.approveLeave(req.user!, req.params.id);
    await audit(req, 'staff.leave.approve', 'staff_leave', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

export async function rejectLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.rejectLeave(req.user!, req.params.id, req.body?.reason);
    await audit(req, 'staff.leave.reject', 'staff_leave', after.id, before, after);
    res.json({ data: after });
  } catch (e) {
    next(e);
  }
}

// ---------- Payroll ----------
export async function listPayslips(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.listPayslips(req.user!, req.query as never) });
  } catch (e) {
    next(e);
  }
}

export async function runPayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.runPayroll(req.user!, req.body);
    await audit(req, 'staff.payroll.run', 'payslip', null, null, { period: req.body.period, ...result });
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

export async function getStaffPayroll(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getStaffPayroll(req.user!, req.params.id) });
  } catch (e) {
    next(e);
  }
}
