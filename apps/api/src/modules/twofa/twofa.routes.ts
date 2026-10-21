import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from './twofa.controller.js';

// Strict rate limit for OTP verification
const verifyLimiter = rateLimit({
  windowMs: 5 * 60_000,   // 5 minutes
  limit: 5,               // Max 5 verification attempts per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many verification attempts — try again in 5 minutes.' } },
});

// Strict rate limit for sending OTP
const sendLimiter = rateLimit({
  windowMs: 5 * 60_000,   // 5 minutes
  limit: 3,               // Max 3 send requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many OTP requests — try again in 5 minutes.' } },
});

export const twofaRouter = Router();

// Endpoints
twofaRouter.post('/send-email-otp', sendLimiter, ctrl.sendEmailOtp);
twofaRouter.post('/verify', verifyLimiter, ctrl.verify);
