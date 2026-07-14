import { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg disabled:opacity-50 disabled:pointer-events-none min-h-[40px] px-4 py-2 text-sm';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-app-accent text-white shadow-button hover:bg-app-accent-hover',
  secondary: 'bg-app-surface-1 border border-[var(--border)] text-app-primary hover:bg-app-surface-subtle hover:border-app-border-strong',
  ghost: 'bg-transparent text-app-secondary hover:bg-app-surface-subtle hover:text-app-primary',
  danger: 'bg-app-danger text-white shadow-button hover:bg-red-700 focus-visible:ring-app-danger/40',
};

const sizes = {
  sm: 'min-h-[34px] px-3 py-1.5 text-[13px]',
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
  const reduce = useReducedMotion();
  return (
    <motion.button
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className={`${base} ${sizes[size]} ${variants[variant]}${className ? ' ' + className : ''}`}
      {...(props as unknown as HTMLMotionProps<'button'>)}
    >
      {children}
    </motion.button>
  );
}
