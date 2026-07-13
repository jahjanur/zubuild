import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireManager, tenantContext } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { inventoryAdjustSchema } from '@aem/shared';
import { logError } from '../lib/logger';
const router = Router();
router.use(requireAuth, tenantContext);

/** POST /inventory/adjust - record manual adjustment (audit trail only; no stock-on-hand) */
router.post('/adjust', requireManager, validateBody(inventoryAdjustSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, deltaQty, reason } = req.body;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    const movement = await prisma.inventoryMovement.create({
      data: {
        productId,
        type: 'MANUAL_ADJUST',
        deltaQty,
        reason: reason.trim(),
      },
    });
    res.json({ success: true, data: movement });
  } catch (err) {
    logError('POST /inventory/adjust', err);
    res.status(500).json({ success: false, error: 'Failed to adjust inventory' });
  }
});

/** GET /inventory/movements?limit=50 - audit trail (latest first) */
router.get('/movements', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 50), 10)));
    const movements = await prisma.inventoryMovement.findMany({
      include: { product: { select: { name: true, measurementUnit: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ success: true, data: movements });
  } catch (err) {
    logError('GET /inventory/movements', err);
    res.status(500).json({ success: false, error: 'Failed to fetch movements' });
  }
});

export default router;
