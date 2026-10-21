/**
 * Reports router — all routes gated by `authenticate` + `reports:read`.
 *
 * Single /:type handler covers both JSON preview and file export:
 *   GET /api/v1/reports/students              → JSON { data, meta, summary }
 *   GET /api/v1/reports/students?format=pdf   → streams PDF file
 *   GET /api/v1/reports/students?format=xlsx  → streams Excel file
 *   GET /api/v1/reports/students?format=csv   → streams CSV file
 *
 * Using a single route avoids the Express ordering problem where the literal
 * string "export" could be matched as a :type value. The format query param
 * is the clean discriminator between JSON and file responses.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { reportQuerySchema } from './reports.schema.js';
import { getReport } from './reports.controller.js';

export const reportsRouter = Router();

// All report routes require a valid bearer token.
reportsRouter.use(authenticate);

// GET /reports/:type — JSON preview or file download depending on ?format
reportsRouter.get(
  '/:type',
  requirePermission('reports:read'),
  validate(reportQuerySchema, 'query'),
  getReport,
);
