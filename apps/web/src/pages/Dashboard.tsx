import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { ShoppingCart, TrendingDown, Clock, Truck, Package, FilePlus, ClipboardCheck, ArrowRight, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { StatCard, Card, CardHeader, CardContent, Modal, Button, Badge } from '../components/ui';
import { formatMKD, formatDate } from '../lib/formatMKD';
import { unitLabel } from '../lib/units';

interface Overview {
  totalSuppliers: number; totalProducts: number; pendingOrders: number; totalLosses: number;
  lowStockCount?: number; totalOrdersAmountMkd?: number; totalOrdersCount?: number;
}
interface ReconItem { id: string; name: string; unit: string; missingQty: number; lossValue: number; }
interface RecentRecon {
  id: string; reconciliationDate: string; totalLossValue: number;
  order: { orderNumber: string; supplierName: string }; items: ReconItem[];
}
interface MonthlyLoss { month: string; total: number; }

function missingSummary(items: ReconItem[]): string {
  const missing = items.filter((i) => i.missingQty > 0);
  return missing.length ? missing.map((i) => `${i.name}: -${i.missingQty} ${unitLabel(i.unit)}`).join(', ') : '';
}

const AV_COLORS = ['#4F46E5', '#0891B2', '#059669', '#D97706', '#DB2777', '#7C3AED'];
function avatar(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = AV_COLORS[h % AV_COLORS.length];
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  return { color, initials };
}

const chartTooltip = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '6px 10px' };

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ['analytics', 'overview'], queryFn: () => api.get<Overview>('/analytics/overview') });
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['reconciliations', 'recent'],
    queryFn: () => api.get<RecentRecon[]>('/reconciliations/recent?limit=5&onlyWithDiscrepancies=true'),
  });
  const { data: monthlyData } = useQuery({ queryKey: ['analytics', 'monthly-loss'], queryFn: () => api.get<MonthlyLoss[]>('/analytics/monthly-loss?months=6') });

  const s = data?.data ?? { totalSuppliers: 0, totalProducts: 0, pendingOrders: 0, totalLosses: 0, lowStockCount: 0, totalOrdersAmountMkd: 0, totalOrdersCount: 0 };
  const recent = recentData?.data ?? [];
  const selected = recent.find((r) => r.id === detailId);

  const monthly = (monthlyData?.data ?? []).map((m) => ({ label: m.month.slice(5), total: Number(m.total) }));
  const bySupplier = Object.values(
    recent.reduce((acc: Record<string, { supplier: string; loss: number }>, r) => {
      const k = r.order.supplierName;
      acc[k] = acc[k] ?? { supplier: k, loss: 0 };
      acc[k].loss += Number(r.totalLossValue);
      return acc;
    }, {})
  ).sort((a, b) => b.loss - a.loss).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-app-primary">{t('dashboard.title')}</h1>
        </div>
        <Button onClick={() => navigate('/app/create-order')}><FilePlus size={16} /> {t('dashboard.createOrder')}</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label={t('dashboard.totalOrdersMkd')} value={formatMKD(Number(s.totalOrdersAmountMkd ?? 0))} icon={ShoppingCart} tone="accent" onClick={() => navigate('/app/orders')} />
        <StatCard label={t('dashboard.totalLosses')} value={formatMKD(Number(s.totalLosses))} icon={TrendingDown} tone="danger" onClick={() => navigate('/app/control-panel')} />
        <StatCard label={t('dashboard.pendingOrders')} value={s.pendingOrders} icon={Clock} tone="warning" onClick={() => navigate('/app/reconciliation')} />
        <StatCard label={t('dashboard.suppliers')} value={s.totalSuppliers} icon={Truck} tone="neutral" onClick={() => navigate('/app/suppliers')} />
        <StatCard label={t('dashboard.products')} value={s.totalProducts} icon={Package} tone="neutral" onClick={() => navigate('/app/products')} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h2 className="text-base font-semibold text-app-primary">{t('analytics.lossTrend')}</h2></CardHeader>
          <CardContent>
            <div className="h-56">
              {monthly.length === 0 ? (
                <div className="h-full flex items-center justify-center text-app-muted text-sm">{t('analytics.noData')}</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lossFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#DC2626" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#DC2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip contentStyle={chartTooltip} formatter={(v: number) => [formatMKD(Number(v)), t('dashboard.loss')]} />
                    <Area isAnimationActive={false} type="monotone" dataKey="total" stroke="#DC2626" strokeWidth={2} fill="url(#lossFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="text-base font-semibold text-app-primary">{t('analytics.topItemsByLoss')}</h2></CardHeader>
          <CardContent>
            <div className="h-56">
              {bySupplier.length === 0 ? (
                <div className="h-full flex items-center justify-center text-app-muted text-sm">{t('dashboard.allClear')}</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySupplier} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" vertical={false} />
                    <XAxis dataKey="supplier" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 10 ? v.slice(0, 10) + '…' : v)} />
                    <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip contentStyle={chartTooltip} cursor={{ fill: 'rgba(79,70,229,0.06)' }} formatter={(v: number) => [formatMKD(Number(v)), t('dashboard.loss')]} />
                    <Bar isAnimationActive={false} dataKey="loss" radius={[6, 6, 0, 0]} maxBarSize={44}>
                      {bySupplier.map((_, i) => <Cell key={i} fill="#DC2626" fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent discrepancies */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-app-primary">{t('dashboard.recentDiscrepancies')}</h2>
          <button type="button" onClick={() => navigate('/app/control-panel')} className="inline-flex items-center gap-1 text-sm font-medium text-app-accent hover:text-app-accent-hover">
            {t('dashboard.viewAll')} <ArrowRight size={15} />
          </button>
        </CardHeader>
        {recentLoading ? (
          <div className="p-6 text-app-secondary text-sm">{t('common.loading')}</div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center text-app-muted text-sm">{t('dashboard.allClear')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {[t('dashboard.date'), t('dashboard.orderNumber'), t('dashboard.supplier'), t('dashboard.loss'), t('dashboard.missing')].map((h, i) => (
                    <th key={i} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-app-muted ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                  <th className="px-5 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const av = avatar(r.order.supplierName);
                  return (
                    <tr key={r.id} onClick={() => setDetailId(r.id)} className="border-b border-[var(--border)] last:border-0 hover:bg-app-surface-subtle cursor-pointer transition-colors duration-150">
                      <td className="px-5 py-3 text-app-secondary whitespace-nowrap">{formatDate(r.reconciliationDate)}</td>
                      <td className="px-5 py-3 text-app-primary font-medium whitespace-nowrap">{r.order.orderNumber}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: av.color + '1A', color: av.color }}>{av.initials}</span>
                          <span className="text-app-secondary">{r.order.supplierName}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right"><Badge variant="danger">{formatMKD(Number(r.totalLossValue))}</Badge></td>
                      <td className="px-5 py-3 max-w-[220px]">
                        <span className="inline-block max-w-full truncate text-xs text-app-muted bg-app-surface-subtle rounded-md px-2 py-0.5" title={missingSummary(r.items)}>{missingSummary(r.items) || '—'}</span>
                      </td>
                      <td className="px-5 py-3 text-app-muted"><ChevronRight size={16} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { to: '/app/create-order', icon: FilePlus, title: t('dashboard.createOrder'), sub: t('dashboard.newProcurementOrder') },
          { to: '/app/reconciliation', icon: ClipboardCheck, title: t('dashboard.reconciliation'), sub: t('dashboard.matchDeliveredVsOrdered') },
        ].map((a) => (
          <button key={a.to} type="button" onClick={() => navigate(a.to)}
            className="group flex items-center gap-4 p-5 rounded-card bg-app-surface-1 border border-[var(--border)] shadow-card hover:shadow-card-hover hover:border-app-accent hover:-translate-y-0.5 transition-all duration-150 text-left">
            <span className="h-11 w-11 rounded-lg bg-app-accent-muted flex items-center justify-center text-app-accent group-hover:bg-app-accent group-hover:text-white transition-colors"><a.icon size={20} /></span>
            <div className="min-w-0">
              <h3 className="font-semibold text-app-primary">{a.title}</h3>
              <p className="text-sm text-app-secondary">{a.sub}</p>
            </div>
            <ArrowRight size={18} className="ml-auto text-app-muted group-hover:text-app-accent transition-colors" />
          </button>
        ))}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setDetailId(null)}
        title={selected ? `${t('dashboard.incident')}: ${selected.order.orderNumber}` : ''}
        footer={<Button variant="secondary" onClick={() => setDetailId(null)} className="w-full sm:w-auto">{t('common.close')}</Button>}
      >
        {selected && (
          <div className="space-y-3">
            <p className="text-app-secondary text-sm">{formatDate(selected.reconciliationDate)} · {selected.order.supplierName}</p>
            <p className="font-semibold text-app-danger">{t('dashboard.totalLoss')}: {formatMKD(Number(selected.totalLossValue))}</p>
            <ul className="text-sm text-app-secondary space-y-1">
              {selected.items.filter((i) => i.missingQty > 0).map((i) => (
                <li key={i.id}>{i.name}: -{i.missingQty} {unitLabel(i.unit)} ({formatMKD(Number(i.lossValue))})</li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" onClick={() => { setDetailId(null); navigate('/app/control-panel'); }}>{t('dashboard.openControlPanel')}</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
