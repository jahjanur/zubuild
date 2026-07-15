import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, Button, Input, Modal, Select } from '../components/ui';
import { Plus, Search, X, Trash2, Download, Info } from 'lucide-react';
import { productName, categoryName } from '../lib/catalog';
import { unitLabel } from '../lib/units';
import { formatEUR, formatMKDPlain, formatPercent } from '../lib/formatMKD';
import { useOrg } from '../lib/useOrg';
import { useToast } from '../context/ToastContext';
import { computeCost, mkdToEur, parseDecimal, labourLineCost, type CostCalcInput } from '../lib/costCalc';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

interface Product {
  id: string;
  name: string;
  category: string;
  measurementUnit: string;
  price: number | string;
  status: string;
}

let seq = 0;
const nextId = () => `r${++seq}`;
/** Plain 2-decimal (dot) string for a number input; parseDecimal accepts comma too. */
const eurInput = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2);

/** Material row — UI state keeps the numeric fields as strings (locale-aware entry). */
interface MatRow {
  id: string;
  productId: string | null;
  name: string;
  unit: string;
  priceMkd: number; // snapshot at add-time
  priceEurStr: string;
  overridden: boolean;
  qtyStr: string;
}
interface LabourRow {
  id: string;
  role: string;
  /** Link to a material row (id) — quantity + unit then track that material (e.g. rebar tons). */
  linkedMaterialId: string | null;
  unit: string; // used when not linked ('day' | 'm²' | 'ton' | 'kg' | 'm³' | 'm' | 'adet')
  qtyStr: string; // used when not linked
  rateStr: string; // € per unit
  finalStr: string; // agreed fixed price (€) — overrides qty × rate when set
}

/** Units labour can be priced in (day = classic dnevnica). */
const LABOUR_UNITS = ['day', 'm²', 'm³', 'ton', 'kg', 'm', 'adet'];

