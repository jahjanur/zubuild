/**
 * Construction measurement units (must match @zubuild/shared).
 */
export const MEASUREMENT_UNITS = [
  'kg',
  'ton',
  'litre',
  'adet',
  'm',
  'm²',
  'm³',
  'torba',
  'paket',
  'kutu',
  'rulo',
] as const;

export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];
