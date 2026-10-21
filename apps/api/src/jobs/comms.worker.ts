import { Worker, type Job } from 'bullmq';
import { redisConnection, closeRedis } from '../queue/connection.js';
import { COMMS_QUEUE, type CommsJobData } from '../queue/comms.queue.js';
import { dispatchAnnouncementJob } from '../modules/communications/communications.service.js';
import { processSendMessageJob } from '../modules/communications/notify.js';
import { pool } from '../config/db.js';

const worker = new Worker<CommsJobData>(
  COMMS_QUEUE,
  async (job: Job<CommsJobData>) => {
    if (job.name === 'send-message') {
      const data = job.data as Extract<CommsJobData, { logId: string }>;
      // eslint-disable-next-line no-console
      console.log(`[worker] processing job ${job.id} — send-message log ${data.logId}`);
      await processSendMessageJob(data);
    } else {
      const data = job.data as Extract<CommsJobData, { announcementId: string }>;
      // eslint-disable-next-line no-console
      console.log(`[worker] processing job ${job.id} — announcement ${data.announcementId}`);
      await dispatchAnnouncementJob(data.schoolId, data.announcementId);
    }
    // eslint-disable-next-line no-console
    console.log(`[worker] completed job ${job.id}`);
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: redisConnection as any,
    concurrency: 5,   // process up to 5 jobs simultaneously
  },
);

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} failed attempt ${job?.attemptsMade}:`, err.message);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    // eslint-disable-next-line no-console
    console.log(`[worker] ${sig} received — shutting down`);
    await worker.close();
    await pool.end();
    await closeRedis();
    process.exit(0);
  });
}

// eslint-disable-next-line no-console
console.log('[worker] Communications worker started');
