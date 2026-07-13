import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as bcrypt from 'bcrypt';
import { customAlphabet } from 'nanoid';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema, acceptInviteSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from '@aem/shared';
import { logError } from '../lib/logger';
import { config } from '../config';

const router = Router();
// Unguessable, URL-safe reset token; valid for one hour.
const resetToken = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 40);
const RESET_TTL_MS = 60 * 60 * 1000;
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many sign-up attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** URL-safe org slug from a company name. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'org'
  );
}

/** First free slug for the base (base, base-2, base-3, …). Organization isn't tenant-scoped. */
async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.organization.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

/** Temporary diagnostic logging for login (safe: no passwords in logs) */
function logLoginStep(step: string, detail: string): void {
  console.log(`[LOGIN] ${step}: ${detail}`);
}

/**
 * POST /auth/login
 * Body: { email, password }
 * Sets session on success.
 * Returns specific errors: DB not reachable | User not found | Invalid password | Session error | Login failed
 */
router.post('/login', loginLimiter, validateBody(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const email = (req.body as { email: string }).email;
  try {
    // 1) DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    logLoginStep('DATABASE_URL', dbUrl ? (dbUrl.startsWith('file:') ? 'set (file)' : 'set (masked)') : 'NOT SET');
    if (!dbUrl) {
      res.status(503).json({ success: false, error: 'DB not reachable (DATABASE_URL not set)' });
      return;
    }

    // 2) DB connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      logLoginStep('DB connection', 'ok');
    } catch (dbErr) {
      logError('Login DB connection', dbErr);
      logLoginStep('DB connection', 'failed');
      res.status(503).json({ success: false, error: 'DB not reachable' });
      return;
    }

    // 3) User exists
    const user = await prisma.user.findUnique({ where: { email } });
    logLoginStep('user exists', user ? `yes (${email})` : `no (${email})`);
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    // 4) Password compare
    const password = (req.body as { password: string }).password;
    const valid = await bcrypt.compare(password, user.passwordHash);
    logLoginStep('password compare', valid ? 'pass' : 'fail');
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid password' });
      return;
    }

    // 5) Set session (session store may use DB)
    // Load the org's currency/locale so money/dates render per-tenant (Organization isn't tenant-scoped).
    const org = user.organizationId
      ? await prisma.organization.findUnique({ where: { id: user.organizationId } })
      : null;
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      currency: org?.currency ?? 'MKD',
      locale: org?.locale ?? 'mk',
    };
    res.json({ success: true, data: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    logError('Login error', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('session') || msg.includes('connect')) {
      res.status(503).json({ success: false, error: 'Session error (check DB)' });
      return;
    }
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * POST /auth/register
 * Self-serve onboarding: creates a new organization + its first ADMIN user
 * atomically, then logs the user in. Body: { companyName, email, password, currency?, locale? }.
 */
router.post('/register', registerLimiter, validateBody(registerSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyName, email, password, currency, locale } = req.body as {
      companyName: string;
      email: string;
      password: string;
      currency?: string;
      locale?: string;
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = await uniqueSlug(slugify(companyName));

    // Org + first admin created together so a failure never leaves a half-provisioned tenant.
    const { user, org } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: companyName, slug, currency: currency || 'MKD', locale: locale || 'mk' },
      });
      const user = await tx.user.create({
        data: { email, passwordHash, role: 'ADMIN', organizationId: org.id },
      });
      return { user, org };
    });

    // Log the new admin straight in — no manual step to start using the app.
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: org.id,
      currency: org.currency,
      locale: org.locale,
    };
    res.status(201).json({ success: true, data: { id: user.id, email: user.email, role: user.role } });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      res.status(409).json({ success: false, error: 'That email or company is already registered' });
      return;
    }
    logError('POST /auth/register', err);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * GET /auth/invitation/:token (public)
 * Invite details for the accept page. Invitation lookup is unscoped here because
 * the invitee isn't logged in yet.
 */
