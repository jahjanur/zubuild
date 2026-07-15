import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, tenantContext } from '../middleware/auth';
import { logError } from '../lib/logger';

const router = Router();
router.use(requireAuth, tenantContext);

// Per-entity result cap so the palette stays snappy and scannable.
const LIMIT = 6;
const MIN_LEN = 2;

/**
 * GET /search?q= — cross-entity search over suppliers, products and orders.
 * Tenant-scoped automatically (the Prisma tenant middleware forces organizationId
 * on every query for these models). SQLite LIKE is case-insensitive for ASCII,
 * which covers the common case.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < MIN_LEN) {
      res.json({ success: true, data: { suppliers: [], products: [], orders: [] } });
      return;
    }
    const like = { contains: q };

    const [suppliers, products, orders] = await Promise.all([
      prisma.supplier.findMany({
        where: { OR: [{ companyName: like }, { contactPerson: like }, { location: like }, { phone: like }] },
        select: { id: true, companyName: true, contactPerson: true, location: true, status: true },
        take: LIMIT,
        orderBy: { companyName: 'asc' },
      }),
      prisma.product.findMany({
        where: { OR: [{ name: like }, { category: like }] },
        select: { id: true, name: true, category: true, measurementUnit: true, price: true, status: true },
        take: LIMIT,
        orderBy: { name: 'asc' },
      }),
      prisma.order.findMany({
        where: { OR: [{ orderNumber: like }, { supplierName: like }] },
        select: { id: true, orderNumber: true, supplierName: true, status: true, totalAmount: true, orderDate: true },
        take: LIMIT,
        orderBy: { orderDate: 'desc' },
      }),
    ]);

    res.json({ success: true, data: { suppliers, products, orders } });
  } catch (err) {
    logError('GET /search', err);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
