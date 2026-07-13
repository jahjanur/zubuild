import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Self-serve sign-up: provisions a new organization + its first admin user.
export const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  currency: z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase().optional(),
  locale: z.string().trim().min(2).max(5).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Password reset (public) + change password (logged in) + account profile.
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
