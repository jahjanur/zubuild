import { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg disabled:opacity-50 disabled:pointer-events-none disabled:transform-none min-h-[44px] px-5 py-2.5';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-app-accent text-app-bg shadow-button hover:bg-app-accent-hover hover:-translate-y-0.5 active:translate-y-0 border border-app-accent/20',
  secondary:
    'bg-transparent border border-[var(--border)] text-app-primary hover:bg-app-surface-1 hover:border-white/15',
  ghost:
    'bg-transparent border border-app-accent/40 text-app-accent hover:bg-app-accent-muted',
  danger:
    'bg-app-danger-muted border border-app-danger/40 text-app-danger hover:bg-app-danger/20 focus-visible:ring-app-danger/50',
};

const sizes = {
  sm: 'min-h-[36px] px-3 py-1.5 text-sm',
  md: '',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]}${className ? ' ' + className : ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
