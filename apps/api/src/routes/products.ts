import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createProductSchema, updateProductSchema } from '@zubuild/shared';
import { logError } from '../lib/logger';

const router = Router();
router.use(requireAuth);

/** Normalize category: trim and title-case to avoid duplicates */
function normalizeCategory(cat: string): string {
  const t = cat.trim();
  if (!t) return t;
  return t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** GET /products/categories - distinct categories, normalized */
router.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.product.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    const set = new Set<string>();
    for (const r of rows) {
      const n = normalizeCategory(r.category);
      if (n) set.add(n);
    }
    res.json({ success: true, data: Array.from(set).sort() });
  } catch (err) {
    logError('GET /products/categories', err);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

/** GET /products */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    res.json({ success: true, data: products });
  } catch (err) {
    logError('GET /products', err);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

/** GET /products/recent?limit=5&mode=created|ordered
 *  mode=created (default): most recently created products (createdAt desc), active only.
 *  mode=ordered: most recently ordered (from order_items), active only. */
router.get('/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || 5), 10)));
    const mode = String(req.query.mode || 'created').toLowerCase();

    if (mode === 'created') {
      const products = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      res.json({ success: true, data: products });
      return;
    }

    // mode=ordered: most recently ordered (from order_items)
    const recentOrders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true },
    });
    const orderIds = recentOrders.map((o) => o.id);
    const items = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, productId: { not: null } },
      select: { productId: true },
    });
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const it of items) {
      if (it.productId && !seen.has(it.productId)) {
        seen.add(it.productId);
        ids.push(it.productId);
        if (ids.length >= limit) break;
      }
    }
    if (ids.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
    });
    const byOrder = new Map(ids.map((id, i) => [id, i]));
    products.sort((a, b) => (byOrder.get(a.id) ?? 99) - (byOrder.get(b.id) ?? 99));
    res.json({ success: true, data: products });
  } catch (err) {
    logError('GET /products/recent', err);
    res.status(500).json({ success: false, error: 'Failed to fetch recent products' });
  }
});

/** GET /products/search?q=...&limit=20 - by name/category, active only */
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || 20), 10)));
    if (!q) {
      res.json({ success: true, data: [] });
      return;
    }
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ name: { contains: q } }, { category: { contains: q } }],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: limit,
    });
    res.json({ success: true, data: products });
  } catch (err) {
    logError('GET /products/search', err);
    res.status(500).json({ success: false, error: 'Failed to search products' });
  }
});

/** POST /products */
router.post('/', requireAdmin, validateBody(createProductSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = { ...req.body, category: normalizeCategory(req.body.category) };
    const product = await prisma.product.create({
      data,
    });
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    logError('POST /products', err);
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

/** PUT /products/:id */
router.put('/:id', requireAdmin, validateBody(updateProductSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body as { name?: string; category?: string; measurementUnit?: string; price?: number; status?: string };
    const data: { name?: string; category?: string; measurementUnit?: string; price?: number; status?: string } = { ...body };
    if (data.category !== undefined) data.category = normalizeCategory(data.category);
    const product = await prisma.product.update({ where: { id }, data });
    res.json({ success: true, data: product });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    logError('PUT /products/:id', err);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

/** DELETE /products/:id */
router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    logError('DELETE /products/:id', err);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

export default router;
