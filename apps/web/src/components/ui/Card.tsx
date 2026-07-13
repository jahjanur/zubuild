import { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-app-surface-1 rounded-card border border-[var(--border)] shadow-card transition-shadow duration-150 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      onClick={onClick}
      className={`px-5 md:px-6 py-4 border-b border-[var(--border)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 md:p-6 ${className}`}>{children}</div>;
}
