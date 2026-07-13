import i18n from '../i18n';

/**
 * Display translations for the DEMO catalog. Product names & categories are
 * per-org data (typed once, stored as-is), so they normally show in whatever
 * language they were entered. For the built-in demo catalog we map the stored
 * (Albanian) value to each UI language so the demo reads natively in EN/MK/SQ/TR.
 * Anything not in these maps falls back to the raw stored value.
 */
type Lang = 'en' | 'mk' | 'sq' | 'tr';
function lang(): Lang {
  const l = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
  return (['en', 'mk', 'sq', 'tr'].includes(l) ? l : 'en') as Lang;
}

// Keyed by the stored (Albanian) value; sq falls back to the key.
const NAMES: Record<string, Partial<Record<Lang, string>>> = {
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

const CATEGORIES: Record<string, Partial<Record<Lang, string>>> = {
  'Hekur': { en: 'Steel', mk: 'Челик', tr: 'Demir' },
  'Çimento': { en: 'Cement', mk: 'Цемент', tr: 'Çimento' },
  'Agregat': { en: 'Aggregate', mk: 'Агрегат', tr: 'Agregat' },
  'Bojë': { en: 'Paint', mk: 'Боја', tr: 'Boya' },
  'Qeramikë': { en: 'Ceramics', mk: 'Керамика', tr: 'Seramik' },
  'Hekurishte': { en: 'Hardware', mk: 'Метални производи', tr: 'Hırdavat' },
  'Elektrik': { en: 'Electrical', mk: 'Електрика', tr: 'Elektrik' },
  'Hidrosanitare': { en: 'Plumbing', mk: 'Водовод', tr: 'Tesisat' },
  'Tullë': { en: 'Brick', mk: 'Тула', tr: 'Tuğla' },
  'Mermer': { en: 'Marble', mk: 'Мермер', tr: 'Mermer' },
  'Parket': { en: 'Flooring', mk: 'Паркет', tr: 'Parke' },
  'Çati': { en: 'Roofing', mk: 'Покрив', tr: 'Çatı' },
};

/** Localized display name for a product (falls back to the stored value). */
export function productName(name: string | null | undefined): string {
  if (!name) return '';
  return NAMES[name]?.[lang()] ?? name;
}

/** Localized display name for a category (falls back to the stored value). */
export function categoryName(cat: string | null | undefined): string {
  if (!cat) return '';
  return CATEGORIES[cat]?.[lang()] ?? cat;
}
