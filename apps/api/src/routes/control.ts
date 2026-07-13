import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, tenantContext } from '../middleware/auth';
import { logError } from '../lib/logger';

const router = Router();
router.use(requireAuth, tenantContext);

/** GET /control/summary - incidents count, items missing sum, total loss sum (only where totalLossValue > 0) */
router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const incidents = await prisma.reconciliation.findMany({
      where: { totalLossValue: { gt: 0 } },
      include: { items: true },
    });
    let totalItemsMissing = 0;
    let totalLossSum = 0;
    for (const inc of incidents) {
      totalItemsMissing += inc.items.reduce((s, i) => s + i.missingQty, 0);
      totalLossSum += Number(inc.totalLossValue);
    }
    res.json({
      success: true,
      data: {
        incidentCount: incidents.length,
        totalItemsMissing,
        totalLossSum,
      },
    });
  } catch (err) {
    logError('GET /control/summary', err);
    res.status(500).json({ success: false, error: 'Failed to fetch control summary' });
  }
});

/** GET /control/incidents - list reconciliations with loss (for error log table) */
router.get('/incidents', async (_req: Request, res: Response): Promise<void> => {
  try {
    const incidents = await prisma.reconciliation.findMany({
      where: { totalLossValue: { gt: 0 } },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: incidents });
  } catch (err) {
    logError('GET /control/incidents', err);
    res.status(500).json({ success: false, error: 'Failed to fetch incidents' });
  }
});

/** GET /control/export.csv - CSV download: date, order number, item name, unit, ordered, received, missing, lossValue, notes */
router.get('/export.csv', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const reconciliations = await prisma.reconciliation.findMany({
      where: { totalLossValue: { gt: 0 } },
      include: { order: true, items: true },
      orderBy: { reconciliationDate: 'desc' },
    });
    const header = 'Date,Order Number,Item Name,Unit,Ordered,Received,Missing,Loss Value,Notes';
    const rows: string[] = [header];
    for (const r of reconciliations) {
      const date = r.reconciliationDate.toISOString().split('T')[0];
      const orderNumber = r.order.orderNumber;
      const notes = (r.notes ?? '').replace(/"/g, '""');
      for (const it of r.items) {
        if (Number(it.lossValue) <= 0) continue;
        rows.push(
          [
            date,
            orderNumber,
            `"${(it.name ?? '').replace(/"/g, '""')}"`,
            it.unit,
            it.orderedQty,
            it.receivedQty,
            it.missingQty,
            Number(it.lossValue).toFixed(2),
            `"${notes}"`,
          ].join(',')
        );
      }
    }
    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="control-panel-export.csv"');
    res.send(csv);
  } catch (err) {
    logError('GET /control/export.csv', err);
    res.status(500).json({ success: false, error: 'Failed to export CSV' });
  }
});

export default router;
