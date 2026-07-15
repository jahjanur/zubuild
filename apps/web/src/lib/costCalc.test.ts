import { describe, it, expect } from 'vitest';
import { computeCost, mkdToEur, parseDecimal, labourLineCost, type CostCalcInput } from './costCalc';

/** The methodology worked example. € prices chosen so materials total €3,600. */
function workedExample(): CostCalcInput {
  return {
    materials: [
      { productId: '1', name: 'Steel', unit: 'ton', priceMkd: 9225, priceEur: 150, overridden: false, quantity: 4 },
      { productId: '2', name: 'Cement', unit: 'torba', priceMkd: 184.5, priceEur: 3, overridden: false, quantity: 200 },
      { productId: '3', name: 'Sand', unit: 'm³', priceMkd: 922.5, priceEur: 15, overridden: false, quantity: 40 },
      { productId: '4', name: 'Cable', unit: 'm', priceMkd: 24.6, priceEur: 0.4, overridden: false, quantity: 1500 },
      { productId: '5', name: 'Brick', unit: 'adet', priceMkd: 14.76, priceEur: 0.24, overridden: false, quantity: 5000 },
    ],
    labourLumpSumEur: 2000,
    labourItems: [
      { role: 'Mason', quantity: 10, unit: 'day', ratePerUnit: 30 },
      { role: 'Helper', quantity: 15, unit: 'day', ratePerUnit: 20 },
    ],
    areaM2: 100,
    salePricePerM2Eur: 95,
  };
}

describe('computeCost — worked example (acceptance)', () => {
  const out = computeCost(workedExample());

  it('materials total €3,600', () => expect(out.materialsTotal).toBe(3600));
  it('labour total €2,600 (2000 + 10×30 + 15×20)', () => expect(out.labourTotal).toBe(2600));
  it('total cost €6,200', () => expect(out.totalCost).toBe(6200));
  it('cost per m² €62.00', () => expect(out.costPerM2).toBe(62));
  it('sale total €9,500', () => expect(out.saleTotal).toBe(9500));
  it('profit €3,300', () => expect(out.profit).toBe(3300));
  it('profit per m² €33.00', () => expect(out.profitPerM2).toBe(33));
  it('margin 34.7% (to 1 dp)', () => expect(out.margin!).toBeCloseTo(34.7368, 3));

  it('lines reconcile with the materials total (in cents)', () => {
    const sumCents = out.lineCosts.reduce((a, b) => a + Math.round(b * 100), 0);
    expect(sumCents).toBe(Math.round(out.materialsTotal * 100));
  });
});

describe('money rounding — lines always reconcile with the total', () => {
  it('per-cent-rounded lines sum exactly to the displayed total', () => {
    const out = computeCost({
      // Fractional € prices (as if derived MKD÷rate) that don't land on whole cents.
      materials: [
        { productId: 'a', name: 'A', unit: 'm', priceMkd: 0, priceEur: 0.3333, overridden: true, quantity: 3 },
        { productId: 'b', name: 'B', unit: 'm', priceMkd: 0, priceEur: 1.005, overridden: true, quantity: 7 },
        { productId: 'c', name: 'C', unit: 'kg', priceMkd: 0, priceEur: 2.499, overridden: true, quantity: 2 },
      ],
      labourLumpSumEur: 0,
      labourItems: [],
      areaM2: null,
      salePricePerM2Eur: null,
    });
    const sumCents = out.lineCosts.reduce((a, b) => a + Math.round(b * 100), 0);
    expect(sumCents).toBe(Math.round(out.materialsTotal * 100));
    // Each line is a whole number of cents.
    for (const c of out.lineCosts) expect(Number.isInteger(Math.round(c * 100))).toBe(true);
  });
});

