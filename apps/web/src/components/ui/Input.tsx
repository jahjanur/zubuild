import { InputHTMLAttributes, forwardRef } from 'react';

const inputBase =
  'w-full rounded-lg border bg-app-surface-1 px-3.5 py-2.5 text-app-primary placeholder-app-muted transition-colors duration-150 border-[var(--border)] hover:border-app-border-strong focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:outline-none min-h-[40px]';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(function Input({ className = '', error, ...props }, ref) {
  return (
    <div className="w-full">
      <input ref={ref} className={`${inputBase} ${error ? 'border-app-danger/60' : ''} ${className}`} {...props} />
      {error && (
        <p className="mt-1.5 text-sm text-app-danger" role="alert">{error}</p>
      )}
    </div>
  );
});
