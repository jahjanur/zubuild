import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const EASE = [0.25, 0.1, 0.25, 1] as const;
const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'default',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** 'default' = max-w-lg, 'wide' = 80% viewport width */
  size?: 'default' | 'wide';
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Remember the trigger so focus can return to it on close.
    triggerRef.current = document.activeElement as HTMLElement | null;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const f = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);

    // Lock body scroll and compensate the scrollbar width so nothing shifts.
    const scrollComp = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollComp > 0) document.body.style.paddingRight = `${scrollComp}px`;

    // Move focus into the dialog.
    const focusTimer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
      window.clearTimeout(focusTimer);
      // Return focus to whatever opened the modal.
      triggerRef.current?.focus?.();
    };
  }, [open, onClose]);

  const maxWidthClass = size === 'wide' ? 'sm:max-w-[80vw]' : 'sm:max-w-lg';

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="modal" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <motion.div
            className="absolute inset-0 modal-backdrop"
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
            transition={{ duration: reduce ? 0 : 0.15 }}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className={`modal-panel relative z-[101] flex flex-col w-full ${maxWidthClass} max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl focus:outline-none`}
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, transition: { duration: 0.12, ease: EASE } }}
            transition={{ duration: reduce ? 0 : 0.18, ease: EASE }}
          >
            <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-[var(--border)] shrink-0">
              <h2 id="modal-title" className="text-lg font-semibold text-app-primary min-w-0 break-words pr-2 self-center">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-app-secondary hover:bg-white/[0.08] hover:text-app-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                aria-label={t('common.close')}
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 sm:py-5 scroll-thin">
              {children}
            </div>
            {footer != null && (
              <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border)] px-5 sm:px-6 py-4 safe-area-pb shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
