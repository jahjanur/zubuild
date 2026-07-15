import { z } from 'zod';

/**
 * Payload for the "cost per m²" PDF export. The calculator is live and unsaved,
 * so the client sends the exact rows + results it is showing and the server
 * renders them faithfully (PDF matches the screen). Amounts are in euros.
 */
const money = z.number().finite();

export const costCalcPdfSchema = z.object({
  lang: z.string().trim().max(5).optional(),
  areaM2: money.min(0),
  rate: money.positive(),
  materials: z
    .array(
      z.object({
        name: z.string().trim().max(200),
        unit: z.string().trim().max(20),
        priceEur: money,
        quantity: money,
        lineCost: money,
      })
    )
    .max(500),
  materialsTotal: money,
  labourLumpSum: money,
  labourItems: z
    .array(
      z.object({
        role: z.string().trim().max(120),
        days: money,
        dailyRateEur: money,
        cost: money,
      })
    )
    .max(200),
  labourTotal: money,
  totalCost: money,
  costPerM2: money.nullable(),
  sale: z
    .object({
      salePricePerM2: money,
      saleTotal: money,
      profit: money,
      profitPerM2: money.nullable(),
      margin: money.nullable(),
    })
    .nullable(),
});

export type CostCalcPdfInput = z.infer<typeof costCalcPdfSchema>;
