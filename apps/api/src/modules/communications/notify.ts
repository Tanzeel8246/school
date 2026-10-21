/**
 * Notification triggers for other modules (attendance, fees, exams).
 * Each function checks notification_settings before sending; never throws
 * so it never breaks the parent action (blueprint §3 — async dispatch).
 * Multi-tenant: schoolId is always the first argument and scopes all queries.
 */
import { query } from '../../config/db.js';
import { isChannelEnabled, interpolate } from './communications.service.js';
import { sendSms } from './providers/sms.provider.js';
import { sendWhatsApp } from './providers/whatsapp.provider.js';
import { sendEmail } from './providers/email.provider.js';
import { commsQueue, type SendMessageJobData } from '../../queue/comms.queue.js';

export async function processSendMessageJob(data: SendMessageJobData): Promise<void> {
  const { logId, channel, to, subject, body } = data;
  let success = false;
  let providerMessageId: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (channel === 'sms') {
      const r = await sendSms(to, body);
      success = r.success; providerMessageId = r.sid; errorMessage = r.error;
    } else if (channel === 'whatsapp') {
      const r = await sendWhatsApp(to, body);
      success = r.success; providerMessageId = r.sid; errorMessage = r.error;
    } else {
      const r = await sendEmail(to, subject ?? '(no subject)', body);
      success = r.success; providerMessageId = r.messageId; errorMessage = r.error;
    }
  } catch (err) {
    success = false;
    errorMessage = String(err);
  }

  await query(
    `UPDATE message_logs
        SET status              = $2,
            provider_message_id = $3,
            error_message       = $4,
            sent_at             = CASE WHEN $2 = 'sent' THEN now() ELSE NULL END
      WHERE id = $1`,
    [logId, success ? 'sent' : 'failed', providerMessageId ?? null, errorMessage ?? null],
  );

  if (!success) {
    throw new Error(errorMessage || 'Provider failed to send message');
  }
}

// ── Internal helper: log + send via provider, update log row ───────────────

async function sendAndLog(
  schoolId: string,
  channel: 'sms' | 'whatsapp' | 'email',
  eventType: string,
  recipientId: string | null,
  to: string,
  subject: string | null,
  body: string,
): Promise<void> {
  // Insert pending log (append-only; multi-tenant scoped).
  const { rows: logRows } = await query<{ id: string }>(
    `INSERT INTO message_logs
       (school_id, channel, event_type, recipient_id, recipient_phone, recipient_email,
        subject, body, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
     RETURNING id`,
    [
      schoolId, channel, eventType, recipientId,
      channel !== 'email' ? to : null,
      channel === 'email' ? to : null,
      subject,
      body,
    ],
  );
  const logId = logRows[0].id;

  await commsQueue.add('send-message', {
    logId,
    channel,
    to,
    subject,
    body,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC TRIGGER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fire SMS/WhatsApp to student + guardian when a student is marked absent.
 * Checks notification_settings for 'attendance_absent' × channel before sending.
 * Multi-tenant: all sends scoped to schoolId.
 */
export async function notifyStudentAbsent(
  schoolId: string,
  studentName: string,
  studentPhone: string | null,
  parentPhone: string | null,
  date: string,
): Promise<void> {
  try {
    const msg = interpolate(
      'Dear Parent, {{studentName}} was absent on {{date}}. EduCore ERP.',
      { studentName, date },
    );

    const channels: Array<'sms' | 'whatsapp'> = ['sms', 'whatsapp'];
    for (const ch of channels) {
      const enabled = await isChannelEnabled(schoolId, 'attendance_absent', ch);
      if (!enabled) continue;

      for (const phone of [studentPhone, parentPhone]) {
        if (!phone) continue;
        await sendAndLog(schoolId, ch, 'attendance_absent', null, phone, null, msg).catch(console.error);
      }
    }
  } catch (err) {
    console.error('notifyStudentAbsent failed', err);
  }
}

/**
 * Fire SMS/WhatsApp/Email to guardian when a fee payment reminder is due.
 * Checks notification_settings for 'fee_due' × channel before sending.
 * Money amounts are BIGINT minor units; divided by 100 for display (paisa → PKR).
 * Multi-tenant: all sends scoped to schoolId.
 */
export async function notifyFeeReminder(
  schoolId: string,
  studentName: string,
  guardianPhone: string | null,
  guardianEmail: string | null,
  amount: number,
  dueDate: string,
): Promise<void> {
  try {
    const amountDisplay = String(Math.round(amount / 100));
    const vars: Record<string, string> = { studentName, dueDate, amount: amountDisplay };

    const smsMsg = interpolate(
      'Dear Parent, fee of PKR {{amount}} for {{studentName}} is due on {{dueDate}}.',
      vars,
    );
    const emailMsg = interpolate(
      '<p>Dear Parent,</p><p>A fee of PKR {{amount}} for <strong>{{studentName}}</strong> is due on {{dueDate}}. Please pay at the earliest.</p><p>Regards,<br>EduCore ERP</p>',
      vars,
    );

    // SMS
    if (guardianPhone) {
      const enabled = await isChannelEnabled(schoolId, 'fee_due', 'sms');
      if (enabled) {
        await sendAndLog(schoolId, 'sms', 'fee_due', null, guardianPhone, null, smsMsg).catch(console.error);
      }
    }

    // WhatsApp
    if (guardianPhone) {
      const enabled = await isChannelEnabled(schoolId, 'fee_due', 'whatsapp');
      if (enabled) {
        await sendAndLog(schoolId, 'whatsapp', 'fee_due', null, guardianPhone, null, smsMsg).catch(console.error);
      }
    }

    // Email
    if (guardianEmail) {
      const enabled = await isChannelEnabled(schoolId, 'fee_due', 'email');
      if (enabled) {
        await sendAndLog(
          schoolId, 'email', 'fee_due', null, guardianEmail,
          `Fee Reminder for ${studentName}`, emailMsg,
        ).catch(console.error);
      }
    }
  } catch (err) {
    console.error('notifyFeeReminder failed', err);
  }
}

/**
 * Insert an announcement for result publication and fan out to all_students
 * (or a specific class). Only channels enabled in notification_settings are included.
 * Multi-tenant: all queries scoped to schoolId.
 */
export async function notifyResultPublished(
  schoolId: string,
  examName: string,
  classId: string | null,
): Promise<void> {
  try {
    const enabledChannels: string[] = [];
    for (const ch of ['sms', 'whatsapp', 'email'] as const) {
      const enabled = await isChannelEnabled(schoolId, 'result_published', ch);
      if (enabled) enabledChannels.push(ch);
    }
    if (enabledChannels.length === 0) return;

    const message    = `Results for ${examName} have been published. Login to view.`;
    const targetType = classId ? 'class' : 'all_students';

    // Insert announcement (status='pending'); dispatch is async via BullMQ.
    const { rows } = await query<{ id: string }>(
      `INSERT INTO announcements
         (school_id, title, message, channels, target_type, target_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')
       RETURNING id`,
      [
        schoolId,
        `Results Published: ${examName}`,
        message,
        enabledChannels,
        targetType,
        classId ?? null,
      ],
    );

    const announcementId = rows[0].id;
    await commsQueue.add('announcement', { schoolId, announcementId });

  } catch (err) {
    console.error('notifyResultPublished failed', err);
  }
}
