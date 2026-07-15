import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { MEASUREMENT_UNITS } from '../constants/measurementUnits';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableActionButton,
  EmptyState,
} from '../components/ui';
import { formatMKD } from '../lib/formatMKD';
import { productName, categoryName } from '../lib/catalog';
import { unitLabel } from '../lib/units';

interface Product {
  id: string;
  name: string;
  category: string;
  measurementUnit: string;
  price: number | string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function IconEdit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
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

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function Products() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryInputRef = useRef<HTMLDivElement>(null);
  const categoryFieldRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    category: '',
    measurementUnit: 'adet' as (typeof MEASUREMENT_UNITS)[number],
    price: 0,
    status: 'ACTIVE',
  });
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { canWrite } = useAuth();

  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });
  const { data: categoriesData } = useQuery({
    queryKey: ['products', 'categories'],
    queryFn: () => api.get<string[]>('/products/categories'),
  });
  const products = data?.data ?? [];
  const categoriesFromApi = categoriesData?.data ?? [];
  const categories = categoriesFromApi.length > 0 ? categoriesFromApi : Array.from(new Set(products.map((p) => p.category))).sort();
  let filtered = products;
  if (search.trim()) filtered = filtered.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));
  if (categoryFilter) filtered = filtered.filter((p) => p.category === categoryFilter);
  const byCategory = filtered.reduce<Record<string, Product[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] ?? []).push(p);
    return acc;
  }, {});

  const create = useMutation({
    mutationFn: (body: typeof form) => api.post<Product>('/products', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'recent'] });
      setModalOpen(false);
      resetForm();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<typeof form> }) =>
      api.put<Product>(`/products/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'recent'] });
      setModalOpen(false);
      setEditing(null);
      resetForm();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'recent'] });
      setDeleteConfirm(null);
    },
  });

  function resetForm() {
    setForm({ name: '', category: '', measurementUnit: 'adet', price: 0, status: 'ACTIVE' });
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      measurementUnit: (MEASUREMENT_UNITS as readonly string[]).includes(p.measurementUnit) ? p.measurementUnit as (typeof MEASUREMENT_UNITS)[number] : 'adet',
      price: Number(p.price),
      status: p.status,
    });
    setModalOpen(true);
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setModalOpen(true);
  }

  const categorySuggestions = form.category.trim()
    ? categories.filter((c) => c.toLowerCase().includes(form.category.trim().toLowerCase())).slice(0, 8)
    : categories.slice(0, 8);
  // Offer to create the typed value when it isn't an existing category.
  const categoryTyped = form.category.trim();
  const categoryCanCreate = categoryTyped !== '' && !categories.some((c) => c.toLowerCase() === categoryTyped.toLowerCase());

  function startNewCategory() {
    setForm((f) => ({ ...f, category: '' }));
    setCategoryDropdownOpen(true);
    setTimeout(() => categoryFieldRef.current?.focus(), 0);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoryInputRef.current && !categoryInputRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleCategory(cat: string) {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) update.mutate({ id: editing.id, body: form });
    else create.mutate(form);
  }

  return (
    <div className="page-container space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('products.title')}</h1>
        {canWrite && (
          <Button onClick={openCreate} className="w-full sm:w-auto min-h-[48px]">{t('products.addProduct')}</Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="text"
          placeholder={t('products.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full sm:max-w-[200px] min-h-[48px]"
        >
          <option value="">{t('products.allCategories')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>{categoryName(c)}</option>
          ))}
        </Select>
      </div>

      {Object.entries(byCategory)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, items]) => {
          const isOpen = openCategories[category] !== false;
          return (
            <Card key={category} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer select-none flex flex-row items-center justify-between gap-2"
                onClick={() => toggleCategory(category)}
              >
                <h2 className="text-sm font-semibold text-app-accent">{categoryName(category)}</h2>
                <span className="text-app-secondary"><IconChevron open={isOpen} /></span>
              </CardHeader>
              {isOpen && (
                <CardContent className="p-0 pt-0">
                  {/* Mobile: product cards */}
                  <div className="md:hidden divide-y divide-[var(--border)]">
                    {items.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-app-primary truncate">{productName(p.name)}</p>
                          <p className="text-app-secondary text-sm">{unitLabel(p.measurementUnit)} · {formatMKD(Number(p.price))}</p>
                          <Badge variant={p.status === 'ACTIVE' ? 'success' : 'default'} className="mt-1">
                            {p.status === 'ACTIVE' ? t('status.active') : t('status.inactive')}
                          </Badge>
                        </div>
                        {canWrite && (
                          <div className="flex gap-1 shrink-0">
                            <TableActionButton onClick={() => openEdit(p)} aria-label={t('common.edit')}>
                              <span className="text-app-accent"><IconEdit /></span>
                            </TableActionButton>
                            <TableActionButton onClick={() => setDeleteConfirm(p)} aria-label={t('common.delete')}>
                              <span className="text-app-danger"><IconTrash /></span>
                            </TableActionButton>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableHead>{t('common.name')}</TableHead>
                        <TableHead>{t('products.measurementUnit')}</TableHead>
                        <TableHead className="text-right">{t('products.price')}</TableHead>
                        <TableHead>{t('common.status')}</TableHead>
                        <TableHead className="text-right w-24">{t('common.actions')}</TableHead>
                      </TableHeader>
                      <TableBody>
                        {items.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-app-primary font-medium">{productName(p.name)}</TableCell>
                            <TableCell>{unitLabel(p.measurementUnit)}</TableCell>
                            <TableCell className="text-right text-app-accent">{formatMKD(Number(p.price))}</TableCell>
                            <TableCell>
                              <Badge variant={p.status === 'ACTIVE' ? 'success' : 'default'}>
                                {p.status === 'ACTIVE' ? t('status.active') : t('status.inactive')}
                              </Badge>
                            </TableCell>
                          <TableCell className="text-right">
                            {canWrite && (
                              <div className="flex justify-end gap-1">
                                <TableActionButton onClick={() => openEdit(p)} aria-label={t('common.edit')}>
                                  <span className="text-app-accent"><IconEdit /></span>
                                </TableActionButton>
                                <TableActionButton onClick={() => setDeleteConfirm(p)} aria-label={t('common.delete')}>
                                  <span className="text-app-danger"><IconTrash /></span>
                                </TableActionButton>
                              </div>
                            )}
                          </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

      {Object.keys(byCategory).length === 0 && (
        <Card>
          {search.trim() || categoryFilter ? (
            <EmptyState compact icon={<Package size={24} />} title={t('products.noMatch')} />
          ) : (
            <EmptyState
              icon={<Package size={26} />}
              title={t('products.noProducts')}
              description={t('products.noProductsSub')}
              action={canWrite ? { label: t('products.addProduct'), onClick: openCreate } : undefined}
            />
          )}
        </Card>
      )}

      {canWrite && (
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? t('products.editProduct') : t('products.addProduct')}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditing(null); }} className="flex-1 sm:flex-initial min-h-[48px]">
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="product-form" disabled={create.isPending || update.isPending} className="flex-1 sm:flex-initial min-h-[48px] w-full sm:w-auto">
              {editing ? t('common.update') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('common.name')} *</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div ref={categoryInputRef} className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-app-secondary">{t('products.category')} *</label>
              <button
                type="button"
                onClick={startNewCategory}
                className="inline-flex items-center gap-1 text-xs font-semibold text-app-accent hover:text-app-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] rounded"
              >
                <Plus size={14} /> {t('products.newCategory')}
              </button>
            </div>
            <Input
              ref={categoryFieldRef}
              value={form.category}
              onChange={(e) => {
                setForm((f) => ({ ...f, category: e.target.value }));
                setCategoryDropdownOpen(true);
              }}
              onFocus={() => setCategoryDropdownOpen(true)}
              autoComplete="off"
              required
              placeholder={t('products.pickOrType')}
            />
            {categoryDropdownOpen && (categoryCanCreate || categorySuggestions.length > 0) && (
              <ul
                className="glass absolute z-50 mt-1 w-full rounded-xl border border-[var(--border)] shadow-modal max-h-52 overflow-y-auto py-1"
                style={{ background: 'var(--glass-bg-strong)' }}
                role="listbox"
              >
                {categoryCanCreate && (
                  <li
                    role="option"
                    className="px-4 py-2.5 cursor-pointer hover:bg-app-accent-muted flex items-center gap-2 text-app-accent font-medium border-b border-[var(--border)]"
                    onClick={() => setCategoryDropdownOpen(false)}
                  >
                    <Plus size={16} className="shrink-0" /> {t('products.addAsNew', { name: categoryTyped })}
                  </li>
                )}
                {categorySuggestions.map((c) => (
                  <li
                    key={c}
                    role="option"
                    className="px-4 py-2.5 text-app-primary cursor-pointer hover:bg-[var(--hover)] focus:bg-app-surface-1"
                    onClick={() => {
                      setForm((f) => ({ ...f, category: c }));
                      setCategoryDropdownOpen(false);
                    }}
                  >
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('products.measurementUnit')} *</label>
            <Select
              value={form.measurementUnit}
              onChange={(e) => setForm((f) => ({ ...f, measurementUnit: e.target.value as (typeof MEASUREMENT_UNITS)[number] }))}
              required
            >
              {MEASUREMENT_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('products.price')} *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
              required
            />
          </div>
          {editing && (
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('common.status')}</label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="ACTIVE">{t('status.active')}</option>
                <option value="INACTIVE">{t('status.inactive')}</option>
              </Select>
            </div>
          )}
        </form>
      </Modal>
      )}

      {canWrite && (
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('products.deleteProduct')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1 sm:flex-initial min-h-[48px]">{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => deleteConfirm && remove.mutate(deleteConfirm.id)} className="flex-1 sm:flex-initial min-h-[48px] w-full sm:w-auto">
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-app-secondary">{t('products.deleteConfirm', { name: deleteConfirm?.name })}</p>
      </Modal>
      )}
    </div>
  );
}
