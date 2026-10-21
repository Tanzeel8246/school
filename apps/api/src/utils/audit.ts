import type { Request } from 'express';
import { query } from '../config/db.js';

/** Append-only audit trail (blueprint §3 / §10.18). Never throws into the request path. */
export async function audit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
) {
  try {
    const actor = req.user;
    await query(
      `INSERT INTO audit_logs
         (school_id, actor_id, action, entity_type, entity_id, before, after, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        actor?.schoolId ?? null,
        actor?.sub ?? null,
        action,
        entityType,
        entityId,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        req.ip,
        req.get('user-agent') ?? null,
      ],
    );
  } catch (err) {
    // Audit failures must not break the business action; log and move on.
    console.error('audit write failed', err);
  }
}
