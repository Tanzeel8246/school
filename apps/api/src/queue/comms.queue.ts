/**
 * BullMQ queue definition for communication jobs.
 * The API process uses this to ENQUEUE jobs.
 * The worker process uses this to CONSUME jobs.
 */
import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export const COMMS_QUEUE = 'communications';

export interface AnnouncementJobData {
  schoolId: string;
  announcementId: string;
}

export interface SendMessageJobData {
  logId: string;
  channel: 'sms' | 'whatsapp' | 'email';
  to: string;
  subject: string | null;
  body: string;
}

export type CommsJobData = AnnouncementJobData | SendMessageJobData;

export const commsQueue = new Queue(COMMS_QUEUE, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,                       // retry up to 3× on failure
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 200 },  // keep last 200 completed jobs for monitoring
    removeOnFail:     { count: 500 },  // keep last 500 failed jobs for debugging
  },
});
