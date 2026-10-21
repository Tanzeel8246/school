/**
 * Communications service — multi-tenant, all queries scoped to actor.schoolId.
 * Providers (SMS/WhatsApp/Email) are dynamically imported so the system boots
 * gracefully when provider env vars are absent (blueprint §3 — async dispatch).
 * message_logs is append-only and never hard-deleted (audit trail).
 */
import { query, withTransaction } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound } from '../../utils/http-error.js';
import type {
  ListLogsQuery,
  ListAnnouncementsQuery,
  ListTemplatesQuery,
  CreateTemplateInput,
  UpdateTemplateInput,
  SendMessageInput,
  CreateAnnouncementInput,
  PutNotificationSettingsInput,
} from './communications.schema.js';

// ── Row types ──────────────────────────────────────────────────────────────

interface TemplateRow {
  id: string;
  school_id: string;
  name: string;
  event_type: string;
  channel: string;
  subject: string | null;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface SettingRow {
  event_type: string;
  channel: string;
  is_enabled: boolean;
}

interface AnnouncementRow {
  id: string;
  school_id: string;
  title: string;
  message: string;
  channels: string[];
  target_type: string;
  target_id: string | null;
  status: string;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
}

interface MessageLogRow {
  id: string;
  school_id: string;
  announcement_id: string | null;
  channel: string;
  event_type: string;
  recipient_id: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  subject: string | null;
  body: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface RecipientRow {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
}

// ── DTO mappers (snake_case row → camelCase DTO) ───────────────────────────

const toTemplateDto = (r: TemplateRow) => ({
  id:        r.id,
  schoolId:  r.school_id,
  name:      r.name,
  eventType: r.event_type,
  channel:   r.channel,
  subject:   r.subject ?? undefined,
  body:      r.body,
  isDefault: r.is_default,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toSettingDto = (r: SettingRow) => ({
  eventType: r.event_type,
  channel:   r.channel,
  isEnabled: r.is_enabled,
});

const toAnnouncementDto = (r: AnnouncementRow) => ({
  id:          r.id,
  schoolId:    r.school_id,
  title:       r.title,
  message:     r.message,
  channels:    r.channels,
  targetType:  r.target_type,
  targetId:    r.target_id ?? undefined,
  status:      r.status,
  sentCount:   Number(r.sent_count),
  failedCount: Number(r.failed_count),
  createdBy:   r.created_by ?? undefined,
  createdAt:   r.created_at,
  scheduledAt: r.scheduled_at ?? undefined,
  sentAt:      r.sent_at ?? undefined,
});

const toLogDto = (r: MessageLogRow) => ({
  id:                r.id,
  schoolId:          r.school_id,
  announcementId:    r.announcement_id ?? undefined,
  channel:           r.channel,
  eventType:         r.event_type,
  recipientId:       r.recipient_id ?? undefined,
  recipientPhone:    r.recipient_phone ?? undefined,
  recipientEmail:    r.recipient_email ?? undefined,
  subject:           r.subject ?? undefined,
  body:              r.body,
  status:            r.status,
  providerMessageId: r.provider_message_id ?? undefined,
  errorMessage:      r.error_message ?? undefined,
  sentAt:            r.sent_at ?? undefined,
  createdAt:         r.created_at,
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Replace {{key}} placeholders in a template string with provided vars. */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? '');
}

/**
 * Check whether a notification channel is enabled for a given event type.
 * Returns false if no row exists (missing row = disabled by default).
 * Multi-tenant: always scoped to schoolId.
 */
export async function isChannelEnabled(
  schoolId: string,
  eventType: string,
  channel: string,
): Promise<boolean> {
  const { rows } = await query<{ is_enabled: boolean }>(
    `SELECT is_enabled FROM notification_settings
      WHERE school_id = $1 AND event_type = $2 AND channel = $3`,
    [schoolId, eventType, channel],
  );
  return rows[0]?.is_enabled ?? false;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export async function listTemplates(actor: AccessClaims, q: ListTemplatesQuery) {
  const where: string[] = ['school_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.channel) {
    params.push(q.channel);
    where.push(`channel = $${params.length}`);
  }
  if (q.eventType) {
    params.push(q.eventType);
    where.push(`event_type = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset   = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<TemplateRow>(
      `SELECT id, school_id, name, event_type, channel, subject, body, is_default, created_at, updated_at
         FROM message_templates
        WHERE ${whereSql}
        ORDER BY event_type, channel, name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM message_templates WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toTemplateDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createTemplate(actor: AccessClaims, input: CreateTemplateInput) {
  const { rows } = await query<TemplateRow>(
    `INSERT INTO message_templates
       (school_id, name, event_type, channel, subject, body, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, school_id, name, event_type, channel, subject, body, is_default, created_at, updated_at`,
    [
      actor.schoolId, input.name, input.eventType, input.channel,
      input.subject ?? null, input.body, input.isDefault ?? false,
    ],
  );
  return toTemplateDto(rows[0]);
}

export async function updateTemplate(
  actor: AccessClaims,
  id: string,
  input: UpdateTemplateInput,
) {
  const { rows: before } = await query<TemplateRow>(
    `SELECT id, school_id, name, event_type, channel, subject, body, is_default, created_at, updated_at
       FROM message_templates WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Template not found');

  const { rows } = await query<TemplateRow>(
    `UPDATE message_templates
        SET name       = COALESCE($3, name),
            event_type = COALESCE($4, event_type),
            channel    = COALESCE($5, channel),
            subject    = COALESCE($6, subject),
            body       = COALESCE($7, body),
            is_default = COALESCE($8, is_default),
            updated_at = now()
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, name, event_type, channel, subject, body, is_default, created_at, updated_at`,
    [
      id, actor.schoolId,
      input.name ?? null, input.eventType ?? null, input.channel ?? null,
      input.subject ?? null, input.body ?? null, input.isDefault ?? null,
    ],
  );
  return { before: toTemplateDto(before[0]), after: toTemplateDto(rows[0]) };
}

export async function deleteTemplate(actor: AccessClaims, id: string) {
  // Soft-delete; multi-tenant scope enforced via school_id.
  const { rows } = await query<TemplateRow>(
    `UPDATE message_templates SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, name, event_type, channel, subject, body, is_default, created_at, updated_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Template not found');
  return toTemplateDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export async function getNotificationSettings(actor: AccessClaims) {
  // Multi-tenant: all rows for this school.
  const { rows } = await query<SettingRow>(
    `SELECT event_type, channel, is_enabled
       FROM notification_settings
      WHERE school_id = $1
      ORDER BY event_type, channel`,
    [actor.schoolId],
  );
  return rows.map(toSettingDto);
}

export async function putNotificationSettings(
  actor: AccessClaims,
  input: PutNotificationSettingsInput,
) {
  // Upsert each setting in a single transaction. Multi-tenant: school_id enforced.
  await withTransaction(async (client) => {
    for (const s of input.settings) {
      await client.query(
        `INSERT INTO notification_settings (school_id, event_type, channel, is_enabled, updated_at)
         VALUES ($1,$2,$3,$4,now())
         ON CONFLICT (school_id, event_type, channel)
         DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = now()`,
        [actor.schoolId, s.eventType, s.channel, s.isEnabled],
      );
    }
  });
  // Return the full current settings list after upsert.
  return getNotificationSettings(actor);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT SEND (single message)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendMessage(actor: AccessClaims, input: SendMessageInput) {
  // 1. Insert a pending log row (multi-tenant scoped).
  const { rows: logRows } = await query<MessageLogRow>(
    `INSERT INTO message_logs
       (school_id, channel, event_type, recipient_id, recipient_phone, recipient_email,
        subject, body, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
     RETURNING *`,
    [
      actor.schoolId, input.channel, input.eventType ?? 'custom',
      input.recipientId ?? null,
      input.channel !== 'email' ? input.to : null,
      input.channel === 'email' ? input.to : null,
      input.subject ?? null,
      input.body,
    ],
  );
  const logId = logRows[0].id;

  // 2. Dispatch via the appropriate provider (async dispatch pattern).
  let success = false;
  let providerMessageId: string | undefined;
  let errorMessage: string | undefined;

  if (input.channel === 'sms') {
    const { sendSms } = await import('./providers/sms.provider.js');
    const result = await sendSms(input.to, input.body);
    success = result.success;
    providerMessageId = result.sid;
    errorMessage = result.error;
  } else if (input.channel === 'whatsapp') {
    const { sendWhatsApp } = await import('./providers/whatsapp.provider.js');
    const result = await sendWhatsApp(input.to, input.body);
    success = result.success;
    providerMessageId = result.sid;
    errorMessage = result.error;
  } else {
    const { sendEmail } = await import('./providers/email.provider.js');
    const result = await sendEmail(input.to, input.subject ?? '(no subject)', input.body);
    success = result.success;
    providerMessageId = result.messageId;
    errorMessage = result.error;
  }

  // 3. Update the log row with the outcome.
  const { rows: updated } = await query<MessageLogRow>(
    `UPDATE message_logs
        SET status              = $2,
            provider_message_id = $3,
            error_message       = $4,
            sent_at             = CASE WHEN $2 = 'sent' THEN now() ELSE NULL END
      WHERE id = $1
      RETURNING *`,
    [logId, success ? 'sent' : 'failed', providerMessageId ?? null, errorMessage ?? null],
  );

  return toLogDto(updated[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function listAnnouncements(actor: AccessClaims, q: ListAnnouncementsQuery) {
  const where: string[] = ['school_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.status) {
    params.push(q.status);
    where.push(`status = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset   = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<AnnouncementRow>(
      `SELECT id, school_id, title, message, channels, target_type, target_id,
              status, sent_count, failed_count, created_by, created_at, scheduled_at, sent_at
         FROM announcements
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM announcements WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toAnnouncementDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createAnnouncement(actor: AccessClaims, input: CreateAnnouncementInput) {
  // Insert announcement with status='pending'; dispatch is fire-and-forget.
  const { rows } = await query<AnnouncementRow>(
    `INSERT INTO announcements
       (school_id, title, message, channels, target_type, target_id, status, created_by, scheduled_at)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)
     RETURNING id, school_id, title, message, channels, target_type, target_id,
               status, sent_count, failed_count, created_by, created_at, scheduled_at, sent_at`,
    [
      actor.schoolId, input.title, input.message, input.channels,
      input.targetType, input.targetId ?? null,
      actor.sub, input.scheduledAt ?? null,
    ],
  );
  const announcement = rows[0];

  // Enqueue the delivery job — returns immediately so the HTTP response is not blocked.
  // The BullMQ worker (jobs/comms.worker.ts) processes this asynchronously.
  const { commsQueue } = await import('../../queue/comms.queue.js');
  await commsQueue.add('announcement', {
    schoolId: actor.schoolId,
    announcementId: announcement.id,
  });

  return toAnnouncementDto(announcement);
}

/**
 * Resolve recipients, send in batches of 20 (Promise.allSettled), update counts.
 * Exported for the BullMQ worker (jobs/comms.worker.ts) to call directly.
 * Multi-tenant: all queries scoped to schoolId.
 */
export async function dispatchAnnouncementJob(schoolId: string, announcementId: string): Promise<void> {
  // 1. Load the announcement.
  const { rows: annRows } = await query<AnnouncementRow>(
    `SELECT id, school_id, title, message, channels, target_type, target_id
       FROM announcements WHERE id = $1 AND school_id = $2`,
    [announcementId, schoolId],
  );
  const ann = annRows[0];
  if (!ann) return;

  // Mark as sending.
  await query(
    `UPDATE announcements SET status = 'sending' WHERE id = $1`,
    [announcementId],
  );

  // 2. Resolve recipients based on target_type (multi-tenant scoped).
  let recipients: RecipientRow[] = [];
  try {
    if (ann.target_type === 'all_students') {
      const { rows } = await query<RecipientRow>(
        `SELECT u.id, u.email, u.phone, u.full_name
           FROM users u
           JOIN students s ON s.school_id = u.school_id AND u.id IS NOT NULL
          WHERE s.school_id = $1 AND s.deleted_at IS NULL AND u.school_id = $1
            AND u.deleted_at IS NULL AND u.is_active = true
          GROUP BY u.id, u.email, u.phone, u.full_name`,
        [schoolId],
      );
      recipients = rows;
    } else if (ann.target_type === 'all_parents') {
      const { rows } = await query<RecipientRow>(
        `SELECT u.id, u.email, u.phone, u.full_name
           FROM users u
           JOIN guardians g ON g.user_id = u.id
          WHERE g.school_id = $1 AND u.deleted_at IS NULL AND u.is_active = true`,
        [schoolId],
      );
      recipients = rows;
    } else if (ann.target_type === 'all_staff') {
      const { rows } = await query<RecipientRow>(
        `SELECT u.id, u.email, u.phone, u.full_name
           FROM users u
           JOIN staff st ON st.user_id = u.id
          WHERE st.school_id = $1 AND st.deleted_at IS NULL
            AND u.deleted_at IS NULL AND u.is_active = true`,
        [schoolId],
      );
      recipients = rows;
    } else if (ann.target_type === 'class' && ann.target_id) {
      const { rows } = await query<RecipientRow>(
        `SELECT DISTINCT u.id, u.email, u.phone, u.full_name
           FROM users u
           JOIN students s ON s.school_id = u.school_id
           JOIN sections sec ON sec.id = s.section_id
          WHERE sec.class_id = $2 AND s.school_id = $1
            AND s.deleted_at IS NULL AND u.deleted_at IS NULL AND u.is_active = true`,
        [schoolId, ann.target_id],
      );
      recipients = rows;
    } else if (ann.target_type === 'section' && ann.target_id) {
      const { rows } = await query<RecipientRow>(
        `SELECT DISTINCT u.id, u.email, u.phone, u.full_name
           FROM users u
           JOIN students s ON s.section_id = $2 AND s.school_id = $1
          WHERE s.deleted_at IS NULL AND u.school_id = $1
            AND u.deleted_at IS NULL AND u.is_active = true`,
        [schoolId, ann.target_id],
      );
      recipients = rows;
    } else {
      // all_users
      const { rows } = await query<RecipientRow>(
        `SELECT id, email, phone, full_name FROM users
          WHERE school_id = $1 AND deleted_at IS NULL AND is_active = true`,
        [schoolId],
      );
      recipients = rows;
    }
  } catch (err) {
    console.error('dispatchAnnouncement: recipient resolution failed', err);
    await query(
      `UPDATE announcements SET status = 'failed' WHERE id = $1`,
      [announcementId],
    );
    return;
  }

  let sentCount    = 0;
  let failedCount  = 0;
  const channels   = ann.channels as string[];
  const chunkSize  = 20;

  // 3. Build tasks: recipient × channel pairs.
  type SendTask = { recipient: RecipientRow; channel: string };
  const tasks: SendTask[] = [];
  for (const recipient of recipients) {
    for (const channel of channels) {
      tasks.push({ recipient, channel });
    }
  }

  // 4. Process in chunks of 20 with Promise.allSettled.
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize);
    await Promise.allSettled(
      chunk.map(async ({ recipient, channel }) => {
        const vars: Record<string, string> = {
          name:      recipient.full_name ?? '',
          school:    schoolId,
        };
        const msgBody = interpolate(ann.message, vars);
        const to      = channel === 'email' ? (recipient.email ?? '') : (recipient.phone ?? '');

        // Skip if no contact address for this channel.
        if (!to) {
          failedCount++;
          return;
        }

        // Insert pending log (multi-tenant scoped, append-only).
        const { rows: logRows } = await query<{ id: string }>(
          `INSERT INTO message_logs
             (school_id, announcement_id, channel, event_type, recipient_id,
              recipient_phone, recipient_email, body, status)
           VALUES ($1,$2,$3,'announcement',$4,$5,$6,$7,'pending')
           RETURNING id`,
          [
            schoolId, announcementId, channel, recipient.id,
            channel !== 'email' ? to : null,
            channel === 'email' ? to : null,
            msgBody,
          ],
        );
        const logId = logRows[0].id;

        // Call provider.
        let success = false;
        let providerMessageId: string | undefined;
        let errorMessage: string | undefined;

        try {
          if (channel === 'sms') {
            const { sendSms } = await import('./providers/sms.provider.js');
            const r = await sendSms(to, msgBody);
            success = r.success; providerMessageId = r.sid; errorMessage = r.error;
          } else if (channel === 'whatsapp') {
            const { sendWhatsApp } = await import('./providers/whatsapp.provider.js');
            const r = await sendWhatsApp(to, msgBody);
            success = r.success; providerMessageId = r.sid; errorMessage = r.error;
          } else {
            const { sendEmail } = await import('./providers/email.provider.js');
            const r = await sendEmail(to, ann.title, msgBody);
            success = r.success; providerMessageId = r.messageId; errorMessage = r.error;
          }
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : String(err);
        }

        // Update log row with outcome.
        await query(
          `UPDATE message_logs
              SET status              = $2,
                  provider_message_id = $3,
                  error_message       = $4,
                  sent_at             = CASE WHEN $2 = 'sent' THEN now() ELSE NULL END
            WHERE id = $1`,
          [logId, success ? 'sent' : 'failed', providerMessageId ?? null, errorMessage ?? null],
        );

        if (success) sentCount++; else failedCount++;
      }),
    );
  }

  // 5. Update announcement totals and final status.
  await query(
    `UPDATE announcements
        SET sent_count   = $2,
            failed_count = $3,
            status       = 'sent',
            sent_at      = now()
      WHERE id = $1`,
    [announcementId, sentCount, failedCount],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE LOGS
// ═══════════════════════════════════════════════════════════════════════════

export async function listLogs(actor: AccessClaims, q: ListLogsQuery) {
  const where: string[] = ['school_id = $1'];
  const params: unknown[] = [actor.schoolId];

  if (q.channel) {
    params.push(q.channel);
    where.push(`channel = $${params.length}`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`status = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset   = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<MessageLogRow>(
      `SELECT id, school_id, announcement_id, channel, event_type, recipient_id,
              recipient_phone, recipient_email, subject, body, status,
              provider_message_id, error_message, sent_at, created_at
         FROM message_logs
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM message_logs WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toLogDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}
