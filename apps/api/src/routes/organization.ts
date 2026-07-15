import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, tenantContext } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { updateOrganizationSchema } from '@aem/shared';
import { logError } from '../lib/logger';

const router = Router();
router.use(requireAuth, tenantContext);

// Branding fields exposed to the client (never the whole row).
const BRANDING_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  invoiceName: true,
  invoiceAddress: true,
  invoiceEmail: true,
  invoicePhone: true,
  invoiceRegNo: true,
  currency: true,
  locale: true,
  mkdToEurRate: true,
  plan: true,
} as const;

/** GET /organization — the caller's own org (drives the app-header logo + settings). */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId! }, select: BRANDING_SELECT });
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }
    res.json({ success: true, data: org });
  } catch (err) {
    logError('GET /organization', err);
    res.status(500).json({ success: false, error: 'Failed to fetch organization' });
  }
});

/** PUT /organization — update branding / letterhead (admin only). */
router.put('/', requireAdmin, validateBody(updateOrganizationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId! },
      data: req.body,
      select: BRANDING_SELECT,
    });
    // Keep the session's currency/locale in step so money/dates update without re-login.
    if (req.session.user) {
      req.session.user.currency = org.currency;
      req.session.user.locale = org.locale;
    }
    res.json({ success: true, data: org });
  } catch (err) {
    logError('PUT /organization', err);
    res.status(500).json({ success: false, error: 'Failed to update organization' });
  }
});

export default router;
