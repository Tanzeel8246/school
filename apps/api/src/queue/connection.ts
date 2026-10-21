/**
 * Shared IORedis connection for BullMQ. Both the queue (producer) and the worker
 * (consumer) import this so they share the same Redis config.
 * maxRetriesPerRequest=null is required by BullMQ.
 */
import IORedis from 'ioredis';
import { env } from '../config/env.js';

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Graceful disconnect hook (called from server.ts / worker shutdown).
export async function closeRedis() {
  await redisConnection.quit().catch(() => undefined);
}
