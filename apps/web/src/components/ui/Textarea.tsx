import { TextareaHTMLAttributes, forwardRef } from 'react';

const textareaBase =
  'w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-app-primary placeholder-app-muted transition border-[var(--border)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-black/10 focus:outline-none min-h-[100px] resize-y';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }
>(function Textarea({ className = '', error, ...props }, ref) {
  return (
    <div className="w-full">
      <textarea ref={ref} className={`${textareaBase} ${error ? 'border-app-danger/50' : ''} ${className}`} {...props} />
      {error && (
        <p className="mt-1.5 text-sm text-app-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
