/**
 * Smoke test: enqueue a test announcement job and verify it appears in the queue.
 * Run: node dist/jobs/test-queue.js
 *
 * Output should show:
 *   Enqueued job: <job-id>
 *   Queue waiting: 1
 */
import { commsQueue } from '../queue/comms.queue.js';
import { closeRedis } from '../queue/connection.js';

async function main() {
  // eslint-disable-next-line no-console
  console.log(`Adding test announcement job...`);
  const job = await commsQueue.add('announcement', {
    schoolId: 'system',
    announcementId: 'test-announcement',
  });
  // eslint-disable-next-line no-console
  console.log('Enqueued job:', job.id);

  const waiting = await commsQueue.getWaitingCount();
  // eslint-disable-next-line no-console
  console.log('Queue waiting:', waiting);

  await commsQueue.obliterate({ force: true }); // clean up test job
  // eslint-disable-next-line no-console
  console.log('Test job cleaned up');
  await closeRedis();
}

main().catch(console.error);
