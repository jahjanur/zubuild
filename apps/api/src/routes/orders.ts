import { Router, Request, Response } from 'express';
import { customAlphabet } from 'nanoid';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createOrderSchema } from '@zubuild/shared';
import { logError } from '../lib/logger';
import { generateOrderPdf } from '../lib/pdf';
const router = Router();
router.use(requireAuth);

const shortId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

/**
 * Normalize/merge order items: same product (by productId or name+unit+price) merged into one line.
 */
function normalizeItems(
  items: Array<{ productId: string | null; name: string; unit: string; price: number; quantity: number }>
): Array<{ productId: string | null; name: string; unit: string; price: number; quantity: number }> {
  const map = new Map<string, { productId: string | null; name: string; unit: string; price: number; quantity: number }>();
  for (const it of items) {
    const key = it.productId ?? `${it.name}|${it.unit}|${it.price}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += it.quantity;
    } else {
      map.set(key, { ...it });
    }
  }
  return Array.from(map.values());
}

/** GET /orders?status=...&search=...&from=...&to=...&supplierId=...
 *  Returns list + summary: totalSpendMkd, totalCount for the filtered set. */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const search = String(req.query.search || '').trim().toLowerCase();
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const supplierId = req.query.supplierId as string | undefined;

    const where: Record<string, unknown> = {};
    if (status && ['PENDING', 'DELIVERED', 'RECONCILED'].includes(status)) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (from || to) {
      where.orderDate = {};
      if (from) (where.orderDate as Record<string, Date>).gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        (where.orderDate as Record<string, Date>).lte = toDate;
      }
    }

    let orders = await prisma.order.findMany({
      where,
      include: { orderItems: true, reconciliation: { select: { id: true } } },
      orderBy: { orderDate: 'desc' },
    });
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.supplierName.toLowerCase().includes(q) ||
          o.orderNumber.toLowerCase().includes(q)
      );
    }

    const totalSpendMkd = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const list = orders.map((o) => ({
      ...o,
      hasReconciliation: !!o.reconciliation,
    }));

    res.json({
      success: true,
      data: {
        list,
        summary: { totalSpendMkd, totalCount: list.length },
      },
    });
  } catch (err) {
    logError('GET /orders', err);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

/** POST /orders - create order with items (merged), snapshots stored. No stock deduction (anti-theft: ordered vs received only). */
router.post('/', requireAdmin, validateBody(createOrderSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { supplierId, orderDate, items: rawItems, notes } = req.body;
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, status: 'ACTIVE' },
    });
    if (!supplier) {
      res.status(400).json({ success: false, error: 'Supplier not found or inactive' });
      return;
    }
    const items = normalizeItems(rawItems);
    const orderDateObj = new Date(orderDate);

    const orderItemsData: Array<{ productId: string | null; name: string; unit: string; price: number; quantity: number }> = [];
    let totalAmount = 0;
    for (const it of items) {
      if (it.productId) {
        const product = await prisma.product.findUnique({ where: { id: it.productId } });
        if (!product) {
          res.status(400).json({ success: false, error: `Product not found: ${it.name}` });
          return;
        }
        if (product.status !== 'ACTIVE') {
          res.status(400).json({ success: false, error: `Product is inactive: ${product.name}` });
          return;
        }
      }
      const lineTotal = it.price * it.quantity;
      totalAmount += lineTotal;
      orderItemsData.push({
        productId: it.productId,
        name: it.name,
        unit: it.unit,
        price: it.price,
        quantity: it.quantity,
      });
    }

    const orderNumber = `ORD-${shortId()}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderDate: orderDateObj,
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        totalAmount,
        status: 'PENDING',
        notes: notes ?? null,
        orderItems: { create: orderItemsData },
      },
      include: { orderItems: true },
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    logError('POST /orders', err);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

/** GET /orders/:id/pdf - returns application/pdf (must be before GET /:id so /id/pdf matches) */
router.get('/:id/pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { orderItems: true },
    });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    const pdfBuffer = await generateOrderPdf(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="order-${order.orderNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('GET /orders/:id/pdf', err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    res.status(500).json({ success: false, error: `Failed to generate PDF: ${message}` });
  }
});

/** PUT /orders/:id/status */
router.put('/:id/status', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'DELIVERED', 'RECONCILED'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ success: true, data: order });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    logError('PUT /orders/:id/status', err);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

/** GET /orders/:id */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { orderItems: true, reconciliation: { include: { items: true } } },
    });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    res.json({ success: true, data: order });
  } catch (err) {
    logError('GET /orders/:id', err);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

export default router;
