import { useState, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, ShoppingCart, FilePlus, ClipboardCheck, Truck, Package,
  ShieldAlert, BarChart3, Users, Settings, LogOut, Menu, X, Globe, ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useOrg } from '../lib/useOrg';
import { useAuth } from '../lib/useAuth';

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
      { key: 'team', path: 'team', icon: Users },
      { key: 'account', path: 'account', icon: Settings },
    ],
  },
];

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'mk', label: 'Македонски' },
  { code: 'sq', label: 'Shqip' },
] as const;

/**
 * A-Frame monogram — reads as the letter "A" and a roofline at once. Single
 * weight strokes, indigo→violet gradient, no enclosing box. Same artwork as
 * public/favicon.svg. `id` keeps the gradient unique when several marks render.
 */
function BrandLogo({ id, size = 32 }: { id: string; size?: number }) {
  const gid = `brand-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="2" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${gid})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4.5 L4.5 26" />
        <path d="M16 4.5 L27.5 26" />
        <path d="M9.6 18 L22.4 18" />
      </g>
    </svg>
  );
}

/**
 * Sidebar brand lockup: the mark (or the org's uploaded logo) + a two-line
 * wordmark. The org name splits into a bold first word over a spaced, muted
 * second line. Links to the dashboard; brightens on hover. `collapsed` shows
 * only the centered mark for an icon-rail sidebar.
 */
function BrandLockup({
  logoUrl,
  name,
  onClick,
  collapsed = false,
}: {
  logoUrl?: string | null;
  name?: string;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  const uid = useId();
  const displayName = (name || 'Zubuild').trim();
  const [first, ...rest] = displayName.split(/\s+/);
  const second = rest.join(' ');
  return (
    <Link
      to="/app/dashboard"
      onClick={onClick}
      aria-label={`${displayName} — dashboard`}
      className={`group inline-flex items-center gap-3 min-w-0 rounded-md transition-[filter] duration-150 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${collapsed ? 'justify-center' : ''}`}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={displayName} className="h-8 w-8 rounded-lg object-contain bg-white/5 shrink-0" />
      ) : (
        <BrandLogo id={uid} size={32} />
      )}
      {!collapsed && (
        <span className="flex flex-col min-w-0 leading-none">
          <span className="text-white font-bold text-[15px] tracking-[0.12em] truncate">{first}</span>
          {second && (
            <span className="mt-[3px] text-[10px] font-medium tracking-[0.3em] uppercase text-sidebar-section truncate">{second}</span>
          )}
        </span>
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
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const roleLabel = user?.role === 'ADMIN' ? t('team.roleAdmin') : user?.role === 'MANAGER' ? t('team.roleManager') : t('team.roleViewer');
  const initials = (user?.email ?? '?').replace(/@.*/, '').slice(0, 2).toUpperCase();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 border-l-2 ${
      isActive
        ? 'bg-sidebar-active-bg text-white border-app-accent'
        : 'text-sidebar-text border-transparent hover:bg-sidebar-hover hover:text-white'
    }`;

  const NavList = ({ onNavigate, prefix = '' }: { onNavigate?: () => void; prefix?: string }) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Main navigation">
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
    <div className="p-3 border-t border-sidebar-border space-y-3">
      <div className="flex items-center gap-3 px-1">
        <span className="h-9 w-9 rounded-full bg-app-accent/90 flex items-center justify-center text-white text-xs font-semibold shrink-0">{initials}</span>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{user?.email}</p>
          <p className="text-sidebar-text text-xs">{roleLabel}</p>
        </div>
      </div>
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
        <div className="relative h-16 flex items-center px-5 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-sidebar-border after:to-transparent">
          <BrandLockup logoUrl={org?.logoUrl} name={org?.name} />
        </div>
        <NavList />
        <Footer />
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col w-full min-w-0 overflow-x-hidden lg:pl-64">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-sidebar-bg safe-area-pt">
          <BrandLockup logoUrl={org?.logoUrl} name={org?.name} />
          <button type="button" onClick={() => setMenuOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-white" aria-label={t('nav.more')}>
            <Menu size={22} />
          </button>
        </header>

        <main className="flex-1 w-full page-container py-5 md:py-7">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-app-overlay" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-full max-w-xs bg-sidebar-bg flex flex-col safe-area-pt" role="dialog" aria-label={t('nav.more')}>
            <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
              <BrandLockup logoUrl={org?.logoUrl} name={org?.name} onClick={() => setMenuOpen(false)} />
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
