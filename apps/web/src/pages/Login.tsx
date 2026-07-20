import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, setApiErrorHandler } from '../lib/api';
import { Button, Input } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { PoweredBy } from '../components/PoweredBy';
import { AemLogo } from '../components/AemLogo';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'mk', label: 'Македонски' },
  { code: 'sq', label: 'Shqip' },
  { code: 'tr', label: 'Türkçe' },
] as const;

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      {languages.map(({ code, label }) => {
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => i18n.changeLanguage(code)}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
              active
                ? 'bg-[var(--hover)] text-app-primary'
                : 'text-app-secondary/70 hover:text-app-primary'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  setApiErrorHandler((msg) => setToast(msg));

  const login = useMutation({
    mutationFn: () => api.post<{ id: string; email: string; role: string }>('/auth/login', { email, password }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.setQueryData(['auth', 'me'], { data: res.data });
        navigate('/app', { replace: true });
      } else if (res.error) setToast(res.error);
    },
    onError: (err) => setToast(err instanceof Error ? err.message : t('login.loginFailed')),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);
    login.mutate();
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-6 safe-area-pt bg-app-bg"
      style={{ background: 'var(--app-bg-gradient, var(--app-bg))' }}
    >
      <div className="relative w-full max-w-md glass rounded-2xl shadow-modal p-7 md:p-8">
        <ThemeToggle className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full glass text-app-secondary hover:text-app-primary transition" />

        <div className="mb-7 flex flex-col items-center text-center">
          <AemLogo variant="full" className="mb-4 h-12 text-app-primary" />
          <p className="text-sm text-app-secondary">{t('login.signInContinue')}</p>
        </div>

        {toast && (
          <div className="mb-5 rounded-xl border border-app-danger/30 bg-app-danger-muted p-3 text-sm text-app-danger" role="alert">
            {toast}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-app-secondary">{t('login.email')}</label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@zubuild.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="login-password" className="block text-sm font-medium text-app-secondary">{t('login.password')}</label>
              {/* Only surface the recovery link once a sign-in attempt has failed. */}
              {toast && (
                <Link to="/forgot-password" className="text-xs font-medium text-app-accent hover:underline">{t('login.forgotPassword')}</Link>
              )}
            </div>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="mt-1 w-full min-h-[48px] rounded-full text-base" disabled={login.isPending}>
            {login.isPending ? t('login.signingIn') : t('login.signIn')}
          </Button>
        </form>
      </div>
      <div className="mt-6 flex justify-center">
        <LanguageSwitcher />
      </div>
      <PoweredBy className="mt-6" />
    </div>
  );
}
