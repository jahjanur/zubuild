import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatCard, Card, Modal, Button } from '../components/ui';
import { formatMKD, formatDate } from '../lib/formatMKD';

interface Overview {
  totalSuppliers: number;
  totalProducts: number;
  pendingOrders: number;
  totalLosses: number;
  lowStockCount?: number;
  totalOrdersAmountMkd?: number;
  totalOrdersCount?: number;
}

interface ReconItem {
  id: string;
  name: string;
  unit: string;
  missingQty: number;
  lossValue: number;
}

interface RecentRecon {
  id: string;
  reconciliationDate: string;
  totalLossValue: number;
  order: { orderNumber: string; supplierName: string };
  items: ReconItem[];
}

function missingSummary(items: ReconItem[]): string {
  const missing = items.filter((i) => i.missingQty > 0);
  if (missing.length === 0) return '';
  return missing.map((i) => `${i.name}: -${i.missingQty} ${i.unit}`).join(', ');
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get<Overview>('/analytics/overview'),
  });
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['reconciliations', 'recent'],
    queryFn: () =>
      api.get<RecentRecon[]>('/reconciliations/recent?limit=5&onlyWithDiscrepancies=true'),
  });

  const s = data?.data ?? {
    totalSuppliers: 0,
    totalProducts: 0,
    pendingOrders: 0,
    totalLosses: 0,
    lowStockCount: 0,
    totalOrdersAmountMkd: 0,
    totalOrdersCount: 0,
  };
  const recent = recentData?.data ?? [];
  const selected = recent.find((r) => r.id === detailId);

  return (
    <div className="page-container space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('dashboard.title')}</h1>

      <div className="space-y-3 md:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <Link to="/app/suppliers" className="block">
            <StatCard label={t('dashboard.suppliers')} value={s.totalSuppliers} accent />
          </Link>
          <Link to="/app/products" className="block">
            <StatCard label={t('dashboard.products')} value={s.totalProducts} accent />
          </Link>
          <Link to="/app/reconciliation" className="block">
            <StatCard label={t('dashboard.pendingOrders')} value={s.pendingOrders} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Link to="/app/orders" className="block w-full">
            <StatCard
              label={t('dashboard.totalOrdersMkd')}
              value={formatMKD(Number(s.totalOrdersAmountMkd ?? 0))}
              accent
            />
          </Link>
          <Link to="/app/control-panel" className="block w-full">
            <StatCard label={t('dashboard.totalLosses')} value={formatMKD(Number(s.totalLosses))} />
          </Link>
        </div>
      </div>

      {(s.lowStockCount ?? 0) > 0 && (
        <Link to="/app/products?lowStock=1" className="block">
          <StatCard
            label={t('dashboard.lowStockItems')}
            value={s.lowStockCount ?? 0}
            sub={t('dashboard.viewProducts')}
            accent
          />
        </Link>
      )}

      <section>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-lg font-semibold text-app-primary">{t('dashboard.recentDiscrepancies')}</h2>
          <Link to="/app/control-panel" className="text-sm font-medium text-app-gold hover:text-app-gold-hover">
            {t('dashboard.viewAll')}
          </Link>
        </div>
        {recentLoading ? (
          <Card>
            <div className="p-6 text-app-secondary text-sm">{t('common.loading')}</div>
          </Card>
        ) : recent.length === 0 ? (
          <Card>
            <div className="p-6 text-app-secondary text-sm">{t('dashboard.allClear')}</div>
          </Card>
        ) : (
          <>
            {/* Mobile: card per row */}
            <div className="space-y-2 md:hidden">
              {recent.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDetailId(r.id)}
                  className="w-full text-left rounded-xl bg-app-surface-1 border border-[var(--border)] shadow-card p-4 active:scale-[0.99] min-h-[48px]"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="text-app-primary font-medium">{r.order.orderNumber}</span>
                    <span className="text-app-danger font-medium">{formatMKD(Number(r.totalLossValue))}</span>
                  </div>
                  <div className="text-app-secondary text-sm">{formatDate(r.reconciliationDate)} · {r.order.supplierName}</div>
                  <div className="text-app-muted text-xs mt-1 truncate" title={missingSummary(r.items)}>
                    {missingSummary(r.items) || '—'}
                  </div>
                </button>
              ))}
            </div>
            {/* Desktop: table */}
            <Card className="overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-app-surface-2">
                      <th className="px-4 py-3 font-semibold text-app-primary">{t('dashboard.date')}</th>
                      <th className="px-4 py-3 font-semibold text-app-primary">{t('dashboard.orderNumber')}</th>
                      <th className="px-4 py-3 font-semibold text-app-primary">{t('dashboard.supplier')}</th>
                      <th className="px-4 py-3 font-semibold text-app-primary text-right">{t('dashboard.loss')}</th>
                      <th className="px-4 py-3 font-semibold text-app-primary">{t('dashboard.missing')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setDetailId(r.id)}
                        className="border-b border-[var(--border)] hover:bg-white/[0.04] cursor-pointer transition"
                      >
                        <td className="px-4 py-3 text-app-secondary">{formatDate(r.reconciliationDate)}</td>
                        <td className="px-4 py-3 text-app-primary font-medium">{r.order.orderNumber}</td>
                        <td className="px-4 py-3 text-app-secondary">{r.order.supplierName}</td>
                        <td className="px-4 py-3 text-app-danger text-right font-medium">
                          {formatMKD(Number(r.totalLossValue))}
                        </td>
                        <td className="px-4 py-3 text-app-muted text-xs max-w-[200px] truncate" title={missingSummary(r.items)}>
                          {missingSummary(r.items) || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <Link to="/app/create-order" className="block min-h-[48px]">
          <Card className="flex items-center gap-4 p-4 md:p-6 hover:border-app-gold/30 hover:shadow-card transition cursor-pointer active:scale-[0.99]">
            <div className="w-12 h-12 rounded-xl bg-app-gold-muted flex items-center justify-center text-app-gold text-xl font-medium">+</div>
            <div>
              <h2 className="font-semibold text-app-primary">{t('dashboard.createOrder')}</h2>
              <p className="text-sm text-app-secondary">{t('dashboard.newProcurementOrder')}</p>
            </div>
          </Card>
        </Link>
        <Link to="/app/reconciliation" className="block min-h-[48px]">
          <Card className="flex items-center gap-4 p-4 md:p-6 hover:border-app-gold/30 hover:shadow-card transition cursor-pointer active:scale-[0.99]">
            <div className="w-12 h-12 rounded-xl bg-app-gold-muted flex items-center justify-center text-app-gold text-xl font-medium">≡</div>
            <div>
              <h2 className="font-semibold text-app-primary">{t('dashboard.reconciliation')}</h2>
              <p className="text-sm text-app-secondary">{t('dashboard.matchDeliveredVsOrdered')}</p>
            </div>
          </Card>
        </Link>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setDetailId(null)}
        title={selected ? `${t('dashboard.incident')}: ${selected.order.orderNumber}` : ''}
        footer={
          <Button variant="secondary" onClick={() => setDetailId(null)} className="w-full sm:w-auto min-h-[48px]">
            {t('common.close')}
          </Button>
        }
      >
        {selected && (
          <div className="space-y-3">
            <p className="text-app-secondary text-sm">
              {formatDate(selected.reconciliationDate)} · {selected.order.supplierName}
            </p>
            <p className="font-semibold text-app-danger">{t('dashboard.totalLoss')}: {formatMKD(Number(selected.totalLossValue))}</p>
            <ul className="text-sm text-app-secondary space-y-1">
              {selected.items.filter((i) => i.missingQty > 0).map((i) => (
                <li key={i.id}>
                  {i.name}: -{i.missingQty} {i.unit} ({formatMKD(Number(i.lossValue))})
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" onClick={() => { setDetailId(null); navigate('/app/control-panel'); }}>
              {t('dashboard.openControlPanel')}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
