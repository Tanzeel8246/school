import { createApp, logger } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { closeRedis } from './queue/connection.js';
import { closeSecurityRedis } from './config/redis.js';
import { registerCleanupJobs } from './jobs/cleanup.job.js';

const app    = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`EduCore API listening on :${env.PORT} (${env.NODE_ENV})`);
  // Database cleanup + maintenance cron jobs (OTP, login_history, refresh tokens, balances)
  registerCleanupJobs();
});

// Graceful shutdown — drain connections so deploys don't drop in-flight requests.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    logger.info(`${sig} received, shutting down…`);
    server.close(async () => {
      await pool.end();
      await closeRedis();           // BullMQ connection
      await closeSecurityRedis();   // Security Redis client (JTI blacklist, lockout)
      process.exit(0);
    });
  });
}

