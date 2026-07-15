import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

/**
 * Light/Dark theme toggle. Shows the mode it will switch TO. Styled to sit in
 * the sidebar footer; pass a className to restyle for other placements.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t('theme.light') : t('theme.dark')}
      title={isDark ? t('theme.light') : t('theme.dark')}
      className={
        className ||
        'flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-active transition-colors border border-sidebar-border'
      }
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
