import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Coins, Users, CreditCard, UserCircle, Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, Button, Input, Textarea, Select, Badge, LanguageSwitcher } from '../components/ui';
import { useAuth } from '../lib/useAuth';
import { useOrg } from '../lib/useOrg';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../lib/formatMKD';
import { TeamContent } from './Team';

const CURRENCIES = ['MKD', 'EUR', 'USD', 'GBP', 'ALL', 'RSD'];
const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'mk', label: 'Македонски' },
  { code: 'sq', label: 'Shqip' },
  { code: 'tr', label: 'Türkçe' },
];
const LOGO_MAX_BYTES = 400_000;
const AV_COLORS = ['#4F46E5', '#0891B2', '#059669', '#D97706', '#DB2777', '#7C3AED'];
function avatarColor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

interface SectionDef {
  key: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  render: () => ReactNode;
}

export default function Settings() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();

  const sections: SectionDef[] = [
    { key: 'profile', label: t('settings.profile'), icon: UserCircle, render: () => <SecuritySection /> },
    { key: 'organization', label: t('settings.organization'), icon: Building2, adminOnly: true, render: () => <OrganizationSection /> },
    { key: 'exchange-rate', label: t('settings.exchangeRate'), icon: Coins, adminOnly: true, render: () => <ExchangeRateSection /> },
    { key: 'members', label: t('settings.members'), icon: Users, adminOnly: true, render: () => <TeamContent /> },
    { key: 'billing', label: t('settings.billing'), icon: CreditCard, adminOnly: true, render: () => <BillingSection /> },
  ].filter((s) => isAdmin || !s.adminOnly);

  const requested = params.get('section');
  const active = sections.find((s) => s.key === requested) ?? sections[0];

  function goto(key: string) {
    setParams(key === sections[0].key ? {} : { section: key }, { replace: true });
  }

  return (
    <div className="page-container space-y-5 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('settings.title')}</h1>
        <p className="text-app-secondary text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        {/* Section rail */}
        <nav aria-label={t('settings.title')} className="flex gap-1 overflow-x-auto scroll-thin lg:flex-col lg:overflow-visible">
          {sections.map((s) => {
            const isActive = s.key === active.key;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => goto(s.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-app-accent-muted text-app-accent' : 'text-app-secondary hover:bg-app-surface-subtle hover:text-app-primary'
                }`}
              >
                <Icon size={17} className="shrink-0" />
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active section */}
        <div className="min-w-0 max-w-2xl space-y-4 md:space-y-6">{active.render()}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Organization ───────────────────────────── */

function OrganizationSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const org = useOrg();

  const [form, setForm] = useState({ name: '', invoiceName: '', invoiceAddress: '', invoiceEmail: '', invoicePhone: '', invoiceRegNo: '', currency: 'MKD', locale: 'mk' });
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
      currency: org.currency ?? 'MKD',
      locale: org.locale ?? 'mk',
    });
    setLogoUrl(org.logoUrl ?? null);
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
        <h2 className="text-sm font-semibold text-app-primary">{t('settings.organization')}</h2>
        <p className="text-app-muted text-xs mt-0.5">{t('account.brandingSubtitle')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl border border-[var(--border)] bg-app-surface-2 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? <img src={logoUrl} alt={t('account.logo')} className="h-full w-full object-contain" /> : <span className="text-app-muted text-xs">{t('account.logo')}</span>}
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center px-4 py-2.5 min-h-[44px] rounded-xl border border-[var(--border)] text-app-primary text-sm font-medium cursor-pointer hover:bg-[var(--hover)]">
                {t('account.chooseLogo')}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogoFile} className="hidden" />
              </label>
              {logoUrl && <Button type="button" variant="secondary" size="sm" onClick={() => setLogoUrl(null)}>{t('account.removeLogo')}</Button>}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--border)] pt-4">
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('settings.currency')}</label>
              <Select value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('settings.locale')}</label>
              <Select value={form.locale} onChange={set('locale')}>
                {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </Select>
            </div>
          </div>

          <Button type="submit" className="min-h-[48px]" disabled={save.isPending}>
            {save.isPending ? t('account.savingOrg') : t('account.saveOrg')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────── Exchange rate ───────────────────────────── */

function ExchangeRateSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const org = useOrg();
  const [rate, setRate] = useState('');

  useEffect(() => {
    if (org) setRate(org.mkdToEurRate != null ? String(org.mkdToEurRate) : '');
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => {
      const n = parseFloat(rate);
      if (!Number.isFinite(n) || n <= 0) throw new Error(t('account.mkdEurRate'));
      return api.put('/organization', { mkdToEurRate: n });
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['organization'] });
        toast.show(t('account.orgSaved'));
      } else if (res.error) toast.show(res.error);
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : t('account.saveOrg')),
  });

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-app-primary">{t('settings.exchangeRate')}</h2>
        <p className="text-app-muted text-xs mt-0.5">{t('account.mkdEurRateHint')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('account.mkdEurRate')}</label>
            <div className="max-w-[220px]">
              <Input type="number" step="0.01" min="0" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="61.5" />
            </div>
          </div>
          <Button type="submit" className="min-h-[48px]" disabled={save.isPending}>
            {save.isPending ? t('account.savingOrg') : t('account.saveOrg')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────── Billing ───────────────────────────── */

function BillingSection() {
  const { t } = useTranslation();
  const org = useOrg();
  const plan = org?.plan ?? 'FREE';
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-app-primary">{t('settings.billing')}</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-app-surface-2 px-4 py-3">
          <div>
            <p className="text-xs text-app-muted">{t('settings.currentPlan')}</p>
            <p className="text-base font-semibold text-app-primary">{plan}</p>
          </div>
          <Badge variant="accent">{t('settings.active')}</Badge>
        </div>
        <p className="text-sm text-app-muted">{t('settings.billingSoon')}</p>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────── Security ───────────────────────────── */

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-app-secondary mb-1.5">{label}</label>
      <div className="relative">
        <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} required minLength={8} autoComplete={autoComplete} className="pr-11" />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-app-muted hover:text-app-primary" aria-label={show ? t('profile.hidePassword') : t('profile.showPassword')}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

function SecuritySection() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const email = user?.email ?? '';
  const roleLabel = (r?: string) => (r === 'ADMIN' ? t('team.roleAdmin') : r === 'MANAGER' ? t('team.roleManager') : r === 'INSPECTOR' ? t('team.roleInspector') : t('team.roleViewer'));
  const initials = (email || '?').replace(/[^A-Za-zА-Яа-я0-9]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

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
    <>
      {/* Account identity */}
      <Card>
        <CardContent className="flex items-center gap-4 py-5">
          <span className="h-14 w-14 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0" style={{ backgroundColor: avatarColor(email || 'user') }} aria-hidden>
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-app-primary font-semibold truncate">{email}</p>
              <Badge variant="accent">{roleLabel(user?.role)}</Badge>
            </div>
            {user?.createdAt && <p className="text-app-muted text-xs mt-0.5">{t('profile.memberSince')} {formatDate(user.createdAt)}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-app-primary">{t('account.security')}</h2></CardHeader>
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

      {/* Sessions */}
      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-app-primary">{t('settings.sessions')}</h2></CardHeader>
        <CardContent><p className="text-sm text-app-muted">{t('settings.sessionsNote')}</p></CardContent>
      </Card>

      {/* Interface language (personal) */}
      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-app-primary">{t('profile.preferences')}</h2></CardHeader>
        <CardContent>
          <label className="block text-sm font-medium text-app-secondary mb-2">{t('profile.defaultLanguage')}</label>
          <LanguageSwitcher />
        </CardContent>
      </Card>
    </>
  );
}
