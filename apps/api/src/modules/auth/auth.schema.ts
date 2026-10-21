import { z } from 'zod';

export const loginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Self-service tenant signup: provisions a brand-new school + default roles +
 * a super_admin user in one transaction (blueprint §2 — multi-tenant onboarding).
 */
export const registerSchema = z.object({
  schoolName: z.string().min(2).max(120),
  schoolCode: z.string().trim().min(2).max(40),
  adminName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterInput = z.infer<typeof registerSchema>;
