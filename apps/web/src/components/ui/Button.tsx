import { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg disabled:opacity-50 disabled:pointer-events-none disabled:transform-none min-h-[44px] px-5 py-2.5';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-app-accent text-white rounded-full shadow-button hover:bg-app-accent-hover active:translate-y-px',
  secondary:
    'glass text-app-primary rounded-full hover:bg-white/70',
  ghost:
    'bg-transparent border border-[var(--border)] text-app-primary rounded-full hover:bg-slate-900/[0.04]',
  danger:
    'bg-app-danger-muted border border-app-danger/40 text-app-danger rounded-full hover:bg-app-danger/20 focus-visible:ring-app-danger/50',
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
