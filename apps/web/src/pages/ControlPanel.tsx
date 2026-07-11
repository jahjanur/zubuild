import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import {
  Card,
  CardContent,
  CardHeader,
  Modal,
  Button,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../components/ui';
import { formatMKD, formatDate, formatDateTime } from '../lib/formatMKD';

interface ControlSummary {
  incidentCount: number;
  totalItemsMissing: number;
  totalLossSum: number;
}
interface Reconciliation {
  id: string;
  orderId: string;
  reconciliationDate: string;
  notes: string | null;
  totalLossValue: number | string;
  order: { orderNumber: string };
  items?: Array<{
    name: string;
    unit: string;
    orderedQty: number;
    receivedQty: number;
    missingQty: number;
    lossValue: number | string;
    status: string;
  }>;
}

function statusTr(s: string, t: (k: string) => string): string {
  if (s === 'MISSING') return t('status.missing');
  if (s === 'EXCESS') return t('status.excess');
  if (s === 'COMPLETE') return t('status.complete');
  return s;
}

export default function ControlPanel() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const { data: summaryData } = useQuery({
    queryKey: ['control', 'summary'],
    queryFn: () => api.get<ControlSummary>('/control/summary'),
  });
  const { data: incidentsData } = useQuery({
    queryKey: ['control', 'incidents'],
    queryFn: () => api.get<Reconciliation[]>('/control/incidents'),
  });
  const { data: detailsData } = useQuery({
    queryKey: ['control', 'details', detailsId],
    queryFn: () => api.get<Reconciliation>(`/reconciliations/${detailsId}`),
    enabled: !!detailsId,
  });
  const { data: movementsData } = useQuery({
    queryKey: ['inventory', 'movements'],
    queryFn: () => api.get<Array<{ id: string; product: { name: string; unit?: string; measurementUnit?: string }; type: string; deltaQty: number; reason: string | null; createdAt: string }>>('/inventory/movements?limit=50'),
  });

  const summary = summaryData?.data ?? {
    incidentCount: 0,
    totalItemsMissing: 0,
    totalLossSum: 0,
  };
  const incidents = incidentsData?.data ?? [];
  const details = detailsData?.data;
  const movements = movementsData?.data ?? [];

  function exportCsv() {
    const base = import.meta.env.VITE_API_BASE ?? '/api';
    fetch(`${base}/control/export.csv`, { credentials: 'include' })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'control-panel-export.csv';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }

  return (
    <div className="page-container space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('controlPanel.title')}</h1>
      <p className="text-app-secondary text-sm md:text-base">{t('controlPanel.incidentsWithLoss')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardContent>
            <p className="text-app-secondary text-sm">{t('controlPanel.incidentCount')}</p>
            <p className="text-2xl font-semibold text-app-gold">{summary.incidentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-app-secondary text-sm">{t('controlPanel.discrepancy')}</p>
            <p className="text-2xl font-semibold text-app-gold">{summary.totalItemsMissing}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-app-secondary text-sm">{t('controlPanel.totalLossSum')}</p>
            <p className="text-2xl font-semibold text-app-danger">{formatMKD(Number(summary.totalLossSum))}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-app-surface-2">
          <h2 className="font-semibold text-app-primary">{t('controlPanel.incidentsWithLoss')}</h2>
          {isAdmin && (
            <Button type="button" size="sm" onClick={exportCsv} className="w-full sm:w-auto min-h-[48px]">
              {t('controlPanel.exportExcel')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile: incident cards */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {incidents.length === 0 ? (
              <div className="p-6 text-center text-app-muted">{t('controlPanel.noIncidents')}</div>
            ) : (
              incidents.map((r) => (
                <div key={r.id} className="p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-app-primary">{r.order.orderNumber}</span>
                    <span className="text-app-danger font-medium">{formatMKD(Number(r.totalLossValue))}</span>
                  </div>
                  <p className="text-app-secondary text-sm">{formatDate(r.reconciliationDate)}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailsId(r.id)}
                    className="w-full min-h-[44px]"
                  >
                    {t('controlPanel.details')}
                  </Button>
                </div>
              ))
            )}
          </div>
          {/* Desktop: table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableHead>{t('controlPanel.order')}</TableHead>
                <TableHead>{t('controlPanel.date')}</TableHead>
                <TableHead className="text-right">{t('controlPanel.loss')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableHeader>
              <TableBody>
                {incidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-app-muted py-8">
                      {t('controlPanel.noIncidents')}
                    </TableCell>
                  </TableRow>
                ) : (
                  incidents.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-app-primary">{r.order.orderNumber}</TableCell>
                      <TableCell>{formatDate(r.reconciliationDate)}</TableCell>
                      <TableCell className="text-right text-app-danger">
                        {formatMKD(Number(r.totalLossValue))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailsId(r.id)}
                          className="min-h-[44px]"
                        >
                          {t('controlPanel.details')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-app-primary">{t('inventory.movements')}</h2>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile: movement cards */}
          <div className="md:hidden divide-y divide-[var(--border)] max-h-[60vh] overflow-y-auto">
            {movements.length === 0 ? (
              <div className="p-6 text-center text-app-muted text-sm">{t('inventory.noMovements')}</div>
            ) : (
              movements.map((m) => (
                <div key={m.id} className="p-4">
                  <p className="font-medium text-app-primary">{m.product.name}</p>
                  <p className={`text-sm font-medium ${m.deltaQty >= 0 ? 'text-app-success' : 'text-app-danger'}`}>
                    {m.deltaQty >= 0 ? '+' : ''}{m.deltaQty}
                  </p>
                  <p className="text-app-secondary text-xs">{m.type.replace(/_/g, ' ')} · {m.reason || '—'}</p>
                  <p className="text-app-muted text-xs mt-1">{formatDateTime(m.createdAt)}</p>
                </div>
              ))
            )}
          </div>
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableHead>{t('controlPanel.product')}</TableHead>
                <TableHead className="text-right">{t('inventory.delta')}</TableHead>
                <TableHead>{t('inventory.type')}</TableHead>
                <TableHead>{t('inventory.reasonOptional')}</TableHead>
                <TableHead>{t('controlPanel.date')}</TableHead>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-app-muted py-8 text-sm">
                      {t('inventory.noMovements')}
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-app-primary font-medium">{m.product.name}</TableCell>
                      <TableCell
                        className={`text-right font-medium ${m.deltaQty >= 0 ? 'text-app-success' : 'text-app-danger'}`}
                      >
                        {m.deltaQty >= 0 ? '+' : ''}{m.deltaQty}
                      </TableCell>
                      <TableCell className="text-app-secondary text-xs">{m.type.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-app-muted text-xs">{m.reason || '—'}</TableCell>
                      <TableCell className="text-app-muted text-xs">{formatDateTime(m.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={!!detailsId}
        onClose={() => setDetailsId(null)}
        title={t('controlPanel.details')}
        footer={<Button variant="secondary" onClick={() => setDetailsId(null)} className="w-full sm:w-auto min-h-[48px]">{t('common.close')}</Button>}
      >
        <div className="max-h-[70vh] overflow-auto overflow-x-auto">
          {details ? (
            <>
              <p className="text-app-secondary text-sm mb-4">
                {t('controlPanel.order')}: {details.order?.orderNumber ?? '—'} ·{' '}
                {details.reconciliationDate
                  ? formatDateTime(details.reconciliationDate)
                  : '—'}
              </p>
              {details.notes && (
                <p className="text-app-secondary text-sm mb-4">{t('createOrder.notes')}: {details.notes}</p>
              )}
              <Table>
                <TableHeader>
                  <TableHead>{t('createOrder.item')}</TableHead>
                  <TableHead className="text-right">{t('controlPanel.ordered')}</TableHead>
                  <TableHead className="text-right">{t('controlPanel.received')}</TableHead>
                  <TableHead className="text-right">{t('reconciliation.missing')}</TableHead>
                  <TableHead className="text-right">{t('controlPanel.loss')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                </TableHeader>
                <TableBody>
                  {(details.items ?? []).map((it, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-app-primary">{it.name}</TableCell>
                      <TableCell className="text-right">{it.orderedQty}</TableCell>
                      <TableCell className="text-right">{it.receivedQty}</TableCell>
                      <TableCell className="text-right">{it.missingQty}</TableCell>
                      <TableCell className="text-right text-app-danger">
                        {formatMKD(Number(it.lossValue))}
                      </TableCell>
                      <TableCell>{statusTr(it.status, t)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 font-semibold text-app-danger">
                {t('controlPanel.totalLoss')}: {formatMKD(Number(details.totalLossValue))}
              </p>
            </>
          ) : (
            <p className="text-app-muted">{t('controlPanel.loading')}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
