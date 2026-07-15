import React, { SelectHTMLAttributes, forwardRef, useRef, useState, useEffect, useId } from 'react';

const selectTriggerBase =
  'w-full rounded-xl border bg-app-surface-1 px-4 py-3 text-left text-app-primary transition border-[var(--border)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:outline-none min-h-[48px] flex items-center justify-between gap-2';

function getOptionsFromChildren(children: React.ReactNode): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  React.Children.forEach(children, (child) => {
    if (child && typeof child === 'object' && 'props' in child) {
      const c = child as React.ReactElement<{ value?: string; children?: React.ReactNode }>;
      if (c.props?.value !== undefined) {
        options.push({
          value: String(c.props.value),
          label: typeof c.props.children === 'string' ? c.props.children : String(c.props.value),
        });
      }
    }
  });
  return options;
}

const Chevron = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-app-muted" aria-hidden>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { error?: string }
>(function Select({ className = '', error, children, value, onChange, id: propId, ...props }, ref) {
  const internalRef = useRef<HTMLSelectElement>(null);
  const mergedRef = (node: HTMLSelectElement | null) => {
    (internalRef as React.MutableRefObject<HTMLSelectElement | null>).current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = node;
  };

  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const id = propId ?? generatedId;
  const listId = `${id}-list`;

  const options = getOptionsFromChildren(children);
  const useNativeSelect = options.length === 0;
  const currentValue = value !== undefined ? String(value) : (internalRef.current?.value ?? '');
  const selectedOption = options.find((o) => o.value === currentValue) ?? options[0];
  const displayLabel = selectedOption?.label ?? currentValue ?? '';

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (internalRef.current?.parentElement?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  function handleSelect(val: string) {
    if (internalRef.current) {
      internalRef.current.value = val;
      onChange?.({ target: internalRef.current } as React.ChangeEvent<HTMLSelectElement>);
    }
    setOpen(false);
  }

  if (useNativeSelect) {
    return (
      <div className="w-full relative">
        <select
          ref={ref as React.Ref<HTMLSelectElement>}
          id={id}
          className={`w-full rounded-xl border bg-app-surface-1 px-4 py-3 text-app-primary text-base min-h-[48px] border-[var(--border)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:outline-none appearance-none bg-no-repeat bg-[length:1.25rem] bg-[right_0.75rem_center] pr-10 ${error ? 'border-app-danger/50' : ''} ${className}`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          }}
          value={value}
          onChange={onChange}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1.5 text-sm text-app-danger" role="alert">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full relative">
      <select
        ref={mergedRef}
        id={id}
        value={value}
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        {...props}
      >
        {children}
      </select>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${selectTriggerBase} ${error ? 'border-app-danger/50' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={id}
        aria-controls={listId}
      >
        <span className="truncate">{displayLabel}</span>
        <Chevron />
      </button>
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="glass absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl py-1 shadow-modal"
          style={{ background: 'var(--glass-bg-strong)' }}
          aria-labelledby={id}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === currentValue}
              onClick={() => handleSelect(opt.value)}
              className="min-h-[48px] flex items-center px-4 py-3 text-base text-app-primary cursor-pointer hover:bg-[var(--hover)] focus:bg-app-surface-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-inset"
            >
              {opt.value === currentValue && (
                <span className="mr-2 text-app-accent" aria-hidden>✓</span>
              )}
              {opt.label}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-1.5 text-sm text-app-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
