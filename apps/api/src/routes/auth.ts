import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema } from '@aem/shared';
import { logError } from '../lib/logger';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

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
