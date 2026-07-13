import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui';
import { formatMKD } from '../lib/formatMKD';
import { productName } from '../lib/catalog';

interface Overview {
  totalSuppliers: number;
  totalProducts: number;
  pendingOrders: number;
  totalLosses: number;
}
interface MonthlyPoint {
  month: string;
  total: number;
}
interface TopItem {
  name: string;
  unit?: string;
  measurementUnit?: string;
  totalLossValue: number;
  totalMissingQty: number;
}
interface LossRate {
  incidentsRatio: number;
  totalReconciled: number;
  incidentsWithLoss: number;
  averageLossPerIncident: number;
}

export default function Analytics() {
  const { t } = useTranslation();
  const { data: overviewData } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get<Overview>('/analytics/overview'),
  });
  const { data: monthlyData } = useQuery({
    queryKey: ['analytics', 'monthly-loss'],
    queryFn: () => api.get<MonthlyPoint[]>('/analytics/monthly-loss?months=6'),
  });
  const { data: topData } = useQuery({
    queryKey: ['analytics', 'top-items'],
    queryFn: () =>
      api.get<{ byLossValue: TopItem[]; byMissingQty: TopItem[] }>('/analytics/top-items?limit=5'),
  });
  const { data: lossRateData } = useQuery({
    queryKey: ['analytics', 'loss-rate'],
    queryFn: () => api.get<LossRate>('/analytics/loss-rate'),
  });

  const overview = overviewData?.data ?? {
    totalSuppliers: 0,
    totalProducts: 0,
    pendingOrders: 0,
    totalLosses: 0,
  };
  const monthly = monthlyData?.data ?? [];
  const top = topData?.data ?? { byLossValue: [], byMissingQty: [] };
  const lossRate = lossRateData?.data ?? {
    incidentsRatio: 0,
    totalReconciled: 0,
    incidentsWithLoss: 0,
    averageLossPerIncident: 0,
  };

  const pieData = [
    { name: t('analytics.withLoss'), value: lossRate.incidentsWithLoss, color: 'var(--danger)' },
    {
      name: t('analytics.noLoss'),
      value: Math.max(0, lossRate.totalReconciled - lossRate.incidentsWithLoss),
      color: 'var(--accent)',
    },
  ].filter((d) => d.value > 0);

  const itemUnit = (it: TopItem) => it.measurementUnit ?? it.unit ?? 'adet';

  return (
    <div className="page-container space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('analytics.title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent>
            <p className="text-app-secondary text-sm">{t('analytics.totalSuppliers')}</p>
            <p className="text-2xl font-semibold text-app-accent">{overview.totalSuppliers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-app-secondary text-sm">{t('analytics.totalProducts')}</p>
            <p className="text-2xl font-semibold text-app-accent">{overview.totalProducts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-app-secondary text-sm">{t('analytics.pendingOrders')}</p>
            <p className="text-2xl font-semibold text-app-accent">{overview.pendingOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-app-secondary text-sm">{t('analytics.totalLosses')}</p>
            <p className="text-2xl font-semibold text-app-danger">{formatMKD(Number(overview.totalLosses))}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardContent>
            <h3 className="font-semibold text-app-primary mb-4">{t('analytics.monthlyLoss')}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(v) => formatMKD(v)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-1)',
                      border: '1px solid var(--border-focus)',
                    }}
                    labelStyle={{ color: 'var(--accent)' }}
                    formatter={(value: number) => [formatMKD(value), t('dashboard.loss')]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--accent)' }}
                    name={t('dashboard.loss')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h3 className="font-semibold text-app-primary mb-4">{t('analytics.lossRateChart')}</h3>
            <div className="h-64 flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface-1)',
                        border: '1px solid var(--border-focus)',
                      }}
                      formatter={(value: number) => [value, t('analytics.count')]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-app-muted">{t('analytics.noReconciliationData')}</p>
              )}
            </div>
            <p className="text-app-secondary text-sm mt-2">
              {t('analytics.avgLossPerIncident')}: {formatMKD(lossRate.averageLossPerIncident)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardContent>
            <h3 className="font-semibold text-app-primary mb-4">{t('analytics.top5ByLossValue')}</h3>
            <ul className="space-y-2">
              {top.byLossValue.length === 0 ? (
                <li className="text-app-muted">{t('analytics.noData')}</li>
              ) : (
                top.byLossValue.map((it, i) => (
                  <li key={i} className="flex justify-between items-center gap-2">
                    <span className="text-app-primary truncate">{productName(it.name)}</span>
                    <span className="text-app-danger font-medium shrink-0">{formatMKD(it.totalLossValue)}</span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h3 className="font-semibold text-app-primary mb-4">{t('analytics.top5ByMissingQty')}</h3>
            <ul className="space-y-2">
              {top.byMissingQty.length === 0 ? (
                <li className="text-app-muted">{t('analytics.noData')}</li>
              ) : (
                top.byMissingQty.map((it, i) => (
                  <li key={i} className="flex justify-between items-center gap-2">
                    <span className="text-app-primary truncate">{productName(it.name)}</span>
                    <span className="text-app-accent font-medium shrink-0">
                      {it.totalMissingQty} {itemUnit(it)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
