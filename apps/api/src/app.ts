import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { redisConnection } from './queue/connection.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { commsQueue } from './queue/comms.queue.js';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { schoolsRouter } from './modules/schools/schools.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { studentsRouter } from './modules/students/students.routes.js';
import { teachersRouter } from './modules/teachers/teachers.routes.js';
import { staffRouter } from './modules/staff/staff.routes.js';
import { feesRouter } from './modules/fees/fees.routes.js';
import { accountingRouter } from './modules/accounting/accounting.routes.js';
import { payrollRouter } from './modules/payroll/payroll.routes.js';
import { examsRouter } from './modules/exams/exams.routes.js';
import { libraryRouter } from './modules/library/library.routes.js';
import { transportRouter } from './modules/transport/transport.routes.js';
import { hostelRouter } from './modules/hostel/hostel.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { communicationsRouter } from './modules/communications/communications.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { parentRouter } from './modules/parent/parent.routes.js';
import { attendanceRouter } from './modules/attendance/attendance.routes.js';
import { academicsRouter } from './modules/academics/academics.routes.js';
import { uploadRouter } from './modules/upload/upload.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import path from 'node:path';

export const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' });

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));               // structured request logging
  app.use(helmet());                            // secure headers (§3)
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 60_000, limit: 120 })); // global limiter (§3)

  // Deep health check — pings DB and Redis, returns 503 if either is down
  app.get('/health', async (_req, res) => {
    const checks: Record<string, 'ok' | 'error'> = {};

    // Database ping
    try {
      await pool.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    // Redis ping (graceful degradation — Redis is optional at boot)
    try {
      await redisConnection.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');
    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      checks,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Kubernetes readiness probe — lightweight, no external deps
  app.get('/ready', (_req, res) => res.json({ ready: true }));

  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/schools', schoolsRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/students', studentsRouter);
  api.use('/teachers', teachersRouter);
  api.use('/staff', staffRouter);
  api.use('/fees', feesRouter);
  api.use('/accounting', accountingRouter);
  api.use('/payroll', payrollRouter);
  api.use('/exams', examsRouter);
  api.use('/library', libraryRouter);
  api.use('/transport', transportRouter);
  api.use('/hostel', hostelRouter);
  api.use('/inventory', inventoryRouter);
  api.use('/communications', communicationsRouter);
  api.use('/reports', reportsRouter);
  api.use('/parent', parentRouter);
  api.use('/attendance', attendanceRouter);
  api.use('/academics', academicsRouter);
  api.use('/upload', uploadRouter);
  api.use('/billing', billingRouter);
  app.use('/api/v1', api);
  
  // Serve uploaded files statically
  app.use('/uploads', express.static(path.resolve('uploads')));

  // Set up Bull Board for queue monitoring at /admin/queues
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [new BullMQAdapter(commsQueue)],
    serverAdapter: serverAdapter,
  });
  app.use('/admin/queues', serverAdapter.getRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
