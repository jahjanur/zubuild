import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Truck, Package, ShoppingCart, CornerDownLeft } from 'lucide-react';
import { api } from '../lib/api';
import { productName, categoryName } from '../lib/catalog';
import { unitLabel } from '../lib/units';

interface SearchResults {
  suppliers: Array<{ id: string; companyName: string; contactPerson: string | null; location: string | null; status: string }>;
  products: Array<{ id: string; name: string; category: string; measurementUnit: string; price: number; status: string }>;
  orders: Array<{ id: string; orderNumber: string; supplierName: string; status: string; totalAmount: number; orderDate: string }>;
}

type EntityType = 'supplier' | 'product' | 'order';
interface FlatResult {
  key: string;
  type: EntityType;
  label: string;
  sub: string;
  href: string;
}

const ICONS: Record<EntityType, typeof Truck> = { supplier: Truck, product: Package, order: ShoppingCart };

/**
 * Command palette: cross-entity search over suppliers, products and orders.
 * Opened by ⌘K / Ctrl+K or the top-bar / header triggers; selecting a result
 * links to the relevant page pre-filtered to that item.
 */
export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);

  // Global shortcut to open the palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpenChange]);

  // Reset + focus when opening/closing.
  useEffect(() => {
    if (open) {
      setActive(0);
      const id = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(id);
    }
    setQ('');
    setDebounced('');
  }, [open]);

  // Debounce the query.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(id);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.get<SearchResults>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length >= 2,
    staleTime: 10_000,
  });
  const results = data?.data;

  const flat: FlatResult[] = useMemo(() => {
    if (!results) return [];
    const list: FlatResult[] = [];
    for (const s of results.suppliers)
      list.push({ key: 's' + s.id, type: 'supplier', label: s.companyName, sub: [s.contactPerson, s.location].filter(Boolean).join(' · '), href: `/app/suppliers?q=${encodeURIComponent(s.companyName)}` });
    for (const p of results.products)
      list.push({ key: 'p' + p.id, type: 'product', label: productName(p.name), sub: `${categoryName(p.category)} · ${unitLabel(p.measurementUnit)}`, href: `/app/products?q=${encodeURIComponent(p.name)}` });
    for (const o of results.orders)
      list.push({ key: 'o' + o.id, type: 'order', label: o.orderNumber, sub: o.supplierName, href: `/app/orders?q=${encodeURIComponent(o.orderNumber)}` });
    return list;
  }, [results]);

  useEffect(() => setActive(0), [flat.length, debounced]);

  // Keep the active row in view.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function select(item: FlatResult) {
    onOpenChange(false);
    navigate(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) select(flat[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  }

  if (!open) return null;

  const showEmpty = debounced.length >= 2 && !isFetching && flat.length === 0;
  const groups: Array<{ type: EntityType; label: string }> = [
    { type: 'supplier', label: t('nav.suppliers') },
    { type: 'product', label: t('nav.products') },
    { type: 'order', label: t('nav.orders') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={t('search.title')}>
      <div className="modal-backdrop absolute inset-0 cmd-fade" onClick={() => onOpenChange(false)} aria-hidden />
      <div className="cmd-pop relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--glass-bg-strong)] shadow-modal">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
          <Search size={18} className="shrink-0 text-app-muted" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            className="w-full bg-transparent py-4 text-[15px] text-app-primary placeholder-app-muted focus:outline-none"
          />
          {isFetching && debounced.length >= 2 && (
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-app-muted border-t-transparent" aria-hidden />
          )}
        </div>

        <div ref={listRef} className="max-h-[56vh] min-h-[132px] overflow-y-auto scroll-thin p-2">
          {debounced.length < 2 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-9 text-center">
              <Search size={20} className="text-app-muted opacity-50" />
              <p className="text-sm text-app-muted">{t('search.hint')}</p>
            </div>
          ) : showEmpty ? (
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-9 text-center">
              <p className="text-sm font-medium text-app-primary">{t('search.noResults')}</p>
              <p className="text-xs text-app-muted">{t('search.noResultsHint')}</p>
            </div>
          ) : (
            groups.map((g) => {
              const items = flat.filter((r) => r.type === g.type);
              if (items.length === 0) return null;
              const Icon = ICONS[g.type];
              return (
                <div key={g.type} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-app-muted">{g.label}</p>
                  {items.map((r) => {
                    const idx = flat.indexOf(r);
                    const isActive = idx === active;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        data-idx={idx}
                        onMouseMove={() => setActive(idx)}
                        onClick={() => select(r)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                          isActive ? 'bg-app-accent-muted' : 'hover:bg-app-surface-subtle'
                        }`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-subtle text-app-secondary">
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-app-primary">{r.label}</span>
                          {r.sub && <span className="block truncate text-xs text-app-muted">{r.sub}</span>}
                        </span>
                        {isActive && <CornerDownLeft size={14} className="shrink-0 text-app-muted" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard legend */}
        <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-app-muted">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> {t('search.navigate')}</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> {t('search.open')}</span>
          <span className="flex items-center gap-1.5"><Kbd>esc</Kbd> {t('search.close')}</span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded border border-[var(--border)] bg-app-surface-1 px-1 py-0.5 text-[10px] font-medium text-app-secondary">
      {children}
    </kbd>
  );
}
