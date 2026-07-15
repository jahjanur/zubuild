import { z } from 'zod';

/** Editable org branding / letterhead. All optional (partial update). */
export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100).optional(),
  invoiceName: z.string().trim().max(120).optional(),
  invoiceAddress: z.string().trim().max(200).optional(),
  invoiceEmail: z.string().trim().max(120).optional(),
  invoicePhone: z.string().trim().max(40).optional(),
  invoiceRegNo: z.string().trim().max(80).optional(),
  // A URL or a data: URI (base64). Capped so a small logo fits without abuse.
  logoUrl: z.string().trim().max(500_000).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  locale: z.string().trim().min(2).max(5).optional(),
  // MKD per 1 EUR — must be a sane positive rate (used by the cost calculator).
  mkdToEurRate: z.number().positive().max(10_000).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
