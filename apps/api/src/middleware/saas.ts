import type { Request, Response, NextFunction } from 'express';
import { query } from '../config/db.js';
import { forbidden } from '../utils/http-error.js';

/**
 * Middleware to enforce SaaS subscription limits before creating entities.
 * (Phase 2: Usage Limits & Core Restrictions).
 */
export function enforceUsageLimit(entityType: 'students' | 'teachers') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        return next(forbidden('No school context found.'));
      }

      // 1. Get the school's plan limits
      const { rows: planRows } = await query(
        `SELECT sp.max_students, sp.max_teachers 
         FROM schools s
         JOIN subscription_plans sp ON s.plan_id = sp.id
         WHERE s.id = $1`,
        [schoolId]
      );

      if (planRows.length === 0) {
        return next(forbidden('Subscription plan not found. Please upgrade your plan.'));
      }

      const plan = planRows[0];
      const maxAllowed = entityType === 'students' ? plan.max_students : plan.max_teachers;

      // If maxAllowed is null, it means unlimited (e.g. Enterprise plan).
      if (maxAllowed === null) {
        return next();
      }

      // 2. Count existing active records
      
      let countQuery = '';
      if (entityType === 'students') {
        countQuery = `SELECT count(*) as total FROM students WHERE school_id = $1 AND deleted_at IS NULL`;
      } else if (entityType === 'teachers') {
        // Teachers are stored in users table with role 'teacher'
        countQuery = `SELECT count(*) as total FROM users u
                      JOIN roles r ON u.role_id = r.id
                      WHERE u.school_id = $1 AND r.name = 'teacher' AND u.deleted_at IS NULL`;
      }

      const { rows: countRows } = await query(countQuery, [schoolId]);
      const currentCount = parseInt(countRows[0].total, 10);

      if (currentCount >= maxAllowed) {
        return next(
          forbidden(
            `You have reached the limit of ${maxAllowed} ${entityType} for your current subscription plan. Please upgrade to add more.`
          )
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
