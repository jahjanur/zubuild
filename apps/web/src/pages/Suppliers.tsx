import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { snapshotList, patchList, restoreList, type ListCache } from '../lib/optimistic';
import { useAuth } from '../lib/useAuth';
import { useToast } from '../context/ToastContext';
import { Truck } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Modal,
  Input,
  Select,
  Badge,
  TableActionButton,
  EmptyState,
} from '../components/ui';

interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  location: string | null;
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
function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

const TOAST = {
  deleteSuccess: 'Tedarikçi silindi.',
  deleteBlocked: 'Silinemedi: Bu tedarikçi siparişlerde kullanılıyor. Pasif yapabilirsiniz.',
  sessionExpired: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.',
  deleteFail: 'Silinemedi. Lütfen tekrar deneyin.',
  setPassiveSuccess: 'Tedarikçi pasif yapıldı.',
};

export default function Suppliers() {
  const { t } = useTranslation();
  const { canWrite } = useAuth();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);
  const [deleteBlockedSupplier, setDeleteBlockedSupplier] = useState<Supplier | null>(null);
  const [phoneError, setPhoneError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    location: '',
    status: 'ACTIVE',
  });
  const queryClient = useQueryClient();

  function sanitizePhone(value: string): string {
    const allowed = value.replace(/[^\d\s+]/g, '');
    const withPlus = allowed.startsWith('+') ? allowed : allowed.replace(/\+/g, '');
    return withPlus;
  }
  /** For tel: href — digits only, optional leading + */
  function phoneToTel(phone: string | null): string {
    if (!phone || !phone.trim()) return '';
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    const prefix = phone.trimStart().startsWith('+') ? '+' : '';
    return `tel:${prefix}${digits}`;
  }

  const { data } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });
  const allSuppliers = data?.data ?? [];
  const q = searchQuery.trim().toLowerCase();
  const suppliers = q
    ? allSuppliers.filter(
        (s) =>
          s.companyName.toLowerCase().includes(q) ||
          (s.contactPerson?.toLowerCase().includes(q) ?? false) ||
          (s.phone?.toLowerCase().includes(q) ?? false) ||
          (s.location?.toLowerCase().includes(q) ?? false)
      )
    : allSuppliers;

  const KEY = ['suppliers'] as const;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await api.post<Supplier>('/suppliers', body);
      if (!res.success) throw res;
      return res;
    },
    onMutate: async (body: typeof form) => {
      const prev = await snapshotList<Supplier>(queryClient, KEY);
      const now = new Date().toISOString();
      const optimistic: Supplier = {
        id: `temp-${Date.now()}`,
        companyName: body.companyName,
        contactPerson: body.contactPerson || null,
        phone: body.phone || null,
        location: body.location || null,
        status: body.status,
        createdAt: now,
        updatedAt: now,
      };
      patchList<Supplier>(queryClient, KEY, (list) => [optimistic, ...list]);
      setModalOpen(false); // close instantly — the row is already in the list
      resetForm();
      return { prev };
    },
    onError: (err: { error?: string; code?: string }, _vars, ctx?: { prev: ListCache<Supplier> }) => {
      restoreList(queryClient, KEY, ctx?.prev);
      const msg = err.code === 'INVALID_PHONE' ? t('suppliers.phoneInvalid') : err.error ?? TOAST.deleteFail;
      toast.show(msg, 'error');
    },
    onSettled: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<typeof form> }) => {
      const res = await api.put<Supplier>(`/suppliers/${id}`, body);
      if (!res.success) throw res;
      return res;
    },
    onMutate: async ({ id, body }: { id: string; body: Partial<typeof form> }) => {
      const prev = await snapshotList<Supplier>(queryClient, KEY);
      patchList<Supplier>(queryClient, KEY, (list) =>
        list.map((s) => (s.id === id ? { ...s, ...body, updatedAt: new Date().toISOString() } : s))
      );
      setModalOpen(false);
      setEditing(null);
      resetForm();
      return { prev };
    },
    onError: (err: { error?: string; code?: string }, _vars, ctx?: { prev: ListCache<Supplier> }) => {
      restoreList(queryClient, KEY, ctx?.prev);
      const msg = err.code === 'INVALID_PHONE' ? t('suppliers.phoneInvalid') : err.error ?? TOAST.deleteFail;
      toast.show(msg, 'error');
    },
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (payload: { supplier: Supplier }) => {
      const res = await api.delete(`/suppliers/${payload.supplier.id}`);
      if (!res.success) throw { ...res, __supplier: payload.supplier };
      return res;
    },
    onMutate: async ({ supplier }: { supplier: Supplier }) => {
      const prev = await snapshotList<Supplier>(queryClient, KEY);
      patchList<Supplier>(queryClient, KEY, (list) => list.filter((s) => s.id !== supplier.id));
      setDeleteConfirm(null); // the row is already gone from the list
      return { prev };
    },
    onSuccess: () => {
      setDeleteBlockedSupplier(null);
      toast.show(TOAST.deleteSuccess, 'success');
    },
    onError: (err: { error?: string; status?: number; code?: string; __supplier?: Supplier }, _vars, ctx?: { prev: ListCache<Supplier> }) => {
      restoreList(queryClient, KEY, ctx?.prev); // put the supplier back
      const supplier = err.__supplier;
      const msg =
        err.status === 409 || err.code === 'SUPPLIER_HAS_ORDERS'
          ? TOAST.deleteBlocked
          : err.status === 401 || err.status === 403
            ? TOAST.sessionExpired
            : TOAST.deleteFail;
      toast.show(msg, 'error');
      if (err.code === 'SUPPLIER_HAS_ORDERS' && supplier) setDeleteBlockedSupplier(supplier);
    },
    onSettled: invalidate,
  });
  const setPassive = useMutation({
    mutationFn: (supplier: Supplier) =>
      api.put<Supplier>(`/suppliers/${supplier.id}`, { status: 'INACTIVE' }),
    onMutate: async (supplier: Supplier) => {
      const prev = await snapshotList<Supplier>(queryClient, KEY);
      patchList<Supplier>(queryClient, KEY, (list) =>
        list.map((s) => (s.id === supplier.id ? { ...s, status: 'INACTIVE' } : s))
      );
      setDeleteConfirm(null);
      setDeleteBlockedSupplier(null);
      return { prev };
    },
    onSuccess: () => {
      toast.show(TOAST.setPassiveSuccess, 'success');
    },
    onError: (_err, _vars, ctx?: { prev: ListCache<Supplier> }) => {
      restoreList(queryClient, KEY, ctx?.prev);
      toast.show(TOAST.deleteFail, 'error');
    },
    onSettled: invalidate,
  });

  function resetForm() {
    setForm({
      companyName: '',
      contactPerson: '',
      phone: '',
      location: '',
      status: 'ACTIVE',
    });
    setPhoneError(false);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setPhoneError(false);
    setForm({
      companyName: s.companyName,
      contactPerson: s.contactPerson ?? '',
      phone: s.phone ?? '',
      location: s.location ?? '',
      status: s.status,
    });
    setModalOpen(true);
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phoneError || (form.phone.length > 0 && !/^\+?[0-9\s]+$/.test(form.phone))) {
      setPhoneError(true);
      return;
    }
    if (editing) {
      update.mutate({ id: editing.id, body: form });
    } else {
      create.mutate(form);
    }
  }

  return (
    <div className="page-container space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('suppliers.title')}</h1>
        {canWrite && (
          <Button onClick={openCreate} className="w-full sm:w-auto min-h-[48px]">{t('suppliers.addSupplier')}</Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="block text-sm font-medium text-app-secondary shrink-0">{t('suppliers.searchSuppliers')}</label>
        <Input
          placeholder={t('suppliers.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
          className="max-w-md"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {suppliers.length === 0 ? (
          <div className="col-span-full">
            {q ? (
              <EmptyState compact icon={<Truck size={24} />} title={t('suppliers.noSearchResults')} />
            ) : (
              <EmptyState
                icon={<Truck size={26} />}
                title={t('suppliers.noSuppliers')}
                description={t('suppliers.noSuppliersSub')}
                action={canWrite ? { label: t('suppliers.addSupplier'), onClick: openCreate } : undefined}
              />
            )}
          </div>
        ) : null}
        {suppliers.map((s) => (
          <Card key={s.id} className="p-0">
            <CardContent className="flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-app-primary truncate">{s.companyName}</h3>
                  <p className="text-app-secondary text-sm mt-0.5">{s.contactPerson || '—'}</p>
                  <p className="text-app-muted text-sm">{s.phone || '—'}</p>
                  <div className="mt-2">
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : 'default'}>
                      {s.status === 'ACTIVE' ? t('status.active') : t('status.inactive')}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {phoneToTel(s.phone) ? (
                    <a
                      href={phoneToTel(s.phone)}
                      className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-app-secondary hover:bg-[var(--hover)] hover:text-app-primary focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                      aria-label="Ara"
                      title="Ara"
                    >
                      <span className="text-app-accent"><IconPhone /></span>
                    </a>
                  ) : (
                    <span
                      className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-app-muted cursor-not-allowed"
                      title="Telefon yok"
                      aria-label="Telefon yok"
                    >
                      <IconPhone />
                    </span>
                  )}
                  {canWrite && (
                    <>
                      <TableActionButton onClick={() => openEdit(s)} aria-label={t('common.edit')}>
                        <span className="text-app-accent"><IconEdit /></span>
                      </TableActionButton>
                      <TableActionButton onClick={() => setDeleteConfirm(s)} aria-label={t('common.delete')}>
                        <span className="text-app-danger"><IconTrash /></span>
                      </TableActionButton>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {canWrite && (
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditing(null); }} className="flex-1 sm:flex-initial min-h-[48px]">
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="supplier-form"
              disabled={create.isPending || update.isPending}
              className="flex-1 sm:flex-initial min-h-[48px] w-full sm:w-auto"
            >
              {editing ? t('common.update') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('suppliers.companyName')} *</label>
            <Input
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('suppliers.contactPerson')}</label>
            <Input
              value={form.contactPerson}
              onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('suppliers.phone')}</label>
            <Input
              inputMode="numeric"
              pattern="[0-9 +]*"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => {
                const raw = e.target.value;
                const next = sanitizePhone(raw);
                setPhoneError(raw !== next);
                setForm((f) => ({ ...f, phone: next }));
              }}
              error={phoneError ? t('suppliers.phoneInvalid') : undefined}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('suppliers.location')}</label>
            <Input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </div>
          {editing && (
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('common.status')}</label>
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
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
        onClose={() => { setDeleteConfirm(null); setDeleteBlockedSupplier(null); }}
        title={t('suppliers.deleteSupplier')}
        footer={
          deleteBlockedSupplier ? (
            <>
              <Button variant="secondary" onClick={() => { setDeleteConfirm(null); setDeleteBlockedSupplier(null); }} className="flex-1 sm:flex-initial min-h-[48px]">{t('common.close')}</Button>
              <Button
                variant="primary"
                onClick={() => deleteBlockedSupplier && setPassive.mutate(deleteBlockedSupplier)}
                disabled={setPassive.isPending}
                className="flex-1 sm:flex-initial min-h-[48px] w-full sm:w-auto"
              >
                {setPassive.isPending ? t('common.saving') : 'Pasif yap'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1 sm:flex-initial min-h-[48px]">{t('common.cancel')}</Button>
              <Button
                variant="danger"
                onClick={() => deleteConfirm && remove.mutate({ supplier: deleteConfirm })}
                disabled={remove.isPending}
                className="flex-1 sm:flex-initial min-h-[48px] w-full sm:w-auto"
              >
                {t('common.delete')}
              </Button>
            </>
          )
        }
      >
        {deleteBlockedSupplier ? (
          <p className="text-app-secondary">
            Bu tedarikçi siparişlerde kullanıldığı için silinemez. Silmek yerine &quot;Pasif yap&quot; ile listeden kaldırabilirsiniz.
          </p>
        ) : (
          <p className="text-app-secondary">
            {t('suppliers.deleteConfirm', { name: deleteConfirm?.companyName ?? '' })}
          </p>
        )}
      </Modal>
      )}
    </div>
  );
}
