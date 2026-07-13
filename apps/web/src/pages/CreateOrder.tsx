import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Input,
  Textarea,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableActionButton,
} from '../components/ui';
import { formatMKD } from '../lib/formatMKD';
import { useAuth } from '../lib/useAuth';
import { useToast } from '../context/ToastContext';

interface Supplier {
  id: string;
  companyName: string;
  contactPerson?: string | null;
  status: string;
}
interface Product {
  id: string;
  name: string;
  category: string;
  measurementUnit: string;
  price: number | string;
  status: string;
}
interface OrderItemRow {
  productId: string | null;
  name: string;
  unit: string;
  price: number;
  quantity: number;
}
interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  supplierName: string;
  totalAmount: number | string;
  status: string;
  orderItems: Array<{ id: string; name: string; unit: string; price: number | string; quantity: number }>;
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export default function CreateOrder() {
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<OrderItemRow[]>([]);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState('');

  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const toast = useToast();

  const { data: suppliersData } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get<Supplier[]>('/suppliers') });
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const suppliers = (suppliersData?.data ?? []).filter((s) => s.status === 'ACTIVE');
  const activeProducts = (productsData?.data ?? []).filter((p) => p.status === 'ACTIVE');

  // Browse-first: show all ACTIVE products; the filter box narrows client-side (instant, no round-trip)
  const filterQuery = filter.trim().toLowerCase();
  const filteredProducts = filterQuery
    ? activeProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(filterQuery) ||
          (p.category ?? '').toLowerCase().includes(filterQuery)
      )
    : activeProducts;

  // Quantity already in the order, per product — powers the tap-to-add count badge
  const qtyInOrder = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.productId) m.set(r.productId, (m.get(r.productId) ?? 0) + r.quantity);
    return m;
  }, [rows]);

  const supplierQuery = supplierSearch.trim().toLowerCase();
  const filteredSuppliers = supplierQuery
    ? suppliers.filter(
        (s) =>
          s.companyName.toLowerCase().includes(supplierQuery) ||
          (s.contactPerson && s.contactPerson.toLowerCase().includes(supplierQuery))
      )
    : suppliers;
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const createOrder = useMutation({
    mutationFn: (body: { supplierId: string; orderDate: string; items: OrderItemRow[]; notes?: string }) =>
      api.post<Order>('/orders', body),
    onSuccess: (res) => {
      if (res.data) {
        setCreatedOrder(res.data);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['products', 'recent'] });
        queryClient.invalidateQueries({ queryKey: ['analytics', 'overview'] });
      }
    },
  });

  const total = useMemo(() => rows.reduce((s, r) => s + r.price * r.quantity, 0), [rows]);

  const canSubmit = supplierId && rows.length > 0 && !createOrder.isPending;

  function addProduct(p: Product) {
    const unit = p.measurementUnit ?? (p as unknown as { unit?: string }).unit ?? 'adet';
    setRows((prev) => {
      const existing = prev.find((r) => r.productId === p.id);
      if (existing) {
        return prev.map((r) =>
          r.productId === p.id ? { ...r, quantity: r.quantity + 1 } : r
        );
      }
      return [...prev, { productId: p.id, name: p.name, unit, price: Number(p.price), quantity: 1 }];
    });
  }

  function updateRow(index: number, field: 'quantity', value: number) {
    setRows((prev) =>
      prev.map((r, i) => (i !== index ? r : { ...r, [field]: Math.max(0, value) }))
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const orderDateStr = orderDate.includes('T') ? orderDate : `${orderDate}T12:00:00.000Z`;
    createOrder.mutate({ supplierId, orderDate: orderDateStr, items: rows, notes: notes || undefined });
  }

  const base = import.meta.env.VITE_API_BASE ?? '/api';

  async function getPdfBlob(): Promise<Blob> {
    if (!createdOrder?.id) throw new Error('No order');
    const url = `${base}/orders/${createdOrder.id}/pdf`;
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
    if (!createdOrder?.id) return;
    getPdfBlob()
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `order-${createdOrder.orderNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => toast.show(err instanceof Error ? err.message : t('createOrder.pdfError')));
  }

  function sharePdf() {
    if (!createdOrder?.id) return;
    getPdfBlob()
      .then((blob) => {
        const file = new File([blob], `order-${createdOrder.orderNumber}.pdf`, { type: 'application/pdf' });
        if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
          return navigator.share({
            title: `${createdOrder.orderNumber}`,
            text: t('createOrder.shareOrderText', { orderNumber: createdOrder.orderNumber, supplier: createdOrder.supplierName }),
            files: [file],
          });
        }
        toast.show(t('createOrder.shareNotSupported'));
      })
      .catch((err) => toast.show(err instanceof Error ? err.message : t('createOrder.pdfError')));
  }

  useEffect(() => {
    if (!createdOrder?.id) {
      setPdfPreviewUrl(null);
      return;
    }
    let revoked = false;
    const url = `${base}/orders/${createdOrder.id}/pdf`;
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
  }, [createdOrder?.id]);

  if (!isAdmin) {
    return (
      <div className="page-container space-y-4 md:space-y-6">
        <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('createOrder.title')}</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-app-secondary">{t('createOrder.viewerNoCreate')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`page-container space-y-4 md:space-y-6 md:pb-0 ${rows.length > 0 ? 'pb-52' : 'pb-24'}`}>
      <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('createOrder.title')}</h1>

      {createdOrder ? (
        <div className="space-y-4">
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-app-accent mb-2">{t('createOrder.orderCreated', { orderNumber: createdOrder.orderNumber })}</h2>
              <p className="text-app-secondary mb-4">
                {t('createOrder.supplierTotal', { supplier: createdOrder.supplierName, total: formatMKD(Number(createdOrder.totalAmount)) })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={sharePdf} className="min-h-[48px]">{t('createOrder.sharePdf')}</Button>
                <Button onClick={downloadPdf} variant="secondary" className="min-h-[48px]">{t('createOrder.downloadPdf')}</Button>
                <Button variant="ghost" onClick={() => { setCreatedOrder(null); setRows([]); setNotes(''); }} className="min-h-[48px]">
                  {t('createOrder.createAnother')}
                </Button>
              </div>
            </CardContent>
          </Card>
          {pdfPreviewUrl && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-app-primary">{t('createOrder.pdfPreview')}</h3>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-[var(--border)] bg-app-surface-2 overflow-hidden" style={{ minHeight: 480 }}>
                  <iframe
                    title={t('createOrder.pdfPreview')}
                    src={pdfPreviewUrl}
                    className="w-full h-[480px] md:h-[640px]"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <Card>
                  <CardContent>
                    <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('createOrder.supplierRequired')}</label>
                    <div className="relative" ref={supplierRef}>
                      <Input
                        type="text"
                        placeholder={t('createOrder.selectSupplier')}
                        value={supplierDropdownOpen ? supplierSearch : (selectedSupplier ? selectedSupplier.companyName : supplierSearch)}
                        onChange={(e) => {
                          setSupplierSearch(e.target.value);
                          if (!e.target.value) setSupplierId('');
                          setSupplierDropdownOpen(true);
                        }}
                        onFocus={() => {
                          if (selectedSupplier) setSupplierSearch(selectedSupplier.companyName);
                          setSupplierDropdownOpen(true);
                        }}
                        onBlur={() => setTimeout(() => setSupplierDropdownOpen(false), 180)}
                        className="min-h-[48px]"
                      />
                      {supplierDropdownOpen && (
                        <div className="glass absolute z-10 mt-1 w-full rounded-xl border border-[var(--border)] shadow-modal max-h-56 overflow-auto" style={{ background: 'var(--glass-bg-strong)' }}>
                          {filteredSuppliers.length === 0 ? (
                            <div className="p-3 text-app-muted text-sm">{t('createOrder.noResults')}</div>
                          ) : (
                            <ul className="py-1">
                              {filteredSuppliers.map((s) => (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    className="w-full text-left px-4 py-3 min-h-[48px] text-base text-app-primary hover:bg-slate-900/[0.06] flex flex-col gap-0.5"
                                    onClick={() => {
                                      setSupplierId(s.id);
                                      setSupplierSearch('');
                                      setSupplierDropdownOpen(false);
                                    }}
                                  >
                                    <span className="font-medium">{s.companyName}</span>
                                    {s.contactPerson && (
                                      <span className="text-sm text-app-muted">{s.contactPerson}</span>
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    {supplierId && <input type="hidden" name="supplierId" value={supplierId} />}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('createOrder.orderDateRequired')}</label>
                    <Input
                      type="date"
                      value={orderDate.slice(0, 10)}
                      onChange={(e) => setOrderDate(e.target.value)}
                      required
                    />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-app-primary">{t('createOrder.browseProducts')}</h3>
                  {rows.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-app-accent/15 text-app-accent text-xs font-semibold">
                      {rows.length}
                    </span>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Optional filter — browsing works with zero typing */}
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder={t('createOrder.filterProducts')}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="min-h-[48px] pr-10"
                    />
                    {filter && (
                      <button
                        type="button"
                        onClick={() => setFilter('')}
                        aria-label={t('common.close')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-app-muted hover:text-app-primary hover:bg-black/5"
                      >
                        <span className="text-xl leading-none">×</span>
                      </button>
                    )}
                  </div>

                  {/* Browse-first grid: tap any active product to add it to the order */}
                  {productsLoading ? (
                    <p className="text-app-muted text-sm py-6 text-center">{t('common.loading')}</p>
                  ) : activeProducts.length === 0 ? (
                    <p className="text-app-muted text-sm py-6 text-center">{t('createOrder.noActiveProducts')}</p>
                  ) : filteredProducts.length === 0 ? (
                    <p className="text-app-muted text-sm py-6 text-center">{t('createOrder.noResults')}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 md:max-h-[520px] md:overflow-y-auto md:pr-1">
                      {filteredProducts.map((p) => {
                        const added = qtyInOrder.get(p.id) ?? 0;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addProduct(p)}
                            aria-label={t('createOrder.addToOrder', { name: p.name })}
                            className="glass group relative flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left min-h-[64px] transition hover:-translate-y-0.5 hover:shadow-modal active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-gold/50"
                            style={{ background: 'var(--glass-bg)' }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-app-primary truncate">{p.name}</p>
                              <p className="text-app-secondary text-sm truncate">
                                {p.measurementUnit} · <span className="text-app-accent">{formatMKD(Number(p.price))}</span>
                              </p>
                            </div>
                            {added > 0 ? (
                              <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-app-accent/15 text-app-accent text-sm font-semibold">
                                ×{added}
                              </span>
                            ) : (
                              <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-app-accent/10 text-app-accent group-hover:bg-app-accent/20 transition" aria-hidden>
                                <IconPlus />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {rows.length > 0 && (
                    <p className="text-xs font-medium text-app-muted pt-2 border-t border-[var(--border)]">{t('createOrder.orderTable')}</p>
                  )}

                  {/* Mobile: item cards */}
                  <div className="md:hidden space-y-3">
                    {rows.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-[var(--border)] bg-app-surface-2 p-4 flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-app-primary">{r.name}</p>
                            <p className="text-app-secondary text-sm">{r.unit} · {formatMKD(r.price)}</p>
                          </div>
                          <TableActionButton onClick={() => removeRow(i)} aria-label={t('createOrder.remove')}>
                            <span className="text-app-danger"><IconTrash /></span>
                          </TableActionButton>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-sm text-app-secondary">{t('createOrder.qty')}</label>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={r.quantity}
                            onChange={(e) => updateRow(i, 'quantity', parseInt(e.target.value, 10) || 0)}
                            className="w-20 rounded-xl border border-[var(--border)] bg-white/60 px-3 py-2.5 text-right text-app-primary text-base min-h-[44px] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-black/10 focus:outline-none"
                          />
                        </div>
                        <p className="text-app-accent font-semibold text-right">{t('createOrder.total')}: {formatMKD(r.price * r.quantity)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--border)]">
                    <Table>
                      <TableHeader>
                        <TableHead>{t('createOrder.item')}</TableHead>
                        <TableHead>{t('createOrder.unit')}</TableHead>
                        <TableHead className="text-right">{t('products.price')}</TableHead>
                        <TableHead className="text-right">{t('createOrder.qty')}</TableHead>
                        <TableHead className="text-right">{t('createOrder.total')}</TableHead>
                        <TableHead className="w-12" />
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-app-primary">{r.name}</TableCell>
                            <TableCell>{r.unit}</TableCell>
                            <TableCell className="text-right text-app-accent">{formatMKD(r.price)}</TableCell>
                            <TableCell className="text-right">
                              <input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={r.quantity}
                                onChange={(e) => updateRow(i, 'quantity', parseInt(e.target.value, 10) || 0)}
                                className="w-16 rounded-lg border border-[var(--border)] bg-white/60 px-2 py-1.5 text-right text-app-primary text-sm focus:border-app-border-focus focus:ring-2 focus:ring-black/10 focus:outline-none min-h-[44px]"
                              />
                            </TableCell>
                            <TableCell className="text-right text-app-accent">{formatMKD(r.price * r.quantity)}</TableCell>
                            <TableCell>
                              <TableActionButton onClick={() => removeRow(i)} aria-label={t('createOrder.remove')}>
                                <span className="text-app-danger"><IconTrash /></span>
                              </TableActionButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('createOrder.notes')}</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="" />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              {/* Mobile: summary bar pinned to the bottom edge (no bottom nav); clears the home indicator via safe-area */}
              {rows.length > 0 && (
                <div className="glass md:hidden fixed left-0 right-0 bottom-0 z-30 border-t border-[var(--border)] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(8,8,8,0.10)]"
                  style={{ background: 'var(--glass-bg-strong)' }}
                >
                  <div className="page-container flex flex-col gap-3">
                    <div className="flex justify-between text-app-primary font-semibold text-base">
                      <span>{t('createOrder.total')}</span>
                      <span className="text-app-accent">{formatMKD(total)}</span>
                    </div>
                    <Button
                      type="submit"
                      className="w-full min-h-[48px]"
                      disabled={!canSubmit}
                    >
                      {createOrder.isPending ? t('common.loading') : t('createOrder.submitOrder')}
                    </Button>
                    {!supplierId && (
                      <p className="text-xs text-app-muted text-center">{t('createOrder.selectSupplierFirst')}</p>
                    )}
                  </div>
                </div>
              )}
              {/* Mobile: hint when no items yet */}
              {rows.length === 0 && (
                <p className="md:hidden text-app-muted text-sm text-center py-2">{t('createOrder.tapProductToAdd')}</p>
              )}
              {/* Desktop: sidebar summary */}
              <Card className="lg:sticky lg:top-6 hidden md:block">
                <CardHeader>
                  <h3 className="text-sm font-semibold text-app-primary">{t('createOrder.title')}</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rows.length === 0 ? (
                    <p className="text-app-secondary text-sm">{t('createOrder.tapProductToAdd')}</p>
                  ) : (
                    <>
                      <ul className="space-y-2 text-sm text-app-secondary">
                        {rows.map((r, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="truncate">{r.name} × {r.quantity} {r.unit}</span>
                            <span className="text-app-accent shrink-0">{formatMKD(r.price * r.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t border-[var(--border)] pt-3 flex justify-between text-app-primary font-semibold">
                        <span>{t('createOrder.total')}</span>
                        <span className="text-app-accent">{formatMKD(total)}</span>
                      </div>
                      <Button
                        type="submit"
                        className="w-full min-h-[48px]"
                        disabled={!canSubmit}
                      >
                        {createOrder.isPending ? t('common.loading') : t('createOrder.submitOrder')}
                      </Button>
                      {!supplierId ? (
                        <p className="text-xs text-app-muted text-center">{t('createOrder.selectSupplierFirst')}</p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
