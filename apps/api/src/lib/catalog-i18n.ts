/**
 * Display translations for the DEMO catalog, backend copy.
 * MUST MATCH apps/web/src/lib/catalog.ts — product names are per-org DATA stored
 * as-is (Albanian in the demo seed), so the PDF maps the stored value to the
 * requested language exactly like the app does on screen. Anything not in the
 * map falls back to the raw stored value (real user-added products).
 */
export type CatalogLang = 'en' | 'mk' | 'sq' | 'tr';

export function normalizeLang(l: string | null | undefined): CatalogLang {
  const base = (l ?? 'en').split('-')[0];
  return (['en', 'mk', 'sq', 'tr'].includes(base) ? base : 'en') as CatalogLang;
}

// Keyed by the stored (Albanian) value; sq falls back to the key.
const NAMES: Record<string, Partial<Record<CatalogLang, string>>> = {
  'Hekur 12mm': { en: 'Rebar 12mm', mk: 'Арматура 12мм', tr: 'Demir 12mm' },
  'Hekur 8mm': { en: 'Rebar 8mm', mk: 'Арматура 8мм', tr: 'Demir 8mm' },
  'Çimento 50kg': { en: 'Cement 50kg', mk: 'Цемент 50кг', tr: 'Çimento 50kg' },
  'Rërë ndërtimi': { en: 'Construction sand', mk: 'Градежен песок', tr: 'İnşaat kumu' },
  'Bojë e bardhë 15L': { en: 'White paint 15L', mk: 'Бела боја 15Л', tr: 'Beyaz boya 15L' },
  'Bojë me bazë uji': { en: 'Water-based paint', mk: 'Боја на водена база', tr: 'Su bazlı boya' },
  'Pllakë 30x30': { en: 'Tile 30x30', mk: 'Плочка 30x30', tr: 'Fayans 30x30' },
  'Gozhdë 3"': { en: 'Nail 3"', mk: 'Клинец 3"', tr: 'Çivi 3"' },
  'Kabull 3x2.5': { en: 'Cable 3x2.5', mk: 'Кабел 3x2.5', tr: 'Kablo 3x2.5' },
  'Tub PVC 50mm': { en: 'PVC pipe 50mm', mk: 'ПВЦ цевка 50мм', tr: 'PVC boru 50mm' },
  'Tullë': { en: 'Brick', mk: 'Тула', tr: 'Tuğla' },
  'Gëlqere 25kg': { en: 'Lime 25kg', mk: 'Вар 25кг', tr: 'Kireç 25kg' },
  'Pllakë mermeri': { en: 'Marble slab', mk: 'Мермерна плоча', tr: 'Mermer plaka' },
  'Parket laminat': { en: 'Laminate flooring', mk: 'Ламинат паркет', tr: 'Laminat parke' },
  'Tjegull çatie': { en: 'Roof tile', mk: 'Ќерамида', tr: 'Çatı kiremiti' },
};

/** Localized display name for a product (falls back to the stored value). */
export function productLabel(name: string | null | undefined, lang: CatalogLang): string {
  if (!name) return '';
  return NAMES[name]?.[lang] ?? name;
}
