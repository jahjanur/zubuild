import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

/** Local YYYY-MM-DD (no timezone shift). */
function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseISO(s: string | undefined | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** Six Monday-first weeks covering the given month. */
function monthGrid(view: Date): Date[] {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon = 0
  const start = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

/**
 * Themed date picker — a styled trigger + a custom calendar popup (Monday-first,
 * rose-gold selection, Today/Clear). Replaces the unstyleable native
 * <input type="date">. Value is a local `YYYY-MM-DD` string (or '' when empty).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  className = '',
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => parseISO(value) ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  const selected = parseISO(value);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const grid = useMemo(() => monthGrid(view), [view]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
  }, [open]);

  const lang = i18n.language;
  const monthLabel = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(view);
  const displayValue = selected ? new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(selected) : '';
  const weekdays = useMemo(() => {
    // Mon..Sun narrow labels in the active locale.
    const fmt = new Intl.DateTimeFormat(lang, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i))); // 2024-01-01 is a Monday
  }, [lang]);

  function openCal() {
    setView(selected ?? new Date());
    setOpen(true);
  }
  function pick(d: Date) {
    onChange(toISO(d));
    setOpen(false);
  }
  function shiftMonth(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openCal())}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border bg-app-surface-1 px-3.5 min-h-[48px] text-left transition-colors border-[var(--border)] hover:border-app-border-strong focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)] ${className}`}
      >
        <span className={displayValue ? 'text-app-primary' : 'text-app-muted'}>{displayValue || placeholder}</span>
        <Calendar size={18} className="text-app-muted shrink-0" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute z-50 mt-2 w-[300px] rounded-2xl border border-[var(--border)] p-3 shadow-modal"
          style={{ background: 'var(--glass-bg-strong)' }}
        >
          {/* Month header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-app-primary capitalize">{monthLabel}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-lg text-app-secondary hover:bg-[var(--hover)] hover:text-app-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]">
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-lg text-app-secondary hover:bg-[var(--hover)] hover:text-app-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7">
            {weekdays.map((w, i) => (
              <span key={i} className="text-center text-[11px] font-semibold uppercase text-app-muted py-1">{w}</span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((day, i) => {
              const inMonth = day.getMonth() === view.getMonth();
              const isSel = !!selected && sameDay(day, selected);
              const isToday = sameDay(day, today);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(day)}
                  aria-pressed={isSel}
                  className={`h-9 rounded-lg text-sm tabular-nums transition ${
                    isSel
                      ? 'bg-app-accent text-app-accent-contrast font-semibold'
                      : inMonth
                        ? 'text-app-primary hover:bg-[var(--hover)]'
                        : 'text-app-muted/70 hover:bg-[var(--hover)]'
                  } ${isToday && !isSel ? 'ring-1 ring-inset ring-app-accent/60' : ''}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="px-2 py-1 rounded-md text-sm font-medium text-app-secondary hover:text-app-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]">
              {t('common.clear')}
            </button>
            <button type="button" onClick={() => { onChange(toISO(today)); setView(today); setOpen(false); }} className="px-2 py-1 rounded-md text-sm font-semibold text-app-accent hover:text-app-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]">
              {t('common.today')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
