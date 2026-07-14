import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'mk', label: 'Македонски' },
  { code: 'sq', label: 'Shqip' },
  { code: 'tr', label: 'Türkçe' },
] as const;

/**
 * Glass-pill language switcher. Calling i18n.changeLanguage re-renders every
 * component that uses useTranslation, so the whole app switches instantly.
 * Used in the sidebar footer, the mobile drawer, and the login screen.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} role="group" aria-label="Language">
      {LANGUAGES.map(({ code, label }) => {
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => i18n.changeLanguage(code)}
            aria-pressed={active}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              active
                ? 'bg-app-accent text-app-accent-contrast shadow-button'
                : 'glass text-app-secondary hover:bg-white/[0.06]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
