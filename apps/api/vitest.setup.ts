// Mock environment variables for testing
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/educore_test';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.TWOFA_SECRET_KEY = '0123456789abcdef0123456789abcdef';

import { vi } from 'vitest';
vi.mock('bullmq', () => ({
  Queue: class {
    add() {}
    getWaitingCount() { return 0; }
    obliterate() {}
    on() {}
    emit() {}
  },
  Worker: class {
    on() {}
    close() {}
  },
}));

vi.mock('@bull-board/api', () => ({
  createBullBoard: vi.fn(() => ({
    getRouter: vi.fn(),
    setQueues: vi.fn(),
  })),
}));

vi.mock('@bull-board/api/bullMQAdapter.js', () => ({
  BullMQAdapter: class {},
}));

vi.mock('ioredis', () => {
  const MockRedis = class {
    on() {}
    quit() {}
    connect() {}
    disconnect() {}
  };
  return { default: MockRedis, Redis: MockRedis };
});
