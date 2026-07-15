/**
 * Pure "cost per m²" engine — no React, no i18n, no formatting.
 *
 * Every material is priced in its OWN unit (ton, m³, m, piece) and is NEVER
 * converted between units — money (€) is the only common denominator. We sum
 * the € cost of every material + labour, then divide once by the built area.
 *
 * Money rule (one rule everywhere): work in integer cents and round each line
 * to cents before summing, so the displayed lines always reconcile with the
 * displayed totals (no "lines add to €3,599.99 but total prints €3,600").
 * Derived rates (cost/m², margin) are display-rounded by the caller.
 *
 * Designed so follow-ups (multi-section, saved calcs, templates, PDF) can wrap
 * this without a rewrite: it's a single inputs → outputs function.
 */

export interface MaterialLine {
  /** Snapshot of the catalogue product at add-time (may later be edited/deleted). */
  productId: string | null;
  name: string;
  unit: string;
  /** MKD unit price snapshotted at add-time — the source of the auto € price. */
  priceMkd: number;
  /** Effective € unit price: auto (priceMkd ÷ rate) or the user's override. */
  priceEur: number;
  /** When true, priceEur is what was actually paid and survives rate changes. */
  overridden: boolean;
  /** Fractional quantity in the material's own unit. */
  quantity: number;
}

export interface LabourItem {
  role: string;
  days: number;
  dailyRateEur: number;
  /**
   * Agreed fixed price for this line (€). When set, it's used as the line cost
   * instead of days × daily rate — so a role can be priced by the day OR as a
   * lump sum. null/undefined ⇒ fall back to days × dailyRate.
   */
  finalPriceEur?: number | null;
}

/** Effective € cost of a labour line: the final price when given, else days × daily rate. */
export function labourLineCost(it: LabourItem): number {
  if (it.finalPriceEur != null && Number.isFinite(it.finalPriceEur)) return it.finalPriceEur;
  return it.days * it.dailyRateEur;
}

export interface CostCalcInput {
  materials: MaterialLine[];
  labourLumpSumEur: number;
  labourItems: LabourItem[];
  /** Built area (m²) — the divisor. 0/empty ⇒ per-m² outputs are null. */
  areaM2: number | null;
  /** Optional sale price per m². null/empty ⇒ the whole profit block is null. */
  salePricePerM2Eur: number | null;
}

export interface CostCalcOutput {
  /** € cost of each material line, aligned with input.materials (rounded to cents). */
  lineCosts: number[];
  materialsTotal: number;
  labourTotal: number;
  totalCost: number;
  /** null when area ≤ 0. */
  costPerM2: number | null;
  /** null when no sale price given. */
  saleTotal: number | null;
  profit: number | null;
  profitPerM2: number | null;
  /** Percent; null when saleTotal ≤ 0. */
  margin: number | null;
}

const toCents = (eur: number): number => Math.round((Number.isFinite(eur) ? eur : 0) * 100);
const fromCents = (cents: number): number => cents / 100;

/** Auto € unit price from an MKD price and the org's MKD→€ rate. */
export function mkdToEur(priceMkd: number, rate: number): number {
  if (!Number.isFinite(priceMkd) || !Number.isFinite(rate) || rate <= 0) return 0;
  return priceMkd / rate;
}

/**
 * Parse a locale-aware decimal string — accepts "2,5" and "2.5" (comma or dot
 * as the decimal separator). Returns null for empty/invalid input.
 */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Treat comma as a decimal separator; drop spaces (thousands grouping).
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  // Reject anything that isn't a single well-formed decimal number.
  if (!/^-?\d*\.?\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Compute all outputs from the inputs. Pure — same inputs, same outputs. */
export function computeCost(input: CostCalcInput): CostCalcOutput {
  // Each line rounded to cents, then summed in cents ⇒ lines reconcile with totals.
  const lineCents = input.materials.map((m) => toCents(m.priceEur * m.quantity));
  const materialsCents = lineCents.reduce((sum, c) => sum + c, 0);

  const labourCents =
    toCents(input.labourLumpSumEur) +
    input.labourItems.reduce((sum, it) => sum + toCents(labourLineCost(it)), 0);

  const totalCents = materialsCents + labourCents;

  const area = input.areaM2 != null && input.areaM2 > 0 ? input.areaM2 : null;
  const hasSale =
    input.salePricePerM2Eur != null && Number.isFinite(input.salePricePerM2Eur);

  // Sale uses the raw area (0 when area is invalid) so saleTotal ⇒ 0 ⇒ margin "—".
  const areaForSale = area ?? 0;
  const saleCents = hasSale ? toCents(input.salePricePerM2Eur! * areaForSale) : null;
  const profitCents = saleCents != null ? saleCents - totalCents : null;

  return {
    lineCosts: lineCents.map(fromCents),
    materialsTotal: fromCents(materialsCents),
    labourTotal: fromCents(labourCents),
    totalCost: fromCents(totalCents),
    costPerM2: area != null ? fromCents(totalCents) / area : null,
    saleTotal: saleCents != null ? fromCents(saleCents) : null,
    profit: profitCents != null ? fromCents(profitCents) : null,
    profitPerM2: profitCents != null && area != null ? fromCents(profitCents) / area : null,
    margin:
      saleCents != null && saleCents > 0 ? (profitCents! / saleCents) * 100 : null,
  };
}