describe('guards', () => {
  const base = (): CostCalcInput => ({
    materials: [{ productId: 'x', name: 'X', unit: 'm', priceMkd: 0, priceEur: 10, overridden: true, quantity: 5 }],
    labourLumpSumEur: 0,
    labourItems: [],
    areaM2: 100,
    salePricePerM2Eur: null,
  });

  it('area 0/empty ⇒ per-m² outputs are null (not NaN)', () => {
    const zero = computeCost({ ...base(), areaM2: 0 });
    expect(zero.costPerM2).toBeNull();
    expect(zero.profitPerM2).toBeNull();
    const empty = computeCost({ ...base(), areaM2: null });
    expect(empty.costPerM2).toBeNull();
  });

  it('no sale price ⇒ whole profit block is null', () => {
    const out = computeCost(base());
    expect(out.saleTotal).toBeNull();
    expect(out.profit).toBeNull();
    expect(out.profitPerM2).toBeNull();
    expect(out.margin).toBeNull();
  });

  it('negative profit is a loss (kept, not clamped)', () => {
    const out = computeCost({ ...base(), salePricePerM2Eur: 0.1 }); // 0.1×100 = €10 sale vs €50 cost
    expect(out.profit).toBe(-40);
    expect(out.saleTotal).toBe(10);
  });

  it('saleTotal 0 ⇒ margin null', () => {
    const out = computeCost({ ...base(), salePricePerM2Eur: 0 });
    expect(out.saleTotal).toBe(0);
    expect(out.margin).toBeNull();
    expect(out.profit).toBe(-50); // still a loss
  });
});

describe('labour — quantity × unit rate, or a final price', () => {
  it('by day: quantity × rate', () =>
    expect(labourLineCost({ role: 'Mason', quantity: 10, unit: 'day', ratePerUnit: 30 })).toBe(300));
  it('by ton (e.g. rebar fixer): quantity × rate', () =>
    expect(labourLineCost({ role: 'Armirač', quantity: 4, unit: 'ton', ratePerUnit: 45 })).toBe(180));
  it('by m² (e.g. carpenter): quantity × rate', () =>
    expect(labourLineCost({ role: 'Tesar', quantity: 100, unit: 'm²', ratePerUnit: 8 })).toBe(800));
  it('final price overrides quantity × rate', () =>
    expect(labourLineCost({ role: 'X', quantity: 10, unit: 'day', ratePerUnit: 30, finalPriceEur: 250 })).toBe(250));
  it('final price of 0 is respected (not treated as empty)', () =>
    expect(labourLineCost({ role: 'X', quantity: 5, unit: 'day', ratePerUnit: 20, finalPriceEur: 0 })).toBe(0));

  it('labourTotal mixes unit-priced and fixed-price lines', () => {
    const out = computeCost({
      materials: [],
      labourLumpSumEur: 100,
      labourItems: [
        { role: 'Armirač', quantity: 4, unit: 'ton', ratePerUnit: 45 }, // 180 (by ton)
        { role: 'Foreman', quantity: 0, unit: 'day', ratePerUnit: 0, finalPriceEur: 500 }, // 500 (fixed)
      ],
      areaM2: null,
      salePricePerM2Eur: null,
    });
    expect(out.labourTotal).toBe(780); // 100 + 180 + 500
  });
});

describe('mkdToEur', () => {
  it('divides by the rate', () => expect(mkdToEur(6150, 61.5)).toBe(100));
  it('rate ≤ 0 ⇒ 0 (no divide-by-zero)', () => expect(mkdToEur(6150, 0)).toBe(0));
});

describe('parseDecimal — locale-aware', () => {
  it('accepts a dot', () => expect(parseDecimal('2.5')).toBe(2.5));
  it('accepts a comma', () => expect(parseDecimal('2,5')).toBe(2.5));
  it('trims and drops spaces', () => expect(parseDecimal(' 1 5 ')).toBe(15));
  it('empty ⇒ null', () => expect(parseDecimal('')).toBeNull());
  it('garbage ⇒ null', () => expect(parseDecimal('abc')).toBeNull());
  it('two separators ⇒ null', () => expect(parseDecimal('2.5.6')).toBeNull());
});
