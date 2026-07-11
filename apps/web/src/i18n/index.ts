import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import mk from './mk.json';
import sq from './sq.json';
import tr from './tr.json';

export const SUPPORTED_LANGS = ['en', 'mk', 'sq', 'tr'] as const;
const STORAGE_KEY = 'lang';

function initialLang(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED_LANGS as readonly string[]).includes(saved)) return saved;
  } catch {
    /* localStorage unavailable (SSR / privacy mode) */
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    mk: { translation: mk },
    sq: { translation: sq },
    tr: { translation: tr },
  },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Persist the user's choice so it survives reloads.
i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
});

export default i18n;
