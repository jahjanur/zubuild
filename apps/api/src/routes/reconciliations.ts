import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createReconciliationSchema } from '@zubuild/shared';
import { logError } from '../lib/logger';

const router = Router();
router.use(requireAuth);

/**
 * Compute missingQty = max(orderedQty - receivedQty, 0), lossValue = missingQty * price, status.
 */
function computeItem(
  orderedQty: number,
  receivedQty: number,
  price: number
): { missingQty: number; lossValue: number; status: 'COMPLETE' | 'MISSING' | 'EXCESS' } {
  const missingQty = Math.max(orderedQty - receivedQty, 0);
  const lossValue = missingQty * price;
  const status =
    missingQty > 0 ? 'MISSING' : receivedQty > orderedQty ? 'EXCESS' : 'COMPLETE';
  return { missingQty, lossValue, status };
}

/** POST /reconciliations - complete reconciliation for an order (once only) */
router.post('/', requireAdmin, validateBody(createReconciliationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, reconciliationDate, notes, items: receivedItems } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true, reconciliation: true },
    });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    if (order.reconciliation) {
      res.status(400).json({ success: false, error: 'Order already reconciled' });
      return;
    }
    const receivedMap = new Map(receivedItems.map((i: { orderItemId: string; receivedQty: number }) => [i.orderItemId, i.receivedQty]));
    let totalLossValue = 0;
    const reconItems: Array<{
      orderItemId: string;
      name: string;
      unit: string;
      price: number;
      orderedQty: number;
      receivedQty: number;
      missingQty: number;
      lossValue: number;
      status: string;
    }> = [];
    for (const oi of order.orderItems) {
      const receivedQty = Number(receivedMap.get(oi.id) ?? 0);
      const price = Number(oi.price);
      const { missingQty, lossValue, status } = computeItem(oi.quantity, receivedQty, price);
      totalLossValue += lossValue;
      reconItems.push({
        orderItemId: oi.id,
        name: oi.name,
        unit: oi.unit,
        price: Number(price),
        orderedQty: oi.quantity,
        receivedQty,
        missingQty,
        lossValue,
        status,
      });
    }
    const reconDate = reconciliationDate ? new Date(reconciliationDate) : new Date();
    const reconciliation = await prisma.reconciliation.create({
      data: {
        orderId: order.id,
        reconciliationDate: reconDate,
        notes: notes ?? null,
        totalLossValue: Number(totalLossValue),
        items: {
          create: reconItems.map((it) => ({
            orderItemId: it.orderItemId,
            name: it.name,
            unit: it.unit,
            price: Number(it.price),
            orderedQty: it.orderedQty,
            receivedQty: it.receivedQty,
            missingQty: it.missingQty,
            lossValue: Number(it.lossValue),
            status: it.status,
          })),
        },
      },
      include: { items: true },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'RECONCILED' },
    });
    res.status(201).json({ success: true, data: reconciliation });
  } catch (err) {
    logError('POST /reconciliations', err);
    res.status(500).json({ success: false, error: 'Failed to create reconciliation' });
  }
});

/** GET /reconciliations/recent?limit=5&onlyWithDiscrepancies=true - for dashboard */
router.get('/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || 5), 10)));
    const onlyWithDiscrepancies = String(req.query.onlyWithDiscrepancies).toLowerCase() === 'true';
    const where = onlyWithDiscrepancies ? { totalLossValue: { gt: 0 } } : {};
    const list = await prisma.reconciliation.findMany({
      where,
      include: { order: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ success: true, data: list });
  } catch (err) {
    logError('GET /reconciliations/recent', err);
    res.status(500).json({ success: false, error: 'Failed to fetch recent reconciliations' });
  }
});

/** GET /reconciliations */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.reconciliation.findMany({
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: list });
  } catch (err) {
    logError('GET /reconciliations', err);
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliations' });
  }
});

/** GET /reconciliations/:id */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const recon = await prisma.reconciliation.findUnique({
      where: { id: req.params.id },
      include: { order: true, items: true },
    });
    if (!recon) {
      res.status(404).json({ success: false, error: 'Reconciliation not found' });
      return;
    }
    res.json({ success: true, data: recon });
  } catch (err) {
    logError('GET /reconciliations/:id', err);
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliation' });
  }
});

export default router;
