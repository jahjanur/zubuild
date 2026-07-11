import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import {
  Button,
  Card,
  Modal,
  Textarea,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../components/ui';
import { formatMKD, formatDate } from '../lib/formatMKD';

interface OrderItem {
  id: string;
  name: string;
  unit: string;
  price: number | string;
  quantity: number;
}
interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  supplierName: string;
  status: string;
  orderItems: OrderItem[];
}

function statusTr(s: string, t: (k: string) => string): string {
  if (s === 'PENDING') return t('status.pending');
  if (s === 'DELIVERED') return t('status.delivered');
  if (s === 'RECONCILED') return t('status.reconciled');
  return s;
}

export default function Reconciliation() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [received, setReceived] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: ordersData } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<{ list: Order[]; summary?: { totalSpendMkd: number; totalCount: number } }>('/orders'),
  });
  const orders = (ordersData?.data && 'list' in ordersData.data ? ordersData.data.list : []) as Order[];
  const pendingOrDelivered = orders.filter((o) => o.status === 'PENDING' || o.status === 'DELIVERED');

  const reconcile = useMutation({
    mutationFn: (body: { orderId: string; items: Array<{ orderItemId: string; receivedQty: number }>; notes?: string }) =>
      api.post('/reconciliations', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setSelectedOrder(null);
      setReceived({});
      setNotes('');
    },
  });

  function openModal(order: Order) {
    setSelectedOrder(order);
    const initial: Record<string, number> = {};
    order.orderItems.forEach((oi) => (initial[oi.id] = oi.quantity));
    setReceived(initial);
    setNotes('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;
    const items = selectedOrder.orderItems.map((oi) => ({
      orderItemId: oi.id,
      receivedQty: received[oi.id] ?? 0,
    }));
    reconcile.mutate({ orderId: selectedOrder.id, items, notes: notes || undefined });
  }

  const discrepancySummary = selectedOrder
    ? selectedOrder.orderItems.map((oi) => {
        const recv = received[oi.id] ?? 0;
        const missing = Math.max(oi.quantity - recv, 0);
        const loss = missing * Number(oi.price);
        return { name: oi.name, ordered: oi.quantity, received: recv, missing, loss };
      })
    : [];
  const totalLoss = discrepancySummary.reduce((s, d) => s + d.loss, 0);

  return (
    <div className="page-container space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('reconciliation.title')}</h1>
      <p className="text-app-secondary text-sm md:text-base">{t('reconciliation.selectOrder')}</p>

      <div className="space-y-3">
        {pendingOrDelivered.length === 0 ? (
          <p className="text-app-muted">{t('reconciliation.noOrdersToReconcile')}</p>
        ) : (
          pendingOrDelivered.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-app-primary">{o.orderNumber}</span>
                  <span className="text-app-secondary ml-2">{o.supplierName}</span>
                  <span className="text-app-muted text-sm block sm:inline sm:ml-2">
                    {formatDate(o.orderDate)} · {statusTr(o.status, t)}
                  </span>
                </div>
                {isAdmin && (
                  <Button type="button" size="sm" onClick={() => openModal(o)} className="w-full sm:w-auto min-h-[48px]">
                    {t('reconciliation.completeReconciliation')}
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        open={!!selectedOrder}
        onClose={() => {
          setSelectedOrder(null);
          setReceived({});
        }}
        title={selectedOrder ? `${t('reconciliation.completeReconciliation')}: ${selectedOrder.orderNumber}` : ''}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedOrder(null);
                setReceived({});
              }}
              className="flex-1 sm:flex-initial min-h-[48px]"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="reconcile-form"
              disabled={reconcile.isPending}
              className="flex-1 sm:flex-initial min-h-[48px] w-full sm:w-auto"
            >
              {reconcile.isPending ? t('reconciliation.saving') : t('reconciliation.submitReconciliation')}
            </Button>
          </>
        }
      >
        {selectedOrder && (
          <>
            <p className="text-app-secondary text-sm mb-4">{selectedOrder.supplierName}</p>
            <form id="reconcile-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Mobile: item cards with received qty + status */}
              <div className="md:hidden space-y-3">
                {selectedOrder.orderItems.map((oi) => {
                  const recv = received[oi.id] ?? 0;
                  const missing = Math.max(oi.quantity - recv, 0);
                  const excess = Math.max(recv - oi.quantity, 0);
                  const loss = missing * Number(oi.price);
                  const statusKey = missing > 0 ? 'Eksik' : excess > 0 ? 'Fazla' : 'Tamam';
                  const statusClass = missing > 0 ? 'text-app-danger' : excess > 0 ? 'text-app-warning' : 'text-app-success';
                  return (
                    <div key={oi.id} className="rounded-xl border border-[var(--border)] bg-app-surface-2 p-4">
                      <p className="font-medium text-app-primary">{oi.name}</p>
                      <p className="text-app-secondary text-sm mb-2">{t('reconciliation.ordered')}: {oi.quantity} {oi.unit}</p>
                      <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('reconciliation.receivedQty')}</label>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={recv}
                        onChange={(e) =>
                          setReceived((prev) => ({
                            ...prev,
                            [oi.id]: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="w-full rounded-xl border border-[var(--border)] bg-app-bg/50 px-4 py-3 text-app-primary text-right text-base min-h-[48px] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-app-gold/20 focus:outline-none"
                      />
                      <div className="mt-2 flex justify-between items-center">
                        <span className={`text-sm font-medium ${statusClass}`}>
                          {statusKey === 'Eksik' && t('status.missing')}
                          {statusKey === 'Fazla' && t('status.excess')}
                          {statusKey === 'Tamam' && t('status.complete')}
                        </span>
                        {missing > 0 && (
                          <span className="text-app-danger text-sm">{missing} {t('reconciliation.missing')} · {formatMKD(loss)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableHead>{t('createOrder.item')}</TableHead>
                    <TableHead>{t('createOrder.unit')}</TableHead>
                    <TableHead className="text-right">{t('reconciliation.ordered')}</TableHead>
                    <TableHead className="text-right">{t('reconciliation.receivedQty')}</TableHead>
                    <TableHead className="text-right">{t('reconciliation.missing')}</TableHead>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.orderItems.map((oi) => {
                      const recv = received[oi.id] ?? 0;
                      const missing = Math.max(oi.quantity - recv, 0);
                      const loss = missing * Number(oi.price);
                      return (
                        <TableRow key={oi.id}>
                          <TableCell className="text-app-primary">{oi.name}</TableCell>
                          <TableCell>{oi.unit}</TableCell>
                          <TableCell className="text-right">{oi.quantity}</TableCell>
                          <TableCell className="text-right">
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={recv}
                              onChange={(e) =>
                                setReceived((prev) => ({
                                  ...prev,
                                  [oi.id]: parseInt(e.target.value, 10) || 0,
                                }))
                              }
                              className="w-20 px-2 py-1.5 rounded-lg border bg-app-bg/50 border-[var(--border)] text-app-primary text-right text-sm min-h-[44px] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-app-gold/20 focus:outline-none"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {missing > 0 ? (
                              <span className="text-app-danger">
                                {missing} · {formatMKD(loss)}
                              </span>
                            ) : (
                              <span className="text-app-success">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* Sticky discrepancy summary (visible on both) */}
              {totalLoss > 0 && (
                <div className="rounded-xl bg-app-danger-muted border border-app-danger/30 p-3">
                  <p className="text-app-danger font-semibold">{t('dashboard.totalLoss')}: {formatMKD(totalLoss)}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('createOrder.notes')}</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px]" placeholder={t('reconciliation.notesOptional')} />
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}
