import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, setApiErrorHandler } from '../lib/api';
import { Button, Input } from '../components/ui';
import { AemLogo } from '../components/AemLogo';
import { ThemeToggle } from '../components/ThemeToggle';

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
      <div className="w-full max-w-md glass rounded-2xl shadow-modal p-6 md:p-8">
        <div className="flex justify-end mb-5">
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full glass text-app-secondary hover:text-app-primary transition" />
        </div>
        <AemLogo variant="full" className="h-12 text-app-primary mb-4" />
        <p className="text-app-secondary text-sm mb-6">{t('login.signInContinue')}</p>
        {toast && (
          <div className="mb-4 p-3 rounded-xl bg-app-danger-muted border border-app-danger/30 text-app-danger text-sm" role="alert">
            {toast}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('login.email')}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@zubuild.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('login.password')}</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full min-h-[48px] rounded-full" disabled={login.isPending}>
            {login.isPending ? t('login.signingIn') : t('login.signIn')}
          </Button>
          <div className="text-center">
            <Link to="/forgot-password" className="text-app-secondary text-sm hover:text-app-primary hover:underline">{t('login.forgotPassword')}</Link>
          </div>
        </form>
        <p className="text-app-secondary text-sm text-center mt-5">
          {t('register.newHere')}{' '}
          <Link to="/register" className="text-app-accent font-medium hover:underline">{t('register.createAccount')}</Link>
        </p>
      </div>
      <div className="mt-6 flex justify-center">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
