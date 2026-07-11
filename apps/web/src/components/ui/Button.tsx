import { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg disabled:opacity-50 disabled:pointer-events-none disabled:transform-none min-h-[44px] px-5 py-2.5';

const variants: Record<ButtonVariant, string> = {
  // Solid black pill — matches the reference active tabs
  primary:
    'bg-app-accent text-white shadow-button hover:bg-app-accent-hover active:translate-y-0',
  // Glass pill
  secondary:
    'glass text-app-primary hover:bg-white/70',
  ghost:
    'bg-transparent border border-[var(--border)] text-app-primary hover:bg-slate-900/[0.04]',
  danger:
    'bg-app-danger-muted border border-app-danger/30 text-app-danger hover:bg-app-danger/15 focus-visible:ring-app-danger/40',
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
