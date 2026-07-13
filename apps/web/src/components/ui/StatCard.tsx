import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

type Tone = 'accent' | 'danger' | 'success' | 'warning' | 'neutral';

const toneClasses: Record<Tone, string> = {
  accent: 'bg-app-accent-muted text-app-accent',
  danger: 'bg-app-danger-muted text-app-danger',
  success: 'bg-app-success-muted text-app-success',
  warning: 'bg-app-warning-muted text-app-warning',
  neutral: 'bg-app-surface-subtle text-app-secondary',
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
  trend,
  accent = false,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  trend?: ReactNode;
  accent?: boolean; // legacy: color the number with the accent
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Card className={onClick ? 'cursor-pointer text-left w-full hover:shadow-card-hover' : ''}>
      <Wrapper type={onClick ? 'button' : undefined} onClick={onClick} className="block w-full text-left p-5">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${toneClasses[tone]}`}>
              <Icon size={18} strokeWidth={2} />
            </span>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-app-muted">{label}</p>
        </div>
        <p
          className={`mt-3 text-2xl md:text-[28px] leading-none font-semibold tracking-tight ${accent ? 'text-app-accent' : 'text-app-primary'}`}
          style={{ wordBreak: 'break-word' }}
        >
          {value}
        </p>
        {trend && <div className="mt-2 text-xs font-medium">{trend}</div>}
        {sub && <div className="mt-2 text-sm text-app-muted">{sub}</div>}
      </Wrapper>
    </Card>
  );
}
