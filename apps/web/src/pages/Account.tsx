import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, Button, Input, Textarea, Badge } from '../components/ui';
import { useAuth } from '../lib/useAuth';
import { useOrg } from '../lib/useOrg';
import { useToast } from '../context/ToastContext';

const LOGO_MAX_BYTES = 400_000;

export default function Account() {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const change = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: (res) => {
      if (res.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirm('');
        toast.show(t('account.changed'));
      } else if (res.error) toast.show(res.error);
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : t('account.changePassword')),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.show(t('account.mismatch'));
      return;
    }
    change.mutate();
  }

  const roleLabel = (r?: string) => (r === 'ADMIN' ? t('team.roleAdmin') : r === 'MANAGER' ? t('team.roleManager') : t('team.roleViewer'));

  return (
    <div className="page-container space-y-4 md:space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('account.title')}</h1>
        <p className="text-app-secondary text-sm mt-1">{t('account.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-app-primary">{t('account.profile')}</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="w-28 shrink-0 text-sm text-app-secondary">{t('account.email')}</span>
            <span className="text-app-primary font-medium truncate">{user?.email}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-28 shrink-0 text-sm text-app-secondary">{t('account.role')}</span>
            <Badge variant={user?.role === 'ADMIN' ? 'success' : 'default'}>{roleLabel(user?.role)}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-app-primary">{t('account.security')}</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('account.currentPassword')}</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('account.newPassword')}</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('account.confirmPassword')}</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit" className="min-h-[48px]" disabled={change.isPending}>
              {change.isPending ? t('account.changing') : t('account.changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isAdmin && <OrgBrandingCard />}
    </div>
  );
}

function OrgBrandingCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const org = useOrg();

  const [form, setForm] = useState({ name: '', invoiceName: '', invoiceAddress: '', invoiceEmail: '', invoicePhone: '', invoiceRegNo: '' });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Seed the form once the org loads.
  useEffect(() => {
    if (!org) return;
    setForm({
      name: org.name ?? '',
      invoiceName: org.invoiceName ?? '',
      invoiceAddress: org.invoiceAddress ?? '',
      invoiceEmail: org.invoiceEmail ?? '',
      invoicePhone: org.invoicePhone ?? '',
      invoiceRegNo: org.invoiceRegNo ?? '',
    });
    setLogoUrl(org.logoUrl ?? null);
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LOGO_MAX_BYTES) {
      toast.show(t('account.logoTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  const save = useMutation({
    mutationFn: () => api.put('/organization', { ...form, logoUrl: logoUrl ?? '' }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['organization'] });
        toast.show(t('account.orgSaved'));
      } else if (res.error) toast.show(res.error);
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : t('account.saveOrg')),
  });

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-app-secondary mb-1.5">{label}</label>
      <Input type={type} value={form[key]} onChange={set(key)} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-app-primary">{t('account.organization')}</h2>
        <p className="text-app-muted text-xs mt-0.5">{t('account.brandingSubtitle')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl border border-[var(--border)] bg-app-surface-2 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={t('account.logo')} className="h-full w-full object-contain" />
              ) : (
                <span className="text-app-muted text-xs">{t('account.logo')}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center px-4 py-2.5 min-h-[44px] rounded-xl border border-[var(--border)] text-app-primary text-sm font-medium cursor-pointer hover:bg-slate-900/[0.04]">
                {t('account.chooseLogo')}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogoFile} className="hidden" />
              </label>
              {logoUrl && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setLogoUrl(null)}>{t('account.removeLogo')}</Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('name', t('account.orgName'))}
            {field('invoiceName', t('account.invoiceName'))}
            {field('invoiceEmail', t('account.contactEmail'), 'email')}
            {field('invoicePhone', t('account.contactPhone'))}
            {field('invoiceRegNo', t('account.regNo'))}
          </div>
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('account.address')}</label>
            <Textarea value={form.invoiceAddress} onChange={set('invoiceAddress')} />
          </div>

          <Button type="submit" className="min-h-[48px]" disabled={save.isPending}>
            {save.isPending ? t('account.savingOrg') : t('account.saveOrg')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
