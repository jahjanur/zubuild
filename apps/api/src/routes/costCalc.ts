import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, tenantContext } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { costCalcPdfSchema } from '@aem/shared';
import { generateCostCalcPdf } from '../lib/pdf';
import { logError } from '../lib/logger';

const router = Router();
router.use(requireAuth, tenantContext);

/**
 * POST /cost-calc/pdf — render the (live, unsaved) cost-per-m² calc as a PDF.
 * The client sends the exact rows + results it is showing; we reuse the order
 * PDF pipeline (letterhead + "Powered by Zulbera" footer) to render them.
 */
router.post('/pdf', validateBody(costCalcPdfSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const org = req.user?.organizationId
      ? await prisma.organization.findUnique({ where: { id: req.user.organizationId } })
      : null;

    const langParam = String(req.body.lang || '').split('-')[0];
    const lang = ['en', 'mk', 'sq', 'tr'].includes(langParam) ? langParam : undefined;

    const pdfBuffer = await generateCostCalcPdf(req.body, {
      currency: org?.currency,
      locale: org?.locale,
      lang,
      company: org
        ? {
            name: org.invoiceName || org.name,
            address: org.invoiceAddress,
            email: org.invoiceEmail,
            phone: org.invoicePhone,
            regNo: org.invoiceRegNo,
            logoUrl: org.logoUrl,
          }
        : undefined,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="cost-per-m2.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('POST /cost-calc/pdf', err);
    res.status(500).json({ success: false, error: `Failed to generate PDF: ${message}` });
  }
});

export default router;
