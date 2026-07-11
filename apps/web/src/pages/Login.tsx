import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, setApiErrorHandler } from '../lib/api';
import { Card, CardContent, Button, Input, LanguageSwitcher } from '../components/ui';

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
    <div className="min-h-screen flex items-center justify-center bg-app-bg px-4 py-6 safe-area-pt">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 md:p-8">
          <LanguageSwitcher className="justify-end mb-4" />
          <h1 className="text-xl md:text-2xl font-semibold text-app-gold mb-2">{t('login.title')}</h1>
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
                placeholder="admin@aem-residence.com"
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
            <Button type="submit" className="w-full min-h-[48px]" disabled={login.isPending}>
              {login.isPending ? t('login.signingIn') : t('login.signIn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
