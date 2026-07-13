import { Router, Request, Response } from 'express';
import { customAlphabet } from 'nanoid';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, tenantContext } from '../middleware/auth';
import { currentOrgId } from '../lib/tenantContext';
import { validateBody } from '../middleware/validate';
import { createInviteSchema } from '@aem/shared';
import { logError } from '../lib/logger';

const router = Router();
router.use(requireAuth, tenantContext);

// URL-safe, unguessable invite token.
const inviteToken = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 32);
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** GET /team/members — users in the caller's org */
router.get('/members', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const members = await prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: members });
  } catch (err) {
    logError('GET /team/members', err);
    res.status(500).json({ success: false, error: 'Failed to fetch members' });
  }
});

/** GET /team/invitations — pending invites for the caller's org */
router.get('/invitations', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const invites = await prisma.invitation.findMany({
      where: { status: 'PENDING' },
      select: { id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: invites });
  } catch (err) {
    logError('GET /team/invitations', err);
    res.status(500).json({ success: false, error: 'Failed to fetch invitations' });
  }
});

/** POST /team/invitations — create (or refresh) an invite; returns the token to build a share link */
router.post('/invitations', requireAdmin, validateBody(createInviteSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role } = req.body as { email: string; role: string };
    const normEmail = email.trim().toLowerCase();

    // Already a member of this org?
    const existingUser = await prisma.user.findUnique({ where: { email: normEmail } });
    if (existingUser) {
      res.status(409).json({ success: false, error: 'That email is already a member' });
      return;
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    // Reuse a pending invite for the same email (refresh role, token, expiry) instead of piling up duplicates.
    const existing = await prisma.invitation.findFirst({ where: { email: normEmail, status: 'PENDING' } });
    const invite = existing
      ? await prisma.invitation.update({ where: { id: existing.id }, data: { role, token: inviteToken(), expiresAt } })
      : await prisma.invitation.create({ data: { email: normEmail, role, token: inviteToken(), expiresAt, organizationId: currentOrgId()! } });

    res.status(201).json({
      success: true,
      data: { id: invite.id, email: invite.email, role: invite.role, token: invite.token, expiresAt: invite.expiresAt },
    });
  } catch (err) {
    logError('POST /team/invitations', err);
    res.status(500).json({ success: false, error: 'Failed to create invitation' });
  }
});

/** DELETE /team/invitations/:id — revoke a pending invite */
router.delete('/invitations/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.invitation.update({ where: { id: req.params.id }, data: { status: 'REVOKED' } });
    res.json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      res.status(404).json({ success: false, error: 'Invitation not found' });
      return;
    }
    logError('DELETE /team/invitations/:id', err);
    res.status(500).json({ success: false, error: 'Failed to revoke invitation' });
  }
});

export default router;
