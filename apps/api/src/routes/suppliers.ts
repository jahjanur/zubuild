import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createSupplierSchema, updateSupplierSchema } from '@zubuild/shared';
import { logError } from '../lib/logger';

const router = Router();
router.use(requireAuth);

/** GET /suppliers */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { companyName: 'asc' } });
    res.json({ success: true, data: suppliers });
  } catch (err) {
    logError('GET /suppliers', err);
    res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
  }
});

/** POST /suppliers */
router.post('/', requireAdmin, validateBody(createSupplierSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = await prisma.supplier.create({ data: req.body });
    res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    logError('POST /suppliers', err);
    res.status(500).json({ success: false, error: 'Failed to create supplier' });
  }
});

/** PUT /suppliers/:id */
router.put('/:id', requireAdmin, validateBody(updateSupplierSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.update({ where: { id }, data: req.body });
    res.json({ success: true, data: supplier });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Supplier not found' });
      return;
    }
    logError('PUT /suppliers/:id', err);
    res.status(500).json({ success: false, error: 'Failed to update supplier' });
  }
});

/** DELETE /suppliers/:id - cannot delete if supplier has orders (use deactivate instead) */
router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orderCount = await prisma.order.count({ where: { supplierId: id } });
    if (orderCount > 0) {
      res.status(409).json({
        success: false,
        code: 'SUPPLIER_HAS_ORDERS',
        error: 'Supplier has orders',
      });
      return;
    }
    await prisma.supplier.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'P2025') {
        res.status(404).json({ success: false, error: 'Supplier not found' });
        return;
      }
      if (code === 'P2003') {
        res.status(409).json({
          success: false,
          code: 'SUPPLIER_HAS_ORDERS',
          error: 'Supplier has orders',
        });
        return;
      }
    }
    logError('DELETE /suppliers/:id', err);
    res.status(500).json({ success: false, error: 'Failed to delete supplier' });
  }
});

export default router;
