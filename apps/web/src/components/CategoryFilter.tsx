import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

export interface CategoryFilterProps {
  /** Raw category values, already sorted for display. */
  categories: string[];
  /** Raw category value → number of products in it. */
  counts: Record<string, number>;
  /** Count shown next to the "All" option. */
  total: number;
  /** Currently selected raw value; '' means "All". */
  value: string;
  onChange: (value: string) => void;
  /** Maps a raw category value to its display label (e.g. localized name). */
  labelFor: (raw: string) => string;
  allLabel: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  /** Accessible label for the option group. */
  ariaLabel: string;
  /**
   * 'rail' — a vertical list (desktop, beside the product grid).
   * 'menu' — a trigger button that opens a searchable dropdown (mobile).
   */
  layout: 'rail' | 'menu';
}

/**
 * A searchable, scalable category filter. The search box narrows the list of
 * *categories* (not products); selecting one calls onChange with the raw value
 * ('' for "All"). Renders as a vertical rail on desktop or a dropdown on mobile.
 */
export function CategoryFilter({
  categories,
  counts,
  total,
  value,
  onChange,
  labelFor,
  allLabel,
  searchPlaceholder,
  noResultsLabel,
  ariaLabel,
  layout,
}: CategoryFilterProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      q
        ? categories.filter((c) => labelFor(c).toLowerCase().includes(q) || c.toLowerCase().includes(q))
        : categories,
    [categories, q, labelFor]
  );

  // Mobile dropdown: close on outside click or Escape.
  useEffect(() => {
    if (layout !== 'menu' || !open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [layout, open]);

  function pick(v: string) {
    onChange(v);
    if (layout === 'menu') {
      setOpen(false);
      setQuery('');
    }
  }

  const searchBox = (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="w-full rounded-lg border border-[var(--border)] bg-app-surface-1 pl-9 pr-8 py-2 text-sm text-app-primary min-h-[40px] focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)]"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          aria-label={allLabel}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-app-muted hover:bg-[var(--hover)] hover:text-app-primary"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );

  const option = (key: string, label: string, count: number, active: boolean) => (
    <li key={key || '__all__'}>
      <button
        type="button"
        onClick={() => pick(key)}
        aria-pressed={active}
        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
          active
            ? 'bg-app-accent text-app-accent-contrast font-semibold'
            : 'text-app-secondary hover:bg-app-surface-subtle hover:text-app-primary'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ${
            active ? 'bg-black/10 text-app-accent-contrast' : 'bg-app-surface-subtle text-app-muted'
          }`}
        >
          {count}
        </span>
      </button>
    </li>
  );

  const list = (
    <ul className="space-y-0.5 p-2" role="group" aria-label={ariaLabel}>
      {!q && option('', allLabel, total, value === '')}
      {shown.length === 0 ? (
        <li className="px-2.5 py-3 text-xs text-app-muted">{noResultsLabel}</li>
      ) : (
        shown.map((c) => option(c, labelFor(c), counts[c] ?? 0, value === c))
      )}
    </ul>
  );

  if (layout === 'rail') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-[var(--border)] p-2">{searchBox}</div>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">{list}</div>
      </div>
    );
  }

  // Mobile dropdown.
  const triggerLabel = value ? labelFor(value) : allLabel;
  const triggerCount = value ? counts[value] ?? 0 : total;
  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-app-surface-1 px-3.5 min-h-[48px] text-sm text-app-primary transition hover:border-app-border-strong"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{triggerLabel}</span>
          <span className="shrink-0 rounded-full bg-app-surface-subtle px-1.5 py-0.5 text-xs text-app-muted tabular-nums">
            {triggerCount}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-app-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--glass-bg-strong)] shadow-modal">
          <div className="border-b border-[var(--border)] p-2">{searchBox}</div>
          <div className="max-h-64 overflow-y-auto scroll-thin">{list}</div>
        </div>
      )}
    </div>
  );
}
