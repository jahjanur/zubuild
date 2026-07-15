import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { toCsv, downloadCsv } from '../../lib/csv';

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  /** Sort/CSV value when it can't be read from render output. */
  value?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  /** CSV cell override (defaults to value()). */
  csv?: (row: T) => string | number;
  /** Plain-text header for the CSV file (defaults to `key`). */
  csvHeader?: string;
  className?: string;
  headerClassName?: string;
}

export interface BulkAction<T> {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: (rows: T[]) => void;
  danger?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  pageSize?: number;
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  /** Enables the "Export CSV" toolbar button; used as the file name. */
  csvFilename?: string;
  onRowClick?: (row: T) => void;
  /** Page-specific filters/search shown on the left of the toolbar. */
  toolbar?: ReactNode;
  emptyState?: ReactNode;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * Config-driven table: sortable columns, sticky header, client-side pagination,
 * row selection with a bulk-action bar, and CSV export. Sorting/paging/selection
 * are all client-side over the `data` you pass (filter it upstream).
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  initialSort,
  pageSize = 10,
  selectable = false,
  bulkActions = [],
  csvFilename,
  onRowClick,
  toolbar,
  emptyState,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sortCol = sort ? columns.find((c) => c.key === sort.key) : undefined;
  const sorted = useMemo(() => {
    if (!sortCol) return data;
    const val = (row: T): string | number => (sortCol.value ? sortCol.value(row) : '');
    const dir = sort!.dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [data, sortCol, sort]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * size;
  const pageRows = sorted.slice(start, start + size);

  function toggleSort(col: Column<T>) {
    if (!col.sortable) return;
    setSort((s) => {
      if (!s || s.key !== col.key) return { key: col.key, dir: 'asc' };
      if (s.dir === 'asc') return { key: col.key, dir: 'desc' };
      return null; // third click clears sort
    });
  }

  const allIds = useMemo(() => sorted.map(getRowId), [sorted, getRowId]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }
  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const selectedRows = useMemo(() => sorted.filter((r) => selected.has(getRowId(r))), [sorted, selected, getRowId]);

  function exportCsv(rows: T[]) {
    const cols = columns.filter((c) => c.csv || c.value);
    const headers = cols.map((c) => c.csvHeader ?? c.key);
    const content = toCsv(rows, headers, (row) => cols.map((c) => (c.csv ? c.csv(row) : c.value ? c.value(row) : '')));
    downloadCsv(csvFilename ?? 'export', content);
  }

  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(toolbar || csvFilename) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {csvFilename && (
            <button
              type="button"
              onClick={() => exportCsv(sorted)}
              disabled={total === 0}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-app-surface-1 px-3.5 py-2 text-sm font-medium text-app-primary transition hover:bg-app-surface-subtle disabled:opacity-50"
            >
              <Download size={16} /> {t('table.export')}
            </button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectable && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-app-accent/30 bg-app-accent-muted px-3 py-2">
          <span className="text-sm font-medium text-app-primary">{t('table.selected', { count: selected.size })}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkActions.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => a.onClick(selectedRows)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  a.danger
                    ? 'text-app-danger hover:bg-app-danger-muted'
                    : 'text-app-primary hover:bg-app-surface-subtle'
                }`}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
            {csvFilename && (
              <button type="button" onClick={() => exportCsv(selectedRows)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-app-primary transition hover:bg-app-surface-subtle">
                <Download size={15} /> {t('table.exportSelected')}
              </button>
            )}
            <button type="button" onClick={() => setSelected(new Set())} aria-label={t('table.clear')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-app-secondary transition hover:bg-app-surface-subtle">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="max-h-[65vh] overflow-auto rounded-xl border border-[var(--border)] scroll-thin">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--border)] bg-app-surface-2">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    aria-label={t('table.selectAll')}
                    className="h-4 w-4 accent-[var(--accent)] align-middle"
                  />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`px-4 py-3 font-semibold text-app-primary whitespace-nowrap ${alignClass[c.align ?? 'left']} ${c.headerClassName ?? ''}`}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c)}
                        className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'flex-row-reverse' : ''} hover:text-app-accent`}
                      >
                        {c.header}
                        <span className="text-app-muted">
                          {active ? (sort!.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronUp size={14} className="opacity-30" />}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-0">
                  {emptyState ?? <p className="py-10 text-center text-sm text-app-muted">{t('table.noRows')}</p>}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const id = getRowId(row);
                const isSel = selected.has(id);
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-[var(--border)] last:border-0 transition ${isSel ? 'bg-app-accent-muted' : 'hover:bg-[var(--hover)]'} ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {selectable && (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleRow(id)}
                          aria-label={t('table.selectRow')}
                          className="h-4 w-4 accent-[var(--accent)] align-middle"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 text-app-secondary ${alignClass[c.align ?? 'left']} ${c.className ?? ''}`}>
                        {c.render ? c.render(row) : c.value ? String(c.value(row)) : null}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-app-secondary sm:flex-row">
          <div className="flex items-center gap-2">
            <span>{t('table.rowsPerPage')}</span>
            <select
              value={size}
              onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
              className="rounded-lg border border-[var(--border)] bg-app-surface-1 px-2 py-1 text-app-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
            >
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="tabular-nums">{t('table.pageInfo', { from: total === 0 ? 0 : start + 1, to: Math.min(start + size, total), total })}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(Math.max(0, clampedPage - 1))} disabled={clampedPage === 0} aria-label={t('table.prev')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-app-primary transition hover:bg-app-surface-subtle disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => setPage(Math.min(pageCount - 1, clampedPage + 1))} disabled={clampedPage >= pageCount - 1} aria-label={t('table.next')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-app-primary transition hover:bg-app-surface-subtle disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
