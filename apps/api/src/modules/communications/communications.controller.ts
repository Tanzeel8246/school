import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as svc from './communications.service.js';
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

// ── Notification settings ──────────────────────────────────────────────────

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getNotificationSettings(req.user!);
    res.json({ data });
  } catch (err) { next(err); }
}

export async function putSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as PutNotificationSettingsInput;
    const data  = await svc.putNotificationSettings(req.user!, input);
    await audit(req, 'settings.update', 'notification_settings', null, undefined, input);
    res.json({ data });
  } catch (err) { next(err); }
}

// ── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listTemplates(req.user!, req.query as unknown as ListTemplatesQuery);
    res.json(result);
  } catch (err) { next(err); }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateTemplateInput;
    const data  = await svc.createTemplate(req.user!, input);
    await audit(req, 'template.create', 'message_templates', data.id, undefined, data);
    res.status(201).json({ data });
  } catch (err) { next(err); }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const input  = req.body as UpdateTemplateInput;
    const result = await svc.updateTemplate(req.user!, req.params.id, input);
    await audit(req, 'template.update', 'message_templates', req.params.id, result.before, result.after);
    res.json({ data: result.after });
  } catch (err) { next(err); }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.deleteTemplate(req.user!, req.params.id);
    await audit(req, 'template.delete', 'message_templates', req.params.id, data, undefined);
    res.json({ data });
  } catch (err) { next(err); }
}

// ── Direct send ────────────────────────────────────────────────────────────

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as SendMessageInput;
    const data  = await svc.sendMessage(req.user!, input);
    await audit(req, 'message.send', 'message_logs', data.id, undefined, {
      channel: data.channel, to: input.to, status: data.status,
    });
    res.status(201).json({ data });
  } catch (err) { next(err); }
}

// ── Announcements ──────────────────────────────────────────────────────────

export async function listAnnouncements(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listAnnouncements(req.user!, req.query as unknown as ListAnnouncementsQuery);
    res.json(result);
  } catch (err) { next(err); }
}

export async function createAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateAnnouncementInput;
    const data  = await svc.createAnnouncement(req.user!, input);
    await audit(req, 'announcement.create', 'announcements', data.id, undefined, {
      title: data.title, targetType: data.targetType, channels: data.channels,
    });
    res.status(201).json({ data });
  } catch (err) { next(err); }
}

// ── Logs ───────────────────────────────────────────────────────────────────

export async function listLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listLogs(req.user!, req.query as unknown as ListLogsQuery);
    res.json(result);
  } catch (err) { next(err); }
}