router.get('/invitation/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const invite = await prisma.invitation.findUnique({
      where: { token: req.params.token },
      include: { organization: { select: { name: true } } },
    });
    if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
      res.status(404).json({ success: false, error: 'This invite is invalid or has expired' });
      return;
    }
    res.json({ success: true, data: { email: invite.email, role: invite.role, organizationName: invite.organization.name } });
  } catch (err) {
    logError('GET /auth/invitation/:token', err);
    res.status(500).json({ success: false, error: 'Failed to load invitation' });
  }
});

/**
 * POST /auth/invitation/:token/accept (public)
 * Creates the invitee's user in the inviting org, marks the invite accepted, logs in.
 */
router.post('/invitation/:token/accept', validateBody(acceptInviteSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const invite = await prisma.invitation.findUnique({ where: { token: req.params.token } });
    if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
      res.status(404).json({ success: false, error: 'This invite is invalid or has expired' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }
    const passwordHash = await bcrypt.hash((req.body as { password: string }).password, 12);
    const { user, org } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: invite.email, passwordHash, role: invite.role, organizationId: invite.organizationId },
      });
      await tx.invitation.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      const org = await tx.organization.findUnique({ where: { id: invite.organizationId } });
      return { user, org };
    });
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: invite.organizationId,
      currency: org?.currency ?? 'MKD',
      locale: org?.locale ?? 'mk',
    };
    res.status(201).json({ success: true, data: { id: user.id, email: user.email, role: user.role } });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }
    logError('POST /auth/invitation/:token/accept', err);
    res.status(500).json({ success: false, error: 'Failed to accept invitation' });
  }
});

/**
 * POST /auth/forgot-password (public)
 * Issues a reset token for the email if an account exists. Always returns 200
 * (never reveals whether the email is registered). No SMTP is wired, so the
 * link is logged server-side and returned only in non-production for testing.
 */
router.post('/forgot-password', registerLimiter, validateBody(forgotPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const email = (req.body as { email: string }).email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    let resetUrl: string | undefined;
    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      const token = resetToken();
      await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
      resetUrl = `${config.corsOrigin}/reset-password/${token}`;
      console.log(`[RESET] password reset link for ${email}: ${resetUrl}`);
    }
    res.json({ success: true, data: config.isProduction ? {} : { resetUrl } });
  } catch (err) {
    logError('POST /auth/forgot-password', err);
    res.status(500).json({ success: false, error: 'Failed to start password reset' });
  }
});

/** GET /auth/reset-password/:token (public) — validate a reset link before showing the form. */
router.get('/reset-password/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await prisma.passwordResetToken.findUnique({
      where: { token: req.params.token },
      include: { user: { select: { email: true } } },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      res.status(404).json({ success: false, error: 'This reset link is invalid or has expired' });
      return;
    }
    res.json({ success: true, data: { email: row.user.email } });
  } catch (err) {
    logError('GET /auth/reset-password/:token', err);
    res.status(500).json({ success: false, error: 'Failed to validate reset link' });
  }
});

/** POST /auth/reset-password/:token (public) — set a new password, consume the token, log in. */
router.post('/reset-password/:token', validateBody(resetPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await prisma.passwordResetToken.findUnique({ where: { token: req.params.token }, include: { user: true } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      res.status(404).json({ success: false, error: 'This reset link is invalid or has expired' });
      return;
    }
    const passwordHash = await bcrypt.hash((req.body as { password: string }).password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    const org = await prisma.organization.findUnique({ where: { id: row.user.organizationId } });
    req.session.user = {
      id: row.user.id,
      email: row.user.email,
      role: row.user.role,
      organizationId: row.user.organizationId,
      currency: org?.currency ?? 'MKD',
      locale: org?.locale ?? 'mk',
    };
    res.json({ success: true, data: { id: row.user.id, email: row.user.email, role: row.user.role } });
  } catch (err) {
    logError('POST /auth/reset-password/:token', err);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

/** POST /auth/change-password (logged in) — verify current password, set a new one. */
router.post('/change-password', requireAuth, validateBody(changePasswordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ success: false, error: 'Current password is incorrect' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ success: true });
  } catch (err) {
    logError('POST /auth/change-password', err);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

/**
 * POST /auth/logout
 */
router.post('/logout', (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      logError('Logout session destroy', err);
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

/**
 * GET /auth/me - current user (requires auth)
 */
router.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.json({ success: true, data: req.user });
});

export default router;
