import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as ctrl from './dashboard.controller.js';

// Any authenticated user gets a dashboard; the payload is shaped by their role.
export const dashboardRouter = Router();
dashboardRouter.use(authenticate);
dashboardRouter.get('/', ctrl.getDashboard);
