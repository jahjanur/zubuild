import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import logo from '../assets/KAKAKAK.svg';

const navKeys = [
  'dashboard',
  'orders',
  'suppliers',
  'products',
  'createOrder',
  'reconciliation',
  'controlPanel',
  'analytics',
] as const;
const navToPath: Record<(typeof navKeys)[number], string> = {
  dashboard: 'dashboard',
  orders: 'orders',
  suppliers: 'suppliers',
  products: 'products',
  createOrder: 'create-order',
  reconciliation: 'reconciliation',
  controlPanel: 'control-panel',
  analytics: 'analytics',
};

function IconClose() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await api.post('/auth/logout');
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-3 rounded-full text-base font-medium transition min-h-[48px] ${
      isActive
        ? 'bg-app-accent text-white shadow-button'
        : 'text-app-secondary hover:text-app-primary hover:bg-slate-900/[0.04]'
    }`;

  const logoutClass =
    'w-full flex items-center gap-2 px-4 py-3 rounded-full text-base font-medium min-h-[48px] bg-transparent border border-app-danger/40 text-app-danger hover:bg-app-danger-muted transition';

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-app-bg flex">
      {/* Sidebar: desktop only (lg+). Fixed so it does NOT take layout width on any breakpoint. */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 left-0 glass z-20">
        <div className="p-4 border-b border-[var(--border)] flex flex-col items-center">
          <img src={logo} alt="Zubuild" width={120} height={120} className="h-28 w-auto object-contain" decoding="async" />
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
          {navKeys.map((key) => (
            <NavLink key={key} to={navToPath[key]} className={navLinkClass}>
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--border)]">
          <button type="button" onClick={handleLogout} className={logoutClass}>
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Content wrapper: full width on mobile (no sidebar width), offset on desktop only */}
      <div className="flex-1 flex flex-col w-full min-w-0 overflow-x-hidden lg:pl-56">
        {/* Mobile: top bar — logo left, hamburger right */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-2 glass safe-area-pt">
          <img src={logo} alt="Zubuild" width={36} height={36} className="h-9 w-auto object-contain" decoding="async" />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full text-app-secondary hover:bg-slate-900/[0.06] hover:text-app-primary transition"
            aria-label={t('nav.more')}
          >
            <IconMenu />
          </button>
        </header>

        {/* Main content — full width on mobile (no bottom nav) */}
        <main className="flex-1 w-full page-container py-4 md:py-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile: hamburger drawer (slide-over from right) */}
      {menuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div
            className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm glass shadow-modal flex flex-col safe-area-pt"
            role="dialog"
            aria-label={t('nav.more')}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <span className="text-lg font-semibold text-app-primary">{t('nav.operations')}</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-12 w-12 items-center justify-center rounded-full text-app-secondary hover:bg-slate-900/[0.06] hover:text-app-primary transition"
                aria-label={t('common.close')}
              >
                <IconClose />
              </button>
            </div>
            <nav className="overflow-y-auto p-4 space-y-0.5" aria-label="Main navigation">
              {navKeys.map((key) => (
                <NavLink
                  key={key}
                  to={`/app/${navToPath[key]}`}
                  className={navLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {t(`nav.${key}`)}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className={`${logoutClass} mt-2`}
              >
                {t('nav.logout')}
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}