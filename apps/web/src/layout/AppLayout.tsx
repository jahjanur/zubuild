import { useState, useEffect, useLayoutEffect, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Link, useNavigate, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import PageTransition, { RouteProgress } from '../components/PageTransition';
import { AemLogo } from '../components/AemLogo';
import {
  LayoutDashboard, ShoppingCart, FilePlus, ClipboardCheck, Truck, Package,
  ShieldAlert, BarChart3, Users, UserCircle, LogOut, Menu, X, Globe, ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useOrg } from '../lib/useOrg';

type NavItem = { key: string; path: string; icon: LucideIcon };
const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'sectionMain',
    items: [
      { key: 'dashboard', path: 'dashboard', icon: LayoutDashboard },
      { key: 'orders', path: 'orders', icon: ShoppingCart },
      { key: 'createOrder', path: 'create-order', icon: FilePlus },
      { key: 'reconciliation', path: 'reconciliation', icon: ClipboardCheck },
    ],
  },
  {
    section: 'sectionManagement',
    items: [
      { key: 'suppliers', path: 'suppliers', icon: Truck },
      { key: 'products', path: 'products', icon: Package },
      { key: 'controlPanel', path: 'control-panel', icon: ShieldAlert },
      { key: 'analytics', path: 'analytics', icon: BarChart3 },
    ],
  },
  {
    section: 'sectionSettings',
    items: [
      { key: 'profile', path: 'profile', icon: UserCircle },
      { key: 'team', path: 'team', icon: Users },
    ],
  },
];

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'mk', label: 'Македонски' },
  { code: 'sq', label: 'Shqip' },
] as const;

/**
 * Sidebar brand lockup: the official AEM Residence logo (white on the dark
 * sidebar), or the org's uploaded logo if one is set. Links to the dashboard
 * and brightens on hover. `collapsed` shows the standalone mark; `logoHeight`
 * sets the logo height class (smaller on the mobile bars).
 */
function BrandLockup({
  logoUrl,
  onClick,
  collapsed = false,
  logoHeight = 'h-14',
}: {
  logoUrl?: string | null;
  onClick?: () => void;
  collapsed?: boolean;
  logoHeight?: string;
}) {
  return (
    <Link
      to="/app/dashboard"
      onClick={onClick}
      aria-label="AEM Residence — dashboard"
      className="group flex justify-center rounded-md transition-[filter] duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="AEM Residence"
          loading="eager"
          className={collapsed ? 'h-9 w-9 object-contain' : `${logoHeight} w-auto max-w-[190px] object-contain`}
        />
      ) : (
        <AemLogo variant={collapsed ? 'mark' : 'full'} className={`${collapsed ? 'h-9' : logoHeight} text-white`} />
      )}
    </Link>
  );
}

function LanguageDropdown() {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
  return (
    <div className="relative">
      <Globe size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sidebar-text pointer-events-none" />
      <ChevronDown size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sidebar-text pointer-events-none" />
      <select
        aria-label="Language"
        value={current}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="w-full appearance-none bg-sidebar-hover text-white text-sm rounded-lg pl-8 pr-8 py-2 min-h-[40px] border border-sidebar-border hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] cursor-pointer"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} className="bg-sidebar-bg text-white">{l.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const org = useOrg();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const outlet = useOutlet();

  // Scroll the content area to the top on every route change, before the enter
  // animation runs — so a new page never opens scrolled halfway down.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  async function handleLogout() {
    await api.post('/auth/logout');
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [menuOpen]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 border-l-2 ${
      isActive
        ? 'bg-sidebar-active-bg text-white border-app-accent'
        : 'text-sidebar-text border-transparent hover:bg-sidebar-hover hover:text-white'
    }`;

  const NavList = ({ onNavigate, prefix = '' }: { onNavigate?: () => void; prefix?: string }) => (
    <nav className="flex-1 overflow-y-auto px-3 pt-5 pb-4 space-y-6" aria-label="Main navigation">
      {NAV.map((grp) => (
        <div key={grp.section}>
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-section">{t(`nav.${grp.section}`)}</p>
          <div className="space-y-0.5">
            {grp.items.map(({ key, path, icon: Icon }) => (
              <NavLink key={key} to={`${prefix}${path}`} className={linkClass} onClick={onNavigate}>
                <Icon size={18} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{t(`nav.${key}`)}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const Footer = () => (
    <div className="p-3 border-t border-sidebar-border space-y-2">
      <LanguageDropdown />
      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[40px] text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors"
      >
        <LogOut size={16} /> {t('nav.logout')}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-app-bg flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 left-0 bg-sidebar-bg z-20">
        <div className="relative flex items-center justify-center px-4 pt-4 pb-5 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/[0.06] after:to-transparent">
          <BrandLockup logoUrl={org?.logoUrl} />
        </div>
        <NavList />
        <Footer />
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col w-full min-w-0 overflow-x-hidden lg:pl-64">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-sidebar-bg safe-area-pt">
          <BrandLockup logoUrl={org?.logoUrl} logoHeight="h-9" />
          <button type="button" onClick={() => setMenuOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-white" aria-label={t('nav.more')}>
            <Menu size={22} />
          </button>
        </header>

        {/* Only the content area transitions; the sidebar/top bar stay static.
            mode="wait" keeps a single page mounted at a time — no overlap, no
            double scrollbar, and fast repeated nav resolves to the latest. */}
        <main className="relative flex-1 w-full page-container py-5 md:py-7">
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Suspense fallback={<RouteProgress />}>{outlet}</Suspense>
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-app-overlay" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-full max-w-xs bg-sidebar-bg flex flex-col safe-area-pt" role="dialog" aria-label={t('nav.more')}>
            <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
              <BrandLockup logoUrl={org?.logoUrl} logoHeight="h-9" onClick={() => setMenuOpen(false)} />
              <button type="button" onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-white" aria-label={t('common.close')}>
                <X size={22} />
              </button>
            </div>
            <NavList onNavigate={() => setMenuOpen(false)} prefix="/app/" />
            <Footer />
          </div>
        </>
      )}
    </div>
  );
}
