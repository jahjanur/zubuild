type Variant = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'outline';

const variants: Record<Variant, string> = {
  default: 'bg-app-surface-subtle text-app-secondary border border-[var(--border)]',
  success: 'bg-app-success-muted text-app-success',
  warning: 'bg-app-warning-muted text-app-warning',
  danger: 'bg-app-danger-muted text-app-danger',
  accent: 'bg-app-accent-muted text-app-accent',
  outline: 'border border-[var(--border-strong)] text-app-secondary',
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
