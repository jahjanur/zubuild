import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setApiErrorHandler } from '../lib/api';

export type ToastType = 'error' | 'success';

const ToastCtx = createContext<{
  message: string | null;
  type: ToastType;
  show: (m: string, t?: ToastType) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<ToastType>('error');
  const show = useCallback((m: string, t: ToastType = 'error') => {
    setMessage(m);
    setType(t);
  }, []);
  useEffect(() => {
    setApiErrorHandler((m: string) => show(m, 'error'));
  }, [show]);
  return (
    <ToastCtx.Provider value={{ message, type, show }}>
      {children}
      {message && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-modal border-2 flex items-center gap-3 min-w-[280px] max-w-md bg-app-bg text-app-primary ${
            type === 'error'
              ? 'border-app-danger'
              : 'border-app-accent'
          }`}
          role="alert"
        >
          <span className="flex-1">{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-app-secondary hover:text-app-primary hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  return ctx ?? { message: null, type: 'error' as ToastType, show: () => {} };
}
