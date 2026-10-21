import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import * as ctrl from './billing.controller.js';
import { upload } from '../upload/upload.routes.js';

export const billingRouter = Router();

billingRouter.use(authenticate);

// Only settings:manage (principals) can manage billing
billingRouter.get('/plans', requirePermission('settings:manage'), ctrl.listPlans);
billingRouter.post('/requests', requirePermission('settings:manage'), upload.single('screenshot'), ctrl.requestSubscription);
billingRouter.get('/requests', requirePermission('settings:manage'), ctrl.getMyRequests);

// Super admin routes
billingRouter.get('/admin/requests', requirePermission('schools:write'), ctrl.listAllRequests);
billingRouter.post('/admin/requests/:id/approve', requirePermission('schools:write'), ctrl.approveRequest);
billingRouter.post('/admin/requests/:id/reject', requirePermission('schools:write'), ctrl.rejectRequest);
