import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, Button, Textarea } from '../components/ui';
import { ShoppingCart, ChevronDown, Search, X } from 'lucide-react';
import { formatMKD } from '../lib/formatMKD';
import { productName, categoryName } from '../lib/catalog';
import { unitLabel } from '../lib/units';
import { useAuth } from '../lib/useAuth';
import { useToast } from '../context/ToastContext';

interface Supplier {
  id: string;
  companyName: string;
  contactPerson?: string | null;
  location?: string | null;
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

// Stable color per category (dot on each product row) and per supplier avatar.
const PALETTE = ['#6366F1', '#0891B2', '#059669', '#D97706', '#DB2777', '#7C3AED', '#DC2626', '#2563EB', '#CA8A04', '#0D9488'];
function hashColor(s: string): string {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
function IconPlus({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconMinus({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** Compact inline stepper for a product/summary row: − value + */
function InlineStepper({ value, onDec, onInc, decLabel, incLabel, tone = 'accent' }: { value: number; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string; tone?: 'accent' | 'plain' }) {
  const wrap = tone === 'accent'
    ? 'inline-flex items-center rounded-lg border border-app-accent/30 bg-white'
    : 'inline-flex items-center rounded-lg border border-[var(--border)] bg-white';
  const btn = 'flex h-9 w-9 items-center justify-center text-app-accent rounded-md transition hover:bg-app-accent/10 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]';
  return (
    <div className={wrap} role="group">
      <button type="button" onClick={onDec} aria-label={decLabel} className={btn}><IconMinus size={16} /></button>
      <span className="min-w-[26px] text-center text-sm font-semibold text-app-primary tabular-nums">{value}</span>
      <button type="button" onClick={onInc} aria-label={incLabel} className={btn}><IconPlus size={16} /></button>
    </div>
  );
}

export default function CreateOrder() {
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<OrderItemRow[]>([]);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('');

  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { canWrite } = useAuth();
  const toast = useToast();

  const { data: suppliersData } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get<Supplier[]>('/suppliers') });
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const suppliers = (suppliersData?.data ?? []).filter((s) => s.status === 'ACTIVE');
  const activeProducts = (productsData?.data ?? []).filter((p) => p.status === 'ACTIVE');

  // Distinct categories for the filter chips (data values — shown as-is, not translated)
  const categories = useMemo(
    () => Array.from(new Set(activeProducts.map((p) => p.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [activeProducts]
  );

  // A search query filters across ALL categories (ignores the active chip); with
  // no query, the active category chip narrows the list.
  const filterQuery = filter.trim().toLowerCase();
  const filteredProducts = activeProducts.filter((p) => {
    if (filterQuery) {
      return p.name.toLowerCase().includes(filterQuery) || (p.category ?? '').toLowerCase().includes(filterQuery);
    }
    return category ? p.category === category : true;
  });

  // Quantity already in the order, per product
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
          (s.contactPerson && s.contactPerson.toLowerCase().includes(supplierQuery)) ||
          (s.location && s.location.toLowerCase().includes(supplierQuery))
      )
    : suppliers;
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  // Close the supplier dropdown on outside click.
  useEffect(() => {
    if (!supplierDropdownOpen) return;
    function onDown(e: MouseEvent) {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setSupplierDropdownOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [supplierDropdownOpen]);

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
        return prev.map((r) => (r.productId === p.id ? { ...r, quantity: r.quantity + 1 } : r));
      }
      return [...prev, { productId: p.id, name: p.name, unit, price: Number(p.price), quantity: 1 }];
    });
  }

  function updateRow(index: number, field: 'quantity', value: number) {
    setRows((prev) => prev.map((r, i) => (i !== index ? r : { ...r, [field]: Math.max(0, value) })));
  }

  // Decrement a product by id; drops the row at zero.
  function decProduct(id: string) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.productId === id);
      if (idx < 0) return prev;
      const q = prev[idx].quantity - 1;
      if (q <= 0) return prev.filter((_, i) => i !== idx);
      return prev.map((r, i) => (i === idx ? { ...r, quantity: q } : r));
    });
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setRows([]);
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
    const url = `${base}/orders/${createdOrder.id}/pdf?lang=${encodeURIComponent(i18n.language)}`;
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
    const url = `${base}/orders/${createdOrder.id}/pdf?lang=${encodeURIComponent(i18n.language)}`;
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

  if (!canWrite) {
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

  const chipClass = (active: boolean) =>
    `shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full text-sm font-medium transition min-h-[36px] ${
      active ? 'bg-app-accent text-white shadow-button' : 'border border-[var(--border)] text-app-secondary hover:bg-app-surface-subtle'
    }`;

  function openSupplierPicker() {
    setSupplierSearch('');
    setSupplierDropdownOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 xl:px-10 space-y-4 md:space-y-6">
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
                  <iframe title={t('createOrder.pdfPreview')} src={pdfPreviewUrl} className="w-full h-[480px] md:h-[640px]" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] gap-4 md:gap-6 items-start">
          {/* LEFT: supplier/date + product list */}
          <div className="space-y-4 md:space-y-6 min-w-0">
            {/* Supplier + order date */}
            <Card>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Supplier combobox */}
                  <div>
                    <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('createOrder.supplierRequired')}</label>
                    <div className="relative" ref={supplierRef}>
                      {supplierDropdownOpen ? (
                        <div className="relative">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
                          <input
                            type="text"
                            autoFocus
                            placeholder={t('createOrder.searchSuppliers')}
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                            className="w-full rounded-xl border border-[var(--border-focus)] bg-app-surface-1 pl-9 pr-3 text-app-primary min-h-[52px] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
                          />
                        </div>
                      ) : selectedSupplier ? (
                        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-app-surface-1 pl-2.5 pr-2 min-h-[52px]">
                          <span className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ backgroundColor: hashColor(selectedSupplier.companyName) }}>
                            {initialsOf(selectedSupplier.companyName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-app-primary truncate">{selectedSupplier.companyName}</span>
                            {selectedSupplier.location && <span className="block text-xs text-app-muted truncate">{selectedSupplier.location}</span>}
                          </span>
                          <button type="button" onClick={openSupplierPicker} className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-app-accent hover:bg-app-accent-muted transition">
                            {t('createOrder.change')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={openSupplierPicker}
                          className="w-full flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-app-surface-1 px-3.5 min-h-[52px] text-app-muted hover:border-app-border-strong transition"
                        >
                          {t('createOrder.selectSupplier')}
                          <ChevronDown size={18} className="shrink-0" />
                        </button>
                      )}

                      {supplierDropdownOpen && (
                        <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-[var(--border)] bg-app-surface-1 shadow-modal max-h-72 overflow-auto scroll-thin">
                          {filteredSuppliers.length === 0 ? (
                            <div className="p-4 text-app-muted text-sm">{t('createOrder.noResults')}</div>
                          ) : (
                            <ul className="py-1">
                              {filteredSuppliers.map((s) => (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-app-surface-subtle transition"
                                    onClick={() => {
                                      setSupplierId(s.id);
                                      setSupplierSearch('');
                                      setSupplierDropdownOpen(false);
                                    }}
                                  >
                                    <span className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ backgroundColor: hashColor(s.companyName) }}>
                                      {initialsOf(s.companyName)}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block text-sm font-medium text-app-primary truncate">{s.companyName}</span>
                                      {(s.location || s.contactPerson) && (
                                        <span className="block text-xs text-app-muted truncate">{s.location || s.contactPerson}</span>
                                      )}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    {supplierId && <input type="hidden" name="supplierId" value={supplierId} />}
                  </div>

                  {/* Order date — editable but visually secondary */}
                  <div>
                    <label className="block text-sm font-medium text-app-muted mb-1.5">{t('createOrder.orderDateRequired')}</label>
                    <input
                      type="date"
                      value={orderDate.slice(0, 10)}
                      onChange={(e) => setOrderDate(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[var(--border)] bg-app-surface-subtle px-3.5 text-app-secondary min-h-[52px] focus:outline-none focus:bg-app-surface-1 focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product list */}
            <Card className="overflow-hidden">
              {/* Sticky search + chips (above the scrolling list) */}
              <div className="p-4 md:p-5 border-b border-[var(--border)] space-y-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    placeholder={t('createOrder.filterProducts')}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-app-surface-1 pl-10 pr-10 text-app-primary min-h-[48px] focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)]"
                  />
                  {filter && (
                    <button type="button" onClick={() => setFilter('')} aria-label={t('common.close')} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-app-muted hover:text-app-primary hover:bg-black/5">
                      <X size={16} />
                    </button>
                  )}
                </div>
                {categories.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto scroll-thin pb-1 -mb-1" role="group" aria-label={t('products.category')}>
                    <button type="button" onClick={() => setCategory('')} aria-pressed={category === ''} className={chipClass(category === '')}>
                      {t('createOrder.allCategory')}
                    </button>
                    {categories.map((c) => (
                      <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={chipClass(category === c)}>
                        {categoryName(c)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Scrolling product rows */}
              <div className="md:max-h-[560px] md:overflow-y-auto scroll-thin">
                {productsLoading ? (
                  <p className="text-app-muted text-sm py-10 text-center">{t('common.loading')}</p>
                ) : activeProducts.length === 0 ? (
                  <p className="text-app-muted text-sm py-10 text-center">{t('createOrder.noActiveProducts')}</p>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-app-secondary text-sm mb-3">{t('createOrder.noProductsMatch')}</p>
                    <Button type="button" variant="secondary" size="sm" onClick={() => { setFilter(''); setCategory(''); }}>
                      {t('createOrder.clearFilters')}
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {filteredProducts.map((p) => {
                      const added = qtyInOrder.get(p.id) ?? 0;
                      return (
                        <li key={p.id} className={`flex items-center gap-3 px-4 md:px-5 py-2 min-h-[56px] transition-colors ${added > 0 ? 'bg-app-accent-muted' : 'hover:bg-app-surface-subtle'}`}>
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: hashColor(p.category) }} aria-hidden />
                          <span className="flex-1 min-w-0 text-[15px] font-medium text-app-primary">{productName(p.name)}</span>
                          <span className="inline-flex items-center rounded-md bg-app-surface-subtle px-2 py-0.5 text-xs font-medium text-app-secondary shrink-0">
                            {unitLabel(p.measurementUnit)}
                          </span>
                          <span className="w-24 text-right text-sm font-bold text-app-primary tabular-nums shrink-0">{formatMKD(Number(p.price))}</span>
                          {added > 0 ? (
                            <InlineStepper
                              value={added}
                              onDec={() => decProduct(p.id)}
                              onInc={() => addProduct(p)}
                              decLabel={t('createOrder.decreaseQty')}
                              incLabel={t('createOrder.increaseQty')}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => addProduct(p)}
                              aria-label={t('createOrder.addToOrder', { name: p.name })}
                              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-app-accent text-white shadow-button transition hover:bg-app-accent-hover active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
                            >
                              <IconPlus size={18} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent>
                <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('createOrder.notes')}</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="" />
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: sticky order summary */}
          <div>
            <Card className="lg:sticky lg:top-6">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-app-primary">{t('createOrder.title')}</h3>
                {rows.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-app-accent/15 text-app-accent text-xs font-semibold">{rows.length}</span>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {rows.length === 0 ? (
                  <div className="flex flex-col items-center text-center gap-3 py-8">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-app-surface-subtle text-app-muted">
                      <ShoppingCart size={24} />
                    </span>
                    <p className="text-app-secondary text-sm">{t('createOrder.tapProductToAdd')}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-app-muted">
                        <span className="text-app-primary font-semibold">{rows.length}</span> {t('createOrder.itemsLabel')}
                      </span>
                      <button type="button" onClick={clearAll} className="text-xs font-medium text-app-danger hover:underline px-2 py-1 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-app-danger/40 rounded-lg">
                        {t('createOrder.clearAll')}
                      </button>
                    </div>

                    <ul className="space-y-3">
                      {rows.map((r, i) => (
                        <li key={i} className="flex flex-col gap-2 pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-app-primary">{productName(r.name)}</span>
                            <button type="button" onClick={() => removeRow(i)} aria-label={t('createOrder.remove')} className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-app-danger hover:bg-app-danger-muted transition">
                              <IconTrash />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <InlineStepper
                              value={r.quantity}
                              onDec={() => updateRow(i, 'quantity', r.quantity - 1)}
                              onInc={() => updateRow(i, 'quantity', r.quantity + 1)}
                              decLabel={t('createOrder.decreaseQty')}
                              incLabel={t('createOrder.increaseQty')}
                              tone="plain"
                            />
                            <span className="text-sm font-semibold text-app-primary tabular-nums">{formatMKD(r.price * r.quantity)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="border-t border-[var(--border)] pt-3 space-y-2">
                      <div className="flex justify-between text-sm text-app-secondary">
                        <span>{t('createOrder.subtotal')}</span>
                        <span className="tabular-nums">{formatMKD(total)}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold text-app-primary">
                        <span>{t('createOrder.total')}</span>
                        <span className="tabular-nums">{formatMKD(total)}</span>
                      </div>
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full min-h-[48px]" disabled={!canSubmit}>
                  {createOrder.isPending ? t('common.loading') : t('createOrder.submitOrder')}
                </Button>
                {!canSubmit && !createOrder.isPending && (
                  <p className="text-xs text-app-muted text-center">
                    {!supplierId ? t('createOrder.selectSupplierFirst') : t('createOrder.addAtLeastOne')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </form>
      )}
    </div>
  );
}
