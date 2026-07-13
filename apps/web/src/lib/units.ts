import i18n from '../i18n';

/**
 * Localized label for a measurement unit code (kg, adet, torba, …). The code is
 * the stored value (a fixed enum); this translates only its DISPLAY, so units
 * follow the UI language. Unknown codes fall back to the raw value.
 */
export function unitLabel(code: string | null | undefined): string {
  if (!code) return '';
  return i18n.t(`units.${code}`, { defaultValue: code });
}
