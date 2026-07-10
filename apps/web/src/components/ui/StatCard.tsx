import { ReactNode } from 'react';
import { Card, CardContent } from './Card';

export function StatCard({
  label,
  value,
  sub,
  accent = false,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  accent?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Card className={`overflow-visible ${onClick ? 'cursor-pointer text-left w-full' : ''}`}>
      <CardContent className="overflow-visible min-w-0">
        <Wrapper type={onClick ? 'button' : undefined} onClick={onClick} className="block w-full text-left">
          <p className="text-sm text-app-secondary font-medium">{label}</p>
          <p
            className={`mt-1 text-2xl md:text-3xl font-semibold tracking-tight min-w-0 overflow-visible ${
              accent ? 'text-app-accent' : 'text-app-primary'
            }`}
            style={{ wordBreak: 'break-word' }}
          >
            {value}
          </p>
          {sub && <div className="mt-1 text-sm text-app-muted">{sub}</div>}
        </Wrapper>
      </CardContent>
    </Card>
  );
}
