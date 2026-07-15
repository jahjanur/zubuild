import type { ReactNode } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  /** An icon node (e.g. a lucide icon) shown in a soft circle above the title. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary next action — renders an accent button. */
  action?: { label: string; onClick: () => void; icon?: ReactNode };
  /** Tighter spacing for inline/card placements (charts, small panels). */
  compact?: boolean;
  className?: string;
}

/**
 * Designed empty state: icon + title + subtext + optional primary CTA. Use it
 * wherever a list can be empty so the user gets a clear next action instead of
 * a bare line of text. Theme-aware (light + dark) via design tokens.
 */
export function EmptyState({ icon, title, description, action, compact = false, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 text-center ${compact ? 'py-8' : 'py-14'} ${className}`}>
      {icon && (
        <div
          className={`mb-4 flex items-center justify-center rounded-full bg-app-surface-subtle text-app-muted ${
            compact ? 'h-12 w-12' : 'h-16 w-16'
          }`}
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-app-primary">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-app-secondary">{description}</p>}
      {action && (
        <Button type="button" onClick={action.onClick} className="mt-5 min-h-[44px]">
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
}
