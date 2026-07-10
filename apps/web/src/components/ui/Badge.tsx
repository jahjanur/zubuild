type Variant = 'default' | 'success' | 'warning' | 'danger' | 'outline';

const variants: Record<Variant, string> = {
  default: 'bg-slate-900/[0.06] text-app-secondary border border-[var(--border)]',
  success: 'bg-app-success-muted text-app-success border border-app-success/30',
  warning: 'bg-app-warning-muted text-app-warning border border-app-warning/30',
  danger: 'bg-app-danger-muted text-app-danger border border-app-danger/30',
  outline: 'border border-slate-900/15 text-app-secondary',
};

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
