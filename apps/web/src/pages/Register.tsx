import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, setApiErrorHandler } from '../lib/api';
import { Button, Input, Select, LanguageSwitcher } from '../components/ui';

const CURRENCIES = ['MKD', 'EUR', 'USD', 'GBP', 'ALL', 'RSD'];

export default function Register() {
  const { t, i18n } = useTranslation();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currency, setCurrency] = useState('MKD');
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  setApiErrorHandler((msg) => setToast(msg));

  const register = useMutation({
    mutationFn: () =>
      api.post<{ id: string; email: string; role: string }>('/auth/register', {
        companyName,
        email,
        password,
        currency,
        locale: (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0],
      }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.setQueryData(['auth', 'me'], { data: res.data });
        navigate('/app', { replace: true });
      } else if (res.error) setToast(res.error);
    },
    onError: (err) => setToast(err instanceof Error ? err.message : t('register.registerFailed')),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);
    if (password !== confirm) {
      setToast(t('register.passwordMismatch'));
      return;
    }
    register.mutate();
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-6 safe-area-pt bg-app-bg"
      style={{ background: 'var(--app-bg-gradient, var(--app-bg))' }}
    >
      <div className="w-full max-w-md glass rounded-2xl shadow-modal p-6 md:p-8">
        <div className="flex justify-end mb-5">
          <LanguageSwitcher />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-app-primary mb-1">{t('register.title')}</h1>
        <p className="text-app-secondary text-sm mb-6">{t('register.subtitle')}</p>
        {toast && (
          <div className="mb-4 p-3 rounded-xl bg-app-danger-muted border border-app-danger/30 text-app-danger text-sm" role="alert">
            {toast}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('register.companyName')}</label>
            <Input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required minLength={2} autoComplete="organization" />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('register.email')}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('register.password')}</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('register.confirmPassword')}</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('register.currency')}</label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full min-h-[48px] rounded-full" disabled={register.isPending}>
            {register.isPending ? t('register.creating') : t('register.createAccount')}
          </Button>
        </form>
        <p className="text-app-secondary text-sm text-center mt-5">
          {t('register.haveAccount')}{' '}
          <Link to="/login" className="text-app-accent font-medium hover:underline">{t('login.signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
