/** Minimal, dependency-free CSV builder + browser download. */

function escapeCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from a header row + a cell-getter per row. */
export function toCsv<T>(rows: T[], headers: string[], cells: (row: T) => (string | number | null | undefined)[]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(cells(row).map(escapeCell).join(','));
  return lines.join('\r\n');
}

/** Trigger a client-side download of CSV content (BOM so Excel reads UTF-8). */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
