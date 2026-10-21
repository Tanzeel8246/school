import { query } from '../../config/db.js';
import { notFound } from '../../utils/http-error.js';
import type { AccessClaims } from '../../utils/jwt.js';

export async function listPlans() {
  const { rows } = await query(
    `SELECT id, name, fee, billing_cycle, max_students, max_teachers, features 
     FROM subscription_plans 
     WHERE is_active = true 
     ORDER BY fee ASC`
  );
  return rows;
}

export async function requestSubscription(actor: AccessClaims, planId: string, transactionId: string, screenshotUrl: string) {
  const { rows: planRows } = await query(`SELECT id FROM subscription_plans WHERE id = $1`, [planId]);
  if (planRows.length === 0) throw notFound('Plan not found');

  const { rows } = await query(
    `INSERT INTO subscription_requests (school_id, user_id, plan_id, transaction_id, payment_screenshot_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [actor.schoolId, actor.sub, planId, transactionId, screenshotUrl]
  );
  
  return rows[0];
}

export async function getMyRequests(actor: AccessClaims) {
  const { rows } = await query(
    `SELECT sr.id, sr.status, sr.transaction_id, sr.screenshot_url, sr.created_at, sp.name as plan_name, sp.billing_cycle
     FROM subscription_requests sr
     JOIN subscription_plans sp ON sr.plan_id = sp.id
     WHERE sr.school_id = $1
     ORDER BY sr.created_at DESC`,
    [actor.schoolId]
  );
  return rows;
}

export async function listAllRequests() {
  const { rows } = await query(
    `SELECT sr.id, sr.status, sr.transaction_id, sr.screenshot_url, sr.created_at, 
            sp.name as plan_name, sp.billing_cycle, s.name as school_name, u.full_name as requested_by_name
     FROM subscription_requests sr
     JOIN subscription_plans sp ON sr.plan_id = sp.id
     JOIN schools s ON sr.school_id = s.id
     LEFT JOIN users u ON sr.requested_by = u.id
     ORDER BY sr.created_at DESC`
  );
  return rows;
}

export async function approveRequest(requestId: string, notes?: string) {
  const { rows } = await query(
    `UPDATE subscription_requests 
     SET status = 'approved', admin_notes = $2, updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, school_id, plan_id`,
    [requestId, notes]
  );
  if (rows.length === 0) throw notFound('Pending request not found');

  const req = rows[0];
  await query(
    `UPDATE schools SET plan_id = $1, subscription_status = 'active' WHERE id = $2`,
    [req.plan_id, req.school_id]
  );

  return { success: true };
}

export async function rejectRequest(requestId: string, notes?: string) {
  const { rows } = await query(
    `UPDATE subscription_requests 
     SET status = 'rejected', admin_notes = $2, updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id`,
    [requestId, notes]
  );
  if (rows.length === 0) throw notFound('Pending request not found');
  return { success: true };
}
