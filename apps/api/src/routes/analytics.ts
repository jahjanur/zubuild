import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, tenantContext } from '../middleware/auth';
import { logError } from '../lib/logger';

const router = Router();
router.use(requireAuth, tenantContext);

/** GET /analytics/overview - stats for dashboard */
router.get('/overview', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [supplierCount, productCount, pendingOrders, reconciledWithLoss, ordersAgg] = await Promise.all([
      prisma.supplier.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.reconciliation.aggregate({
        _sum: { totalLossValue: true },
        where: { totalLossValue: { gt: 0 } },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);
    const totalLosses = Number(reconciledWithLoss._sum.totalLossValue ?? 0);
    const totalOrdersAmountMkd = Number(ordersAgg._sum.totalAmount ?? 0);
    const totalOrdersCount = ordersAgg._count.id;
    res.json({
      success: true,
      data: {
        totalSuppliers: supplierCount,
        totalProducts: productCount,
        pendingOrders,
        totalLosses,
        lowStockCount: 0,
        totalOrdersAmountMkd,
        totalOrdersCount,
      },
    });
  } catch (err) {
    logError('GET /analytics/overview', err);
    res.status(500).json({ success: false, error: 'Failed to fetch overview' });
  }
});

/** GET /analytics/monthly-loss?months=6 - month totals for last N months */
router.get('/monthly-loss', async (req: Request, res: Response): Promise<void> => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(String(req.query.months || 6), 10)));
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - months, 1);
    const recs = await prisma.reconciliation.findMany({
      where: { reconciliationDate: { gte: start, lte: end } },
      select: { reconciliationDate: true, totalLossValue: true },
    });
    const byMonth = new Map<string, number>();
    for (let i = 0; i < months; i++) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, 0);
    }
    for (const r of recs) {
      const d = r.reconciliationDate;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (byMonth.has(key)) {
        byMonth.set(key, byMonth.get(key)! + Number(r.totalLossValue));
      }
    }
    const data = Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total }));
    res.json({ success: true, data });
  } catch (err) {
    logError('GET /analytics/monthly-loss', err);
    res.status(500).json({ success: false, error: 'Failed to fetch monthly loss' });
  }
});

/** GET /analytics/top-items?limit=5 - top 5 by loss value and by missing quantity */
router.get('/top-items', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || 5), 10)));
    const items = await prisma.reconciliationItem.findMany({
      where: { lossValue: { gt: 0 } },
      select: { name: true, unit: true, lossValue: true, missingQty: true },
    });
    const byName = new Map<
      string,
      { name: string; unit: string; totalLossValue: number; totalMissingQty: number }
    >();
    for (const it of items) {
      const key = `${it.name}|${it.unit}`;
      const cur = byName.get(key) ?? {
        name: it.name,
        unit: it.unit,
        totalLossValue: 0,
        totalMissingQty: 0,
      };
      cur.totalLossValue += Number(it.lossValue);
      cur.totalMissingQty += it.missingQty;
      byName.set(key, cur);
    }
    const arr = Array.from(byName.values());
    const byLoss = [...arr].sort((a, b) => b.totalLossValue - a.totalLossValue).slice(0, limit);
    const byMissing = [...arr].sort((a, b) => b.totalMissingQty - a.totalMissingQty).slice(0, limit);
    res.json({
      success: true,
      data: { byLossValue: byLoss, byMissingQty: byMissing },
    });
  } catch (err) {
    logError('GET /analytics/top-items', err);
    res.status(500).json({ success: false, error: 'Failed to fetch top items' });
  }
});

/** GET /analytics/loss-rate - incidents ratio (reconciled with loss vs all reconciled), avg loss per incident */
router.get('/loss-rate', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [withLoss, allRecon, sumLoss] = await Promise.all([
      prisma.reconciliation.count({ where: { totalLossValue: { gt: 0 } } }),
      prisma.reconciliation.count(),
      prisma.reconciliation.aggregate({
        _sum: { totalLossValue: true },
        where: { totalLossValue: { gt: 0 } },
      }),
    ]);
    const totalLoss = Number(sumLoss._sum.totalLossValue ?? 0);
    const incidentsRatio = allRecon > 0 ? withLoss / allRecon : 0;
    const avgLossPerIncident = withLoss > 0 ? totalLoss / withLoss : 0;
    res.json({
      success: true,
      data: {
        incidentsRatio,
        totalReconciled: allRecon,
        incidentsWithLoss: withLoss,
        averageLossPerIncident: avgLossPerIncident,
      },
    });
  } catch (err) {
    logError('GET /analytics/loss-rate', err);
    res.status(500).json({ success: false, error: 'Failed to fetch loss rate' });
  }
});

export default router;