export default function CostCalculator() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const org = useOrg();
  const rate = org?.mkdToEurRate ?? 61.5;
  const [exporting, setExporting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [materials, setMaterials] = useState<MatRow[]>([]);
  const [lumpSumStr, setLumpSumStr] = useState('');
  const [labour, setLabour] = useState<LabourRow[]>([]);
  const [areaStr, setAreaStr] = useState('');
  const [saleStr, setSaleStr] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });
  const activeProducts = useMemo(
    () => (productsData?.data ?? []).filter((p) => p.status === 'ACTIVE'),
    [productsData]
  );

  // Live exchange rate: when the org rate changes, re-derive every NON-overridden
  // € price. Overridden rows (what was actually paid) are left untouched.
  useEffect(() => {
    setMaterials((rows) =>
      rows.map((r) => (r.overridden ? r : { ...r, priceEurStr: eurInput(mkdToEur(r.priceMkd, rate)) }))
    );
  }, [rate]);

  function addMaterial(p: Product) {
    const priceMkd = Number(p.price) || 0;
    setMaterials((rows) => [
      ...rows,
      {
        id: nextId(),
        productId: p.id,
        name: p.name, // snapshot — a later catalogue edit/delete won't corrupt this calc
        unit: p.measurementUnit,
        priceMkd,
        priceEurStr: eurInput(mkdToEur(priceMkd, rate)),
        overridden: false,
        qtyStr: '1',
      },
    ]);
    setPickerOpen(false);
    setPickerSearch('');
  }

  const setMatPrice = (id: string, v: string) =>
    setMaterials((rows) => rows.map((r) => (r.id === id ? { ...r, priceEurStr: v, overridden: true } : r)));
  const setMatQty = (id: string, v: string) =>
    setMaterials((rows) => rows.map((r) => (r.id === id ? { ...r, qtyStr: v } : r)));
  const removeMat = (id: string) => setMaterials((rows) => rows.filter((r) => r.id !== id));

  const addLabour = () => setLabour((l) => [...l, { id: nextId(), role: '', linkedMaterialId: null, unit: 'day', qtyStr: '', rateStr: '', finalStr: '' }]);
  const setLab = (id: string, field: 'role' | 'unit' | 'qtyStr' | 'rateStr' | 'finalStr', v: string) =>
    setLabour((l) => l.map((r) => (r.id === id ? { ...r, [field]: v } : r)));
  const setLabLink = (id: string, materialId: string | null) =>
    setLabour((l) => l.map((r) => (r.id === id ? { ...r, linkedMaterialId: materialId } : r)));
  const labourUnitLabel = (u: string) => (u === 'day' ? t('costCalc.dayUnit') : unitLabel(u));

  /** Effective quantity/unit/rate for a labour row — from the linked material when set. */
  function labourEffective(l: LabourRow) {
    const linked = l.linkedMaterialId ? materials.find((m) => m.id === l.linkedMaterialId) : null;
    return {
      linked,
      quantity: linked ? parseDecimal(linked.qtyStr) ?? 0 : parseDecimal(l.qtyStr) ?? 0,
      unit: linked ? linked.unit : l.unit,
      ratePerUnit: parseDecimal(l.rateStr) ?? 0,
      finalPriceEur: l.finalStr.trim() === '' ? null : parseDecimal(l.finalStr),
    };
  }
  const removeLab = (id: string) => setLabour((l) => l.filter((r) => r.id !== id));

  // Everything below is derived — the results update live on every keystroke.
  const input: CostCalcInput = useMemo(
    () => ({
      materials: materials.map((r) => ({
        productId: r.productId,
        name: r.name,
        unit: r.unit,
        priceMkd: r.priceMkd,
        priceEur: parseDecimal(r.priceEurStr) ?? 0,
        overridden: r.overridden,
        quantity: parseDecimal(r.qtyStr) ?? 0,
      })),
      labourLumpSumEur: parseDecimal(lumpSumStr) ?? 0,
      labourItems: labour.map((l) => {
        const e = labourEffective(l);
        return { role: l.role, quantity: e.quantity, unit: e.unit, ratePerUnit: e.ratePerUnit, finalPriceEur: e.finalPriceEur };
      }),
      areaM2: parseDecimal(areaStr),
      salePricePerM2Eur: saleStr.trim() === '' ? null : parseDecimal(saleStr),
    }),
    [materials, lumpSumStr, labour, areaStr, saleStr]
  );
  const out = useMemo(() => computeCost(input), [input]);

  const money = (n: number | null) => (n == null ? '—' : formatEUR(n));

  // Export the live calc to a PDF (server reuses the order PDF pipeline). Nothing
  // is saved — we POST exactly what's on screen and stream back the PDF.
  const canExport = materials.length > 0 || out.labourTotal > 0;
  async function exportPdf() {
    if (!canExport || exporting) return;
    setExporting(true);
    try {
      const payload = {
        lang: i18n.language,
        areaM2: parseDecimal(areaStr) ?? 0,
        rate,
        materials: materials.map((r, i) => ({
          name: r.name,
          unit: r.unit,
          priceEur: parseDecimal(r.priceEurStr) ?? 0,
          quantity: parseDecimal(r.qtyStr) ?? 0,
          lineCost: out.lineCosts[i] ?? 0,
        })),
        materialsTotal: out.materialsTotal,
        labourLumpSum: parseDecimal(lumpSumStr) ?? 0,
        labourItems: labour.map((l) => {
          const e = labourEffective(l);
          const cost = Math.round(labourLineCost({ role: l.role, quantity: e.quantity, unit: e.unit, ratePerUnit: e.ratePerUnit, finalPriceEur: e.finalPriceEur }) * 100) / 100;
          return { role: l.role, quantity: e.quantity, unit: e.unit, ratePerUnit: e.ratePerUnit, cost };
        }),
        labourTotal: out.labourTotal,
        totalCost: out.totalCost,
        costPerM2: out.costPerM2,
        sale:
          out.saleTotal == null
            ? null
            : {
                salePricePerM2: parseDecimal(saleStr) ?? 0,
                saleTotal: out.saleTotal,
                profit: out.profit ?? 0,
                profitPerM2: out.profitPerM2,
                margin: out.margin,
              },
      };
      const res = await fetch(`${API_BASE}/cost-calc/pdf`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cost-per-m2.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.show(t('costCalc.pdfError'));
    } finally {
      setExporting(false);
    }
  }

  const pickerQuery = pickerSearch.trim().toLowerCase();
  const pickerProducts = pickerQuery
    ? activeProducts.filter(
        (p) =>
          productName(p.name).toLowerCase().includes(pickerQuery) ||
          categoryName(p.category).toLowerCase().includes(pickerQuery)
      )
    : activeProducts;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('costCalc.title')}</h1>
          <p className="text-app-secondary text-sm mt-1">{t('costCalc.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 min-h-[40px] text-sm text-app-secondary hover:text-app-primary hover:bg-[var(--hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition"
          aria-label={t('costCalc.howItWorks')}
        >
          <Info size={16} />
          <span className="hidden sm:inline">{t('costCalc.howItWorks')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 md:gap-6 items-start">
        {/* LEFT: inputs */}
        <div className="space-y-4 md:space-y-6 min-w-0">
          {/* Materials */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-app-primary">{t('costCalc.materials')}</h2>
                <p className="text-app-muted text-xs mt-0.5">{t('costCalc.rateNote', { rate })} · <Link to="/app/settings?section=exchange-rate" className="text-app-accent hover:underline">{t('costCalc.rateEdit')}</Link></p>
              </div>
              <Button type="button" size="sm" onClick={() => setPickerOpen(true)}>
                <Plus size={16} /> {t('costCalc.addMaterial')}
              </Button>
            </CardHeader>
            <CardContent>
              {materials.length === 0 ? (
                <p className="text-app-muted text-sm py-6 text-center">{t('costCalc.noMaterials')}</p>
              ) : (
                <div className="space-y-2">
                  {/* Column labels (desktop) */}
                  <div className="hidden md:grid grid-cols-[1fr_120px_100px_110px_36px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-app-muted">
                    <span>{t('costCalc.material')}</span>
                    <span className="text-right">{t('costCalc.unitPrice')}</span>
                    <span className="text-right">{t('costCalc.quantity')}</span>
                    <span className="text-right">{t('costCalc.lineCost')}</span>
                    <span />
                  </div>
                  {materials.map((r, i) => (
                    <div key={r.id} className="grid grid-cols-2 md:grid-cols-[1fr_120px_100px_110px_36px] gap-2 items-center rounded-lg border border-[var(--border)] p-2 md:border-0 md:p-1">
                      <div className="col-span-2 md:col-span-1 min-w-0">
                        <p className="text-sm font-medium text-app-primary truncate">{productName(r.name)}</p>
                        <p className="text-xs text-app-muted">
                          {unitLabel(r.unit)} · {formatMKDPlain(r.priceMkd)}
                          {!r.overridden && <span className="text-app-accent"> · {t('costCalc.auto')}</span>}
                        </p>
                      </div>
                      <div>
                        <Input
                          type="text"
                          inputMode="decimal"
                          aria-label={t('costCalc.unitPrice')}
                          value={r.priceEurStr}
                          onChange={(e) => setMatPrice(r.id, e.target.value)}
                          className="text-right !min-h-[40px]"
                        />
                      </div>
                      <div>
                        <Input
                          type="text"
                          inputMode="decimal"
                          aria-label={t('costCalc.quantity')}
                          value={r.qtyStr}
                          onChange={(e) => setMatQty(r.id, e.target.value)}
                          className="text-right !min-h-[40px]"
                        />
                      </div>
                      <div className="text-right text-sm font-semibold text-app-primary tabular-nums">
                        {money(out.lineCosts[i] ?? 0)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMat(r.id)}
                        aria-label={t('costCalc.remove')}
                        className="justify-self-end flex h-8 w-8 items-center justify-center rounded-md text-app-danger hover:bg-app-danger-muted transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[var(--border)] pt-2 text-sm">
                    <span className="text-app-secondary">{t('costCalc.materialsTotal')}</span>
                    <span className="font-semibold text-app-primary tabular-nums">{money(out.materialsTotal)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Labour */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-app-primary">{t('costCalc.labour')}</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('costCalc.lumpSum')}</label>
                <div className="max-w-[220px]">
                  <Input type="text" inputMode="decimal" value={lumpSumStr} onChange={(e) => setLumpSumStr(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              {labour.length > 0 && (
                <div className="space-y-3">
                  {labour.map((l) => {
                    const e = labourEffective(l);
                    const isLinked = !!e.linked;
                    const hasFinal = e.finalPriceEur != null;
                    const lineCost = labourLineCost({ role: l.role, quantity: e.quantity, unit: e.unit, ratePerUnit: e.ratePerUnit, finalPriceEur: e.finalPriceEur });
                    const field = (label: string, node: ReactNode) => (
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-app-muted">{label}</span>
                        {node}
                      </label>
                    );
                    return (
                      <div key={l.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2.5">
                        {/* Role + optional link to a material */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input type="text" aria-label={t('costCalc.role')} value={l.role} onChange={(ev) => setLab(l.id, 'role', ev.target.value)} placeholder={t('costCalc.rolePlaceholder')} className="!min-h-[40px] flex-1" />
                          <div className="flex items-center gap-2">
                            <Select
                              aria-label={t('costCalc.linkMaterial')}
                              value={l.linkedMaterialId ?? ''}
                              onChange={(ev) => setLabLink(l.id, ev.target.value || null)}
                              className="!min-h-[40px] w-full sm:w-[200px]"
                            >
                              <option value="">{t('costCalc.noLink')}</option>
                              {materials.map((m) => (
                                <option key={m.id} value={m.id}>{productName(m.name)}</option>
                              ))}
                            </Select>
                            <button type="button" onClick={() => removeLab(l.id)} aria-label={t('costCalc.remove')} className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md text-app-danger hover:bg-app-danger-muted transition">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        {/* Unit · Qty · Rate · Final → Cost */}
                        <div className="grid grid-cols-2 sm:grid-cols-[90px_1fr_1fr_1fr_auto] gap-2 sm:items-end">
                          {field(t('costCalc.unit'), (
                            <Select aria-label={t('costCalc.unit')} value={e.unit} onChange={(ev) => setLab(l.id, 'unit', ev.target.value)} disabled={isLinked} className={`!min-h-[40px] ${isLinked || hasFinal ? 'opacity-60' : ''}`}>
                              {LABOUR_UNITS.map((u) => <option key={u} value={u}>{labourUnitLabel(u)}</option>)}
                            </Select>
                          ))}
                          {field(t('costCalc.quantity'), (
                            <Input type="text" inputMode="decimal" aria-label={t('costCalc.quantity')} value={isLinked ? String(e.quantity) : l.qtyStr} onChange={(ev) => setLab(l.id, 'qtyStr', ev.target.value)} disabled={isLinked} className={`text-right !min-h-[40px] ${isLinked || hasFinal ? 'opacity-60' : ''}`} />
                          ))}
                          {field(`${t('costCalc.rate')} (€/${labourUnitLabel(e.unit)})`, (
                            <Input type="text" inputMode="decimal" aria-label={t('costCalc.rate')} value={l.rateStr} onChange={(ev) => setLab(l.id, 'rateStr', ev.target.value)} className={`text-right !min-h-[40px] ${hasFinal ? 'opacity-60' : ''}`} />
                          ))}
                          {field(t('costCalc.finalPrice'), (
                            <Input type="text" inputMode="decimal" aria-label={t('costCalc.finalPrice')} value={l.finalStr} onChange={(ev) => setLab(l.id, 'finalStr', ev.target.value)} placeholder={t('costCalc.optional')} className="text-right !min-h-[40px]" />
                          ))}
                          <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:justify-end sm:min-w-[90px] sm:pb-2">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-app-muted sm:hidden">{t('costCalc.lineCost')}</span>
                            <span className="text-sm font-semibold text-app-primary tabular-nums">{money(Math.round(lineCost * 100) / 100)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button type="button" variant="secondary" size="sm" onClick={addLabour}>
                  <Plus size={16} /> {t('costCalc.addLabourLine')}
                </Button>
                <div className="text-sm">
                  <span className="text-app-secondary">{t('costCalc.labourTotal')} </span>
                  <span className="font-semibold text-app-primary tabular-nums">{money(out.labourTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Area + sale price */}
          <Card>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('costCalc.area')}</label>
                  <Input type="text" inputMode="decimal" value={areaStr} onChange={(e) => setAreaStr(e.target.value)} placeholder="100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('costCalc.salePrice')}</label>
                  <Input type="text" inputMode="decimal" value={saleStr} onChange={(e) => setSaleStr(e.target.value)} placeholder={t('costCalc.optional')} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: live results */}
        <div>
          <Card className="lg:sticky lg:top-6">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-app-primary">{t('costCalc.results')}</h2>
              <Button type="button" size="sm" variant="secondary" onClick={exportPdf} disabled={!canExport || exporting}>
                <Download size={16} /> {exporting ? t('costCalc.exporting') : t('costCalc.exportPdf')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-app-secondary">{t('costCalc.materialsTotal')}</dt><dd className="tabular-nums text-app-primary">{money(out.materialsTotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-app-secondary">{t('costCalc.labourTotal')}</dt><dd className="tabular-nums text-app-primary">{money(out.labourTotal)}</dd></div>
                <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold"><dt className="text-app-primary">{t('costCalc.totalCost')}</dt><dd className="tabular-nums text-app-primary">{money(out.totalCost)}</dd></div>
              </dl>

              {/* Headline: cost per m² */}
              <div className="rounded-xl bg-app-surface-subtle p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-app-muted">{t('costCalc.costPerM2')}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-app-accent">
                  {out.costPerM2 == null ? '—' : formatEUR(out.costPerM2)}
                </p>
                {out.costPerM2 == null && <p className="mt-1 text-xs text-app-muted">{t('costCalc.enterArea')}</p>}
              </div>

              {/* Profit block — only when a sale price is entered */}
              {out.saleTotal != null && (
                <dl className="space-y-2 border-t border-[var(--border)] pt-4 text-sm">
                  <div className="flex justify-between"><dt className="text-app-secondary">{t('costCalc.saleTotal')}</dt><dd className="tabular-nums text-app-primary">{money(out.saleTotal)}</dd></div>
                  <div className="flex justify-between">
                    <dt className="text-app-secondary">{(out.profit ?? 0) < 0 ? t('costCalc.loss') : t('costCalc.profit')}</dt>
                    <dd className={`tabular-nums font-semibold ${(out.profit ?? 0) < 0 ? 'text-app-danger' : 'text-app-success'}`}>{money(out.profit)}</dd>
                  </div>
                  <div className="flex justify-between"><dt className="text-app-secondary">{t('costCalc.profitPerM2')}</dt><dd className="tabular-nums text-app-primary">{money(out.profitPerM2)}</dd></div>
                  <div className="flex justify-between"><dt className="text-app-secondary">{t('costCalc.margin')}</dt><dd className="tabular-nums text-app-primary">{out.margin == null ? '—' : formatPercent(out.margin, 1)}</dd></div>
                </dl>
              )}

              <p className="text-[11px] text-app-muted text-center">{t('costCalc.notSaved')}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Product picker (reuses the products catalogue + catalog helpers) */}
      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title={t('costCalc.infoTitle')}>
        <div className="space-y-4 text-sm">
          <p className="text-app-secondary">{t('costCalc.infoIntro')}</p>
          <ol className="space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n}>
                <p className="font-semibold text-app-primary">{t(`costCalc.infoStep${n}Title`)}</p>
                <p className="text-app-secondary mt-0.5">{t(`costCalc.infoStep${n}`, { rate })}</p>
              </li>
            ))}
          </ol>
          <div>
            <p className="font-semibold text-app-primary mb-1.5">{t('costCalc.infoFormulas')}</p>
            <pre className="text-xs text-app-secondary bg-app-surface-2 border border-[var(--border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
{`lineCost       = €price × quantity
materialsTotal = Σ lineCost
labourTotal    = lumpSum + Σ (quantity × rate)
totalCost      = materialsTotal + labourTotal
costPerM²      = totalCost ÷ area
saleTotal      = salePerM² × area
profit         = saleTotal − totalCost
margin %       = profit ÷ saleTotal × 100`}
            </pre>
          </div>
        </div>
      </Modal>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('costCalc.pickProduct')}>
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder={t('costCalc.searchProducts')}
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-app-surface-1 pl-10 pr-10 text-app-primary min-h-[48px] focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-ring)]"
            />
            {pickerSearch && (
              <button type="button" onClick={() => setPickerSearch('')} aria-label={t('costCalc.remove')} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-app-muted hover:text-app-primary hover:bg-[var(--hover)]">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="max-h-[50vh] overflow-y-auto scroll-thin -mx-1">
            {isLoading ? (
              <p className="text-app-muted text-sm py-8 text-center">{t('common.loading')}</p>
            ) : pickerProducts.length === 0 ? (
              <p className="text-app-muted text-sm py-8 text-center">{t('costCalc.noProducts')}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {pickerProducts.map((p) => (
                  <li key={p.id}>
                    <button type="button" data-testid="pick-item" onClick={() => addMaterial(p)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-app-surface-subtle transition rounded-lg">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-app-primary truncate">{productName(p.name)}</span>
                        <span className="block text-xs text-app-muted">{categoryName(p.category)} · {unitLabel(p.measurementUnit)}</span>
                      </span>
                      <span className="text-sm font-semibold text-app-primary tabular-nums shrink-0">{formatMKDPlain(Number(p.price))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
