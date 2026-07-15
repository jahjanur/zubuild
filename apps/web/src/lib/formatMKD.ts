/**
 * Locale-aware number / date / currency formatting.
 *
 * The BCP-47 locale is derived from the active i18n language, so numbers and
 * dates re-render in the chosen language (components that call these already
 * re-render on languageChanged via useTranslation). No hard-coded tr-TR.
 */
import i18n from '../i18n';

// App language -> BCP-47 locale. en uses en-GB (day-first, European context;
// the business runs in North Macedonia / MKD).
const LOCALE_BY_LANG: Record<string, string> = {
  en: 'en-GB',
  mk: 'mk',
  sq: 'sq',
  tr: 'tr-TR',
};

function activeLocale(): string {
  const lang = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
  return LOCALE_BY_LANG[lang] ?? 'en-GB';
}

// Cache formatters per (locale + options) — cheap and keeps output reactive.
const numberCache = new Map<string, Intl.NumberFormat>();
function numberFormat(opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = activeLocale();
  const key = locale + '|' + JSON.stringify(opts);
  let fmt = numberCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, opts);
    numberCache.set(key, fmt);
  }
  return fmt;
}

const dateCache = new Map<string, Intl.DateTimeFormat>();
function dateFormat(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = activeLocale();
  const key = locale + '|' + JSON.stringify(opts);
  let fmt = dateCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    dateCache.set(key, fmt);
  }
  return fmt;
}

// Per-organization currency (ISO 4217), set once from /auth/me after login.
// Locale still follows the active UI language (above); only the currency is
// org-specific. Formatters are cached per (locale + options), and options
// include the currency, so switching currency just uses a different cache key.
let orgCurrency = 'MKD';

/** Set the active org's currency. No-op if unchanged. */
export function setOrgCurrency(code: string | null | undefined): void {
  if (code) orgCurrency = code;
}

const PLAIN_INTEGER: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

/** Format a number in the org's currency + active locale (e.g. "1.234 ден.", "€1,234"). */
export function formatMKD(value: number): string {
  return numberFormat({
    style: 'currency',
    currency: orgCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a number with a plain currency-code suffix (e.g. "120.000 MKD"). */
export function formatMKDPlain(value: number): string {
  return `${numberFormat(PLAIN_INTEGER).format(value)} ${orgCurrency}`;
}

/** Format euros with 2 decimals in the active locale (e.g. "€3,600.00" / "3.600,00 €"). */
export function formatEUR(value: number): string {
  return numberFormat({
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a percentage with `digits` decimals in the active locale (e.g. "34.7%"). */
export function formatPercent(value: number, digits = 1): string {
  return `${numberFormat({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}%`;
}

/** Format an arbitrary number in the active locale. */
export function formatNumber(value: number, opts: Intl.NumberFormatOptions = {}): string {
  return numberFormat(opts).format(value);
}

/** Format a date in the active locale (default: medium date). */
export function formatDate(
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return dateFormat(opts).format(new Date(value));
}

/** Format a date + time in the active locale (default: medium date, short time). */
export function formatDateTime(
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return dateFormat(opts).format(new Date(value));
}
