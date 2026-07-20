import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck, AlertTriangle, TrendingDown, CheckCircle2,
  ArrowLeft, Check, Search, ChevronRight, PackageCheck, ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { Button, Card, CardContent, CardHeader, StatCard, Badge, Textarea } from '../components/ui';
import { formatMKD, formatDate } from '../lib/formatMKD';
import { productName } from '../lib/catalog';
import { unitLabel } from '../lib/units';

interface OrderItem { id: string; name: string; unit: string; price: number | string; quantity: number; }
interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  supplierName: string;
  status: string;
  totalAmount: number | string;
  orderItems: OrderItem[];
}
interface Reconciliation { id: string; orderId: string; totalLossValue: number | string; }

interface SavedResult {
  orderNumber: string;
  supplierName: string;
  totalLoss: number;
  items: Array<{ name: string; unit: string; ordered: number; delivered: number; missing: number; loss: number }>;
}

export default function Reconciliation() {
  const { t } = useTranslation();
  const { canReconcile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [received, setReceived] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null);

  const { data: ordersData } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<{ list: Order[]; summary?: { totalSpendMkd: number; totalCount: number } }>('/orders'),
  });
  const { data: reconData } = useQuery({
    queryKey: ['reconciliations'],
    queryFn: () => api.get<Reconciliation[]>('/reconciliations'),
  });

  const orders = (ordersData?.data && 'list' in ordersData.data ? ordersData.data.list : []) as Order[];
  const reconciliations = (reconData?.data ?? []) as Reconciliation[];

  // Loss per already-reconciled order (drives the matched/discrepancy badge).
  const lossByOrder = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reconciliations) m.set(r.orderId, Number(r.totalLossValue));
    return m;
  }, [reconciliations]);

  // Summary stats (all derived from existing data).
  const reconciledCount = reconciliations.length;
  const totalLossAll = reconciliations.reduce((s, r) => s + Number(r.totalLossValue), 0);
  const discrepancyCount = reconciliations.filter((r) => Number(r.totalLossValue) > 0).length;
  const matchedPct = reconciledCount ? Math.round(((reconciledCount - discrepancyCount) / reconciledCount) * 100) : 100;

  const pending = orders.filter((o) => o.status === 'PENDING' || o.status === 'DELIVERED');

  // Step 1 list: pending first, then reconciled — filtered by search.
  const q = orderSearch.trim().toLowerCase();
  const listOrders = useMemo(() => {
    const match = (o: Order) => !q || o.orderNumber.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q);
    const rank = (o: Order) => (o.status === 'RECONCILED' ? 1 : 0);
    return [...orders].filter(match).sort((a, b) => rank(a) - rank(b));
  }, [orders, q]);

  const reconcile = useMutation({
    mutationFn: (body: { orderId: string; items: Array<{ orderItemId: string; receivedQty: number }>; notes?: string }) =>
      api.post('/reconciliations', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      if (selectedOrder) {
        const items = selectedOrder.orderItems.map((oi) => {
          const delivered = received[oi.id] ?? 0;
          const missing = Math.max(oi.quantity - delivered, 0);
          return { name: oi.name, unit: oi.unit, ordered: oi.quantity, delivered, missing, loss: missing * Number(oi.price) };
        });
        setSavedResult({
          orderNumber: selectedOrder.orderNumber,
          supplierName: selectedOrder.supplierName,
          totalLoss: items.reduce((s, i) => s + i.loss, 0),
          items,
        });
      }
      setSelectedOrder(null);
      setReceived({});
      setReasons({});
      setNotes('');
    },
  });

  function openOrder(order: Order) {
    setSavedResult(null);
    setSelectedOrder(order);
    const initial: Record<string, number> = {};
    order.orderItems.forEach((oi) => (initial[oi.id] = oi.quantity));
    setReceived(initial);
    setReasons({});
    setNotes('');
  }

  function setQty(id: string, v: number) {
    setReceived((prev) => ({ ...prev, [id]: Math.max(0, v) }));
  }
  function markAllDelivered() {
    if (!selectedOrder) return;
    const all: Record<string, number> = {};
    selectedOrder.orderItems.forEach((oi) => (all[oi.id] = oi.quantity));
    setReceived(all);
  }

  const REASONS = [
    { key: 'reasonShort', label: t('reconciliation.reasonShort') },
    { key: 'reasonDamaged', label: t('reconciliation.reasonDamaged') },
    { key: 'reasonWrong', label: t('reconciliation.reasonWrong') },
    { key: 'reasonQuality', label: t('reconciliation.reasonQuality') },
    { key: 'reasonOther', label: t('reconciliation.reasonOther') },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder || reconcile.isPending) return;
    const items = selectedOrder.orderItems.map((oi) => ({ orderItemId: oi.id, receivedQty: received[oi.id] ?? 0 }));
    // Fold per-row reasons into the order notes (the API stores order-level notes).
    const reasonLines = selectedOrder.orderItems
      .map((oi) => {
        const missing = Math.max(oi.quantity - (received[oi.id] ?? 0), 0);
        const reason = (reasons[oi.id] ?? '').trim();
        return missing > 0 && reason ? `${oi.name}: ${reason}` : null;
      })
      .filter(Boolean) as string[];
    const composedNotes = [notes.trim(), ...reasonLines].filter(Boolean).join('\n');
    reconcile.mutate({ orderId: selectedOrder.id, items, notes: composedNotes || undefined });
  }

  const liveLoss = selectedOrder
    ? selectedOrder.orderItems.reduce((s, oi) => s + Math.max(oi.quantity - (received[oi.id] ?? 0), 0) * Number(oi.price), 0)
    : 0;

  function orderBadge(o: Order) {
    if (o.status !== 'RECONCILED') return <Badge variant="warning">{t('reconciliation.badgePending')}</Badge>;
    const loss = lossByOrder.get(o.id) ?? 0;
    return loss > 0
      ? <Badge variant="danger">{t('reconciliation.badgeDiscrepancy')}</Badge>
      : <Badge variant="success">{t('reconciliation.badgeMatched')}</Badge>;
  }

  return (
    <div className="page-container space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('reconciliation.title')}</h1>
        <p className="text-app-secondary text-sm mt-1">{t('reconciliation.subtitle')}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('reconciliation.statReconciled')} value={reconciledCount} icon={ClipboardCheck} tone="accent" />
        <StatCard label={t('reconciliation.statDiscrepancies')} value={discrepancyCount} icon={AlertTriangle} tone="warning" />
        <StatCard label={t('reconciliation.statTotalLoss')} value={formatMKD(totalLossAll)} icon={TrendingDown} tone="danger" />
        <StatCard label={t('reconciliation.statMatched')} value={`${matchedPct}%`} icon={CheckCircle2} tone="success" />
      </div>

      {savedResult ? (
        /* ---- Confirmation summary ---- */
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-app-success-muted text-app-success shrink-0">
                <PackageCheck size={22} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-app-primary">{t('reconciliation.recorded')}</h2>
                <p className="text-app-secondary text-sm">{t('reconciliation.recordedSub', { orderNumber: savedResult.orderNumber })} · {savedResult.supplierName}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[var(--border)]">
                  {savedResult.items.map((it, i) => (
                    <tr key={i} className={it.missing > 0 ? 'bg-app-danger-muted' : ''}>
                      <td className="px-4 py-2.5 text-app-primary">{productName(it.name)}</td>
                      <td className="px-4 py-2.5 text-right text-app-secondary tabular-nums">{it.delivered}/{it.ordered} {unitLabel(it.unit)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {it.missing > 0 ? <span className="text-app-danger">−{formatMKD(it.loss)}</span> : <span className="text-app-success">✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-app-secondary text-sm">{t('reconciliation.totalLoss')}</span>
              <span className={`text-lg font-bold tabular-nums ${savedResult.totalLoss > 0 ? 'text-app-danger' : 'text-app-success'}`}>{formatMKD(savedResult.totalLoss)}</span>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <Button onClick={() => navigate('/app/orders')} className="min-h-[44px]"><ExternalLink size={16} /> {t('reconciliation.viewOrder')}</Button>
              <Button variant="secondary" onClick={() => setSavedResult(null)} className="min-h-[44px]">{t('reconciliation.reconcileAnother')}</Button>
            </div>
          </CardContent>
        </Card>
      ) : selectedOrder ? (
        /* ---- Step 2: comparison view ---- */
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <Card>
            <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button type="button" onClick={() => { setSelectedOrder(null); setReceived({}); }} aria-label={t('reconciliation.backToOrders')} className="flex h-9 w-9 items-center justify-center rounded-lg text-app-secondary hover:bg-app-surface-subtle shrink-0">
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0">
                  <p className="font-semibold text-app-primary truncate">{selectedOrder.orderNumber} · {selectedOrder.supplierName}</p>
                  <p className="text-app-muted text-sm">{formatDate(selectedOrder.orderDate)} · {t('reconciliation.orderTotal')}: {formatMKD(Number(selectedOrder.totalAmount))}</p>
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={markAllDelivered} className="shrink-0 min-h-[44px]">
                <Check size={16} /> {t('reconciliation.allDelivered')}
              </Button>
            </CardContent>
          </Card>

          {/* Comparison table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="sticky top-0 z-10 bg-app-surface-subtle">
                  <tr className="text-[11px] uppercase tracking-wider text-app-muted">
                    <th className="text-left font-semibold px-4 md:px-5 py-3">{t('createOrder.item')}</th>
                    <th className="text-right font-semibold px-3 py-3 w-24">{t('reconciliation.ordered')}</th>
                    <th className="text-right font-semibold px-3 py-3 w-36">{t('reconciliation.delivered')}</th>
                    <th className="text-right font-semibold px-3 py-3 w-32">{t('reconciliation.difference')}</th>
                    <th className="text-right font-semibold px-4 md:px-5 py-3 w-28">{t('reconciliation.lossCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {selectedOrder.orderItems.map((oi) => {
                    const delivered = received[oi.id] ?? 0;
                    const diff = delivered - oi.quantity;
                    const missing = Math.max(-diff, 0);
                    const loss = missing * Number(oi.price);
                    const rowTint = diff < 0 ? 'bg-app-danger-muted' : diff > 0 ? 'bg-app-accent-muted' : '';
                    return (
                      <Fragment key={oi.id}>
                        <tr className={rowTint}>
                          <td className="px-4 md:px-5 py-2.5 align-middle">
                            <span className="font-medium text-app-primary">{productName(oi.name)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right align-middle text-app-secondary tabular-nums">{oi.quantity}</td>
                          <td className="px-3 py-2.5 align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={delivered}
                                onChange={(e) => setQty(oi.id, parseInt(e.target.value, 10) || 0)}
                                className="w-20 px-2.5 py-2 rounded-lg border bg-app-surface-1 border-[var(--border)] text-app-primary text-right text-sm tabular-nums min-h-[40px] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:outline-none"
                              />
                              <span className="text-xs text-app-muted w-10 text-left">{unitLabel(oi.unit)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right align-middle">
                            {diff === 0 ? (
                              <span className="inline-flex items-center justify-end text-app-success"><Check size={18} /></span>
                            ) : diff < 0 ? (
                              <span className="inline-flex items-center rounded-md bg-app-danger/10 text-app-danger px-2 py-0.5 text-xs font-semibold tabular-nums">−{missing} {unitLabel(oi.unit)}</span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-app-accent/10 text-app-accent px-2 py-0.5 text-xs font-semibold tabular-nums">+{diff} {unitLabel(oi.unit)}</span>
                            )}
                          </td>
                          <td className="px-4 md:px-5 py-2.5 text-right align-middle tabular-nums font-semibold">
                            {loss > 0 ? <span className="text-app-danger">{formatMKD(loss)}</span> : <span className="text-app-muted">—</span>}
                          </td>
                        </tr>
                        {diff < 0 && (
                          <tr className={rowTint}>
                            <td colSpan={5} className="px-4 md:px-5 pb-3 pt-0">
                              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                <span className="text-xs text-app-muted shrink-0">{t('reconciliation.reason')}:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {REASONS.map((r) => {
                                    const active = reasons[oi.id] === r.label;
                                    return (
                                      <button key={r.key} type="button" onClick={() => setReasons((p) => ({ ...p, [oi.id]: active ? '' : r.label }))}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${active ? 'bg-app-accent text-app-accent-contrast' : 'border border-[var(--border)] text-app-secondary hover:bg-app-surface-subtle'}`}>
                                        {r.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <input
                                  type="text"
                                  value={reasons[oi.id] ?? ''}
                                  onChange={(e) => setReasons((p) => ({ ...p, [oi.id]: e.target.value }))}
                                  placeholder={t('reconciliation.reasonSelect')}
                                  className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border bg-app-surface-1 border-[var(--border)] text-app-primary text-sm min-h-[36px] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:outline-none"
                                />
                                <button type="button" onClick={() => setQty(oi.id, oi.quantity)} className="text-xs font-medium text-app-accent hover:underline shrink-0 whitespace-nowrap">
                                  {t('reconciliation.markFullyDelivered')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--border-strong)]">
                    <td className="px-4 md:px-5 py-3 font-semibold text-app-primary" colSpan={4}>{t('reconciliation.totalLoss')}</td>
                    <td className={`px-4 md:px-5 py-3 text-right font-bold tabular-nums ${liveLoss > 0 ? 'text-app-danger' : 'text-app-success'}`}>{formatMKD(liveLoss)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card>
            <CardContent>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('createOrder.notes')}</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[72px]" placeholder={t('reconciliation.notesOptional')} />
              <div className="flex flex-col sm:flex-row gap-2 justify-end mt-4">
                <Button type="button" variant="secondary" onClick={() => { setSelectedOrder(null); setReceived({}); }} className="min-h-[48px]">{t('common.cancel')}</Button>
                <Button type="submit" disabled={reconcile.isPending} className="min-h-[48px]">{reconcile.isPending ? t('reconciliation.saving') : t('reconciliation.submitReconciliation')}</Button>
              </div>
            </CardContent>
          </Card>
        </form>
      ) : (
        /* ---- Step 1: pick an order ---- */
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-app-primary">{t('reconciliation.pickOrder')}</h2>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder={t('reconciliation.searchOrders')}
                className="w-full rounded-lg border border-[var(--border)] bg-app-surface-1 pl-9 pr-3 py-2 min-h-[40px] text-sm text-app-primary focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:outline-none"
              />
            </div>
          </CardHeader>

          {pending.length === 0 && listOrders.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-3 py-12 px-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-app-success-muted text-app-success">
                <CheckCircle2 size={30} />
              </span>
              <div>
                <p className="text-app-primary font-semibold">{t('reconciliation.allReconciled')}</p>
                <p className="text-app-secondary text-sm">{t('reconciliation.allReconciledSub')}</p>
              </div>
            </div>
          ) : listOrders.length === 0 ? (
            <p className="text-app-muted text-sm py-10 text-center">{t('createOrder.noResults')}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {listOrders.map((o) => {
                const rowReconcilable = canReconcile && (o.status === 'PENDING' || o.status === 'DELIVERED');
                const loss = lossByOrder.get(o.id) ?? 0;
                const rowClass = `w-full text-left flex items-center gap-3 px-4 md:px-5 py-3.5 min-h-[64px] transition-colors ${rowReconcilable ? 'hover:bg-app-surface-subtle cursor-pointer' : ''}`;
                const content = (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-app-primary">{o.orderNumber}</span>
                        {orderBadge(o)}
                      </div>
                      <p className="text-app-secondary text-sm truncate">{o.supplierName} · {formatDate(o.orderDate)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-app-primary font-semibold tabular-nums">{formatMKD(Number(o.totalAmount))}</p>
                      {o.status === 'RECONCILED' && loss > 0 && (
                        <p className="text-app-danger text-xs tabular-nums">−{formatMKD(loss)}</p>
                      )}
                    </div>
                    {rowReconcilable && <ChevronRight size={18} className="text-app-muted shrink-0" />}
                  </>
                );
                return (
                  <li key={o.id}>
                    {rowReconcilable ? (
                      <button type="button" onClick={() => openOrder(o)} className={rowClass}>{content}</button>
                    ) : (
                      <div className={rowClass}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
