import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  Card,
  Button,
  Input,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  Modal,
} from '../components/ui';
import { formatMKD } from '../lib/formatMKD';
import { useToast } from '../context/ToastContext';


interface OrderRow {
  id: string;
  orderNumber: string;
  orderDate: string;
  supplierName: string;
  status: string;
  totalAmount: number;
  hasReconciliation: boolean;
  orderItems?: Array<{ id: string; name: string; unit: string; price: number; quantity: number }>;
}

interface OrdersResponse {
  list: OrderRow[];
  summary: { totalSpendMkd: number; totalCount: number };
}

function statusTr(s: string, t: (key: string) => string): string {
  if (s === 'PENDING') return t('status.pending');
  if (s === 'DELIVERED') return t('status.delivered');
  if (s === 'RECONCILED') return t('status.reconciled');
  return s;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('tr-TR', { dateStyle: 'medium' });
}

const base = import.meta.env.VITE_API_BASE ?? '/api';

export default function Orders() {
  const { t } = useTranslation();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viewingOrder, setViewingOrder] = useState<OrderRow | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'list', qs],
    queryFn: () => api.get<OrdersResponse>(`/orders${qs ? `?${qs}` : ''}`),
  });

  const response = data?.data;
  const orders = response && 'list' in response ? response.list : [];
  const summary = response && 'summary' in response ? response.summary : { totalSpendMkd: 0, totalCount: 0 };

  async function getPdfBlob(orderId: string): Promise<Blob> {
    const url = `${base}/orders/${orderId}/pdf`;
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) {
      const body = await r.text();
      let msg = t('createOrder.pdfError');
      try {
        const json = JSON.parse(body);
        if (json?.error) msg = json.error;
      } catch {
        if (body) msg = body.slice(0, 80);
      }
      throw new Error(msg);
    }
    return r.blob();
  }

  function downloadPdf() {
    if (!viewingOrder) return;
    getPdfBlob(viewingOrder.id)
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `order-${viewingOrder.orderNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => toast.show(err instanceof Error ? err.message : t('createOrder.pdfError')));
  }

  function sharePdf() {
    if (!viewingOrder) return;
    getPdfBlob(viewingOrder.id)
      .then((blob) => {
        const file = new File([blob], `order-${viewingOrder.orderNumber}.pdf`, { type: 'application/pdf' });
        if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
          return navigator.share({
            title: viewingOrder.orderNumber,
            text: t('createOrder.shareOrderText', { orderNumber: viewingOrder.orderNumber, supplier: viewingOrder.supplierName }),
            files: [file],
          });
        }
        toast.show(t('createOrder.shareNotSupported'));
      })
      .catch((err) => toast.show(err instanceof Error ? err.message : t('createOrder.pdfError')));
  }

  useEffect(() => {
    if (!viewingOrder) {
      setPdfPreviewUrl(null);
      return;
    }
    let revoked = false;
    const url = `${base}/orders/${viewingOrder.id}/pdf`;
    fetch(url, { credentials: 'include' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('PDF failed'))))
      .then((blob) => {
        if (!revoked) setPdfPreviewUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!revoked) setPdfPreviewUrl(null);
      });
    return () => {
      revoked = true;
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [viewingOrder?.id]);

  return (
    <div className="page-container space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('orders.title')}</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium text-app-secondary">{t('orders.totalSpendMkd')}</p>
          <p className="text-2xl font-semibold text-app-accent mt-1">{formatMKD(Number(summary.totalSpendMkd))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-app-secondary">{t('orders.orderCount')}</p>
          <p className="text-2xl font-semibold text-app-primary mt-1">{summary.totalCount}</p>
        </Card>
      </div>

      {/* Search & filters */}
      <Card className="p-4">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1">{t('orders.searchOrders')}</label>
            <Input
              placeholder={t('orders.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              className="max-w-md"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1">{t('orders.filterFrom')}</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1">{t('orders.filterTo')}</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-app-secondary text-sm">{t('common.loading')}</div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-app-secondary text-sm">{t('orders.noOrders')}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableHead>{t('orders.orderNumber')}</TableHead>
                <TableHead>{t('orders.supplier')}</TableHead>
                <TableHead>{t('orders.date')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="text-right">{t('orders.total')}</TableHead>
                <TableHead>{t('orders.reconciliation')}</TableHead>
                <TableHead className="text-right">{t('orders.view')}</TableHead>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium text-app-primary">{o.orderNumber}</TableCell>
                    <TableCell className="text-app-secondary">{o.supplierName}</TableCell>
                    <TableCell className="text-app-secondary">{formatDate(o.orderDate)}</TableCell>
                    <TableCell>
                      <Badge variant={o.status === 'RECONCILED' ? 'success' : o.status === 'DELIVERED' ? 'default' : 'default'}>
                        {statusTr(o.status, t)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-app-accent font-medium">{formatMKD(Number(o.totalAmount))}</TableCell>
                    <TableCell>
                      {o.hasReconciliation ? (
                        <Badge variant="success">{t('orders.reconciled')}</Badge>
                      ) : (
                        <Badge variant="default">{t('orders.pending')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewingOrder(o)}
                        className="min-h-[36px]"
                      >
                        {t('orders.view')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* View order modal: Share, WhatsApp, Download PDF, PDF preview */}
      <Modal
        open={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        title={viewingOrder ? `${t('orders.orderNumber')}: ${viewingOrder.orderNumber}` : ''}
        size="wide"
        footer={
          <Button variant="secondary" onClick={() => setViewingOrder(null)} className="min-h-[48px]">
            {t('common.close')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-auto">
          {viewingOrder && (
            <>
              <p className="text-app-secondary text-sm">
                {viewingOrder.supplierName} · {formatMKD(Number(viewingOrder.totalAmount))}
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <Button onClick={sharePdf} size="sm" className="md:min-h-[48px] md:px-5 md:py-2.5 md:text-base">{t('createOrder.sharePdf')}</Button>
                <Button onClick={downloadPdf} size="sm" variant="secondary" className="md:min-h-[48px] md:px-5 md:py-2.5 md:text-base">{t('createOrder.downloadPdf')}</Button>
              </div>
              {pdfPreviewUrl && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-app-primary">{t('createOrder.pdfPreview')}</h3>
                  <div className="rounded-lg border border-[var(--border)] bg-app-surface-2 overflow-hidden">
                    <iframe
                      title={t('createOrder.pdfPreview')}
                      src={pdfPreviewUrl}
                      className="w-full h-[62vh] min-h-[380px] md:h-[520px]"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
