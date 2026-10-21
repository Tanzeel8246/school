import { z } from 'zod';

// ── Query schemas ──────────────────────────────────────────────────────────

export const listLogsQuerySchema = z.object({
  channel: z.enum(['sms', 'whatsapp', 'email']).optional(),
  status:  z.enum(['pending', 'sent', 'failed', 'bounced']).optional(),
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(1000).default(20),
});

export const listAnnouncementsQuerySchema = z.object({
  status: z.enum(['pending', 'sending', 'sent', 'failed']).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(1000).default(20),
});

export const listTemplatesQuerySchema = z.object({
  channel:   z.enum(['sms', 'whatsapp', 'email']).optional(),
  eventType: z.string().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(1000).default(20),
});

// ── Mutation schemas ───────────────────────────────────────────────────────

export const createTemplateSchema = z.object({
  name:       z.string().min(1).max(200),
  eventType:  z.string().min(1),
  channel:    z.enum(['sms', 'whatsapp', 'email']),
  subject:    z.string().min(1).optional(),
  body:       z.string().min(1),
  isDefault:  z.boolean().optional().default(false),
});

export const updateTemplateSchema = createTemplateSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' },
  );

export const sendMessageSchema = z.object({
  channel:     z.enum(['sms', 'whatsapp', 'email']),
  to:          z.string().min(1),
  subject:     z.string().optional(),
  body:        z.string().min(1),
  recipientId: z.string().uuid().optional(),
  eventType:   z.string().default('custom'),
});

export const createAnnouncementSchema = z.object({
  title:       z.string().min(1).max(500),
  message:     z.string().min(1),
  channels:    z.array(z.enum(['sms', 'whatsapp', 'email'])).min(1),
  targetType:  z.enum(['all_students', 'all_parents', 'all_staff', 'class', 'section', 'all_users']),
  targetId:    z.string().uuid().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const putNotificationSettingsSchema = z.object({
  settings: z.array(
    z.object({
      eventType: z.string().min(1),
      channel:   z.enum(['sms', 'whatsapp', 'email']),
      isEnabled: z.boolean(),
    }),
  ).min(1),
});

// ── Inferred types ─────────────────────────────────────────────────────────

export type ListLogsQuery           = z.infer<typeof listLogsQuerySchema>;
export type ListAnnouncementsQuery  = z.infer<typeof listAnnouncementsQuerySchema>;
export type ListTemplatesQuery      = z.infer<typeof listTemplatesQuerySchema>;
export type CreateTemplateInput     = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput     = z.infer<typeof updateTemplateSchema>;
export type SendMessageInput        = z.infer<typeof sendMessageSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type PutNotificationSettingsInput = z.infer<typeof putNotificationSettingsSchema>;
