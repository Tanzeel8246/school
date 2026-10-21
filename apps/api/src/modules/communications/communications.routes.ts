import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listLogsQuerySchema,
  listAnnouncementsQuerySchema,
  listTemplatesQuerySchema,
  createTemplateSchema,
  updateTemplateSchema,
  sendMessageSchema,
  createAnnouncementSchema,
  putNotificationSettingsSchema,
} from './communications.schema.js';
import * as ctrl from './communications.controller.js';
import { commsQueue } from '../../queue/comms.queue.js';

export const communicationsRouter = Router();

// All communications routes require authentication.
communicationsRouter.use(authenticate);

// ── Notification settings (literal paths before /:id) ─────────────────────
communicationsRouter.get(
  '/settings',
  requirePermission('communications:read'),
  ctrl.getSettings,
);
communicationsRouter.put(
  '/settings',
  requirePermission('communications:manage'),
  validate(putNotificationSettingsSchema),
  ctrl.putSettings,
);

// ── Templates ──────────────────────────────────────────────────────────────
communicationsRouter.get(
  '/templates',
  requirePermission('communications:read'),
  validate(listTemplatesQuerySchema, 'query'),
  ctrl.listTemplates,
);
communicationsRouter.post(
  '/templates',
  requirePermission('communications:manage'),
  validate(createTemplateSchema),
  ctrl.createTemplate,
);
communicationsRouter.patch(
  '/templates/:id',
  requirePermission('communications:manage'),
  validate(updateTemplateSchema),
  ctrl.updateTemplate,
);
communicationsRouter.delete(
  '/templates/:id',
  requirePermission('communications:manage'),
  ctrl.deleteTemplate,
);

// ── Direct single message send ─────────────────────────────────────────────
communicationsRouter.post(
  '/send',
  requirePermission('communications:write'),
  validate(sendMessageSchema),
  ctrl.sendMessage,
);

// ── Queue health / monitoring — principal/admin only ──────────────────────
communicationsRouter.get(
  '/queue/status',
  requirePermission('communications:manage'),
  async (_req, res, next) => {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        commsQueue.getWaitingCount(),
        commsQueue.getActiveCount(),
        commsQueue.getCompletedCount(),
        commsQueue.getFailedCount(),
      ]);
      res.json({ data: { waiting, active, completed, failed } });
    } catch (e) {
      next(e);
    }
  },
);

// ── Announcements ──────────────────────────────────────────────────────────
communicationsRouter.get(
  '/announcements',
  requirePermission('communications:read'),
  validate(listAnnouncementsQuerySchema, 'query'),
  ctrl.listAnnouncements,
);
communicationsRouter.post(
  '/announcements',
  requirePermission('communications:manage'),
  validate(createAnnouncementSchema),
  ctrl.createAnnouncement,
);

// ── Message logs ───────────────────────────────────────────────────────────
communicationsRouter.get(
  '/logs',
  requirePermission('communications:read'),
  validate(listLogsQuerySchema, 'query'),
  ctrl.listLogs,
);
