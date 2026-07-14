import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, Button, Input, Textarea, Badge, LanguageSwitcher } from '../components/ui';
import { useAuth } from '../lib/useAuth';
import { useOrg } from '../lib/useOrg';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../lib/formatMKD';

const AV_COLORS = ['#4F46E5', '#0891B2', '#059669', '#D97706', '#DB2777', '#7C3AED'];
function avatarColor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  const email = user?.email ?? '';
  const emailLocal = email.split('@')[0] ?? '';
  const derivedName = emailLocal ? emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1) : '';
  const roleLabel = (r?: string) => (r === 'ADMIN' ? t('team.roleAdmin') : r === 'MANAGER' ? t('team.roleManager') : t('team.roleViewer'));

  // --- Personal information (Edit/Save) ---
  // No name/phone columns exist yet, so these are wired to the user object with a
  // stubbed save. Replace the TODO once a profile-update endpoint lands.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  useEffect(() => {
    setForm({ fullName: derivedName, email, phone: '' });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = form.fullName || derivedName || email;
  const initials = (displayName || '?').replace(/[^A-Za-zА-Яа-я0-9]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  const color = avatarColor(email || 'user');

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    // TODO: POST/PUT the profile once a backend endpoint exists (no name/phone
    // columns today). For now this only updates local state.
    setEditing(false);
    toast.show(t('profile.saved'));
  }
  function cancelEdit() {
    setForm({ fullName: derivedName, email, phone: '' });
    setEditing(false);
  }

  return (
    <div className="page-container space-y-4 md:space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('profile.title')}</h1>
        <p className="text-app-secondary text-sm mt-1">{t('profile.subtitle')}</p>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
          <span
            className="h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-semibold shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-app-primary truncate">{displayName}</h2>
              <Badge variant="accent">{roleLabel(user?.role)}</Badge>
            </div>
            <p className="text-app-secondary text-sm truncate">{email}</p>
            {user?.createdAt && (
              <p className="text-app-muted text-xs mt-1">{t('profile.memberSince')} {formatDate(user.createdAt)}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal information */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-app-primary">{t('profile.personalInfo')}</h2>
          {!editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>{t('profile.edit')}</Button>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('profile.fullName')}</label>
              <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} disabled={!editing} placeholder={t('profile.notSet')} className="disabled:opacity-60 disabled:cursor-default" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('account.email')}</label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!editing} autoComplete="email" className="disabled:opacity-60 disabled:cursor-default" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('profile.phone')}</label>
              <Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} disabled={!editing} placeholder={t('profile.notSet')} autoComplete="tel" className="disabled:opacity-60 disabled:cursor-default" />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <Button type="submit">{t('profile.save')}</Button>
                <Button type="button" variant="ghost" onClick={cancelEdit}>{t('profile.cancel')}</Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <SecurityCard />

      {/* Preferences */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-app-primary">{t('profile.preferences')}</h2>
        </CardHeader>
        <CardContent>
          <label className="block text-sm font-medium text-app-secondary mb-2">{t('profile.defaultLanguage')}</label>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      {isAdmin && <OrgBrandingCard />}
    </div>
  );
}

/** Password field with a show/hide toggle. */
function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-app-secondary mb-1.5">{label}</label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={8}
          autoComplete={autoComplete}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-app-muted hover:text-app-primary"
          aria-label={show ? t('profile.hidePassword') : t('profile.showPassword')}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

function SecurityCard() {
  const { t } = useTranslation();
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

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-app-primary">{t('account.security')}</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField label={t('account.currentPassword')} value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label={t('account.newPassword')} value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField label={t('account.confirmPassword')} value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <Button type="submit" className="min-h-[48px]" disabled={change.isPending}>
            {change.isPending ? t('account.changing') : t('account.changePassword')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const LOGO_MAX_BYTES = 400_000;

/** Organization branding — admin only (logo + invoice details for the app header and PDFs). */
function OrgBrandingCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const org = useOrg();

  const [form, setForm] = useState({ name: '', invoiceName: '', invoiceAddress: '', invoiceEmail: '', invoicePhone: '', invoiceRegNo: '' });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
