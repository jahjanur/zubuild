import { z } from 'zod';

export const createInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'VIEWER']).default('VIEWER'),
});

export const acceptInviteSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});
// Alias — some call sites use the longer name.
export const acceptInvitationSchema = acceptInviteSchema;

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
