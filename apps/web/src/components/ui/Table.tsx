import { ReactNode } from 'react';

export function Table({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className={`w-full text-left text-sm ${className}`}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[var(--border)] bg-app-surface-2 text-app-primary">
        {children}
      </tr>
    </thead>
  );
}

export function TableHead({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 font-semibold text-app-primary whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)] transition ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className = '',
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={`px-4 py-3 text-app-secondary ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

/** Icon button for table actions — 44px touch target for mobile */
export function TableActionButton({
  onClick,
  'aria-label': ariaLabel,
  children,
  className = '',
}: {
  onClick: () => void;
  'aria-label': string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-app-secondary hover:bg-[var(--hover)] hover:text-app-primary focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${className}`}
    >
      {children}
    </button>
  );
}
