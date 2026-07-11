import { ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      document.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handler);
        document.body.style.overflow = '';
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  const maxWidthClass = size === 'wide' ? 'sm:max-w-[80vw]' : 'sm:max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col sm:flex-row sm:items-center sm:justify-center sm:p-4 sm:bg-[var(--overlay)] sm:backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Overlay: on mobile starts below header (3.5rem) so logo stays visible */}
      <div
        className="fixed top-14 left-0 right-0 bottom-0 z-40 bg-[var(--overlay)] backdrop-blur-sm sm:absolute sm:inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`fixed left-0 right-0 top-14 bottom-0 z-50 flex flex-col w-full bg-app-surface-2 border border-[var(--border)] border-t shadow-modal sm:relative sm:top-0 sm:left-0 sm:right-0 sm:bottom-0 ${maxWidthClass} sm:max-h-[90vh] sm:rounded-xl sm:border`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)] bg-app-surface-2 shrink-0">
          <h2 id="modal-title" className="text-lg font-semibold text-app-primary min-w-0 break-words pr-2 self-center">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl text-app-secondary hover:bg-white/10 hover:text-app-primary focus-visible:ring-2 focus-visible:ring-app-gold/50"
            aria-label={t('common.close')}
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5">
          {children}
        </div>
        {footer != null && (
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-[var(--border)] bg-app-surface-2 px-4 sm:px-6 py-3 sm:py-4 safe-area-pb shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
