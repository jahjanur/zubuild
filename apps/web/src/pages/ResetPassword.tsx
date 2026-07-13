import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button, Input, LanguageSwitcher } from '../components/ui';

export default function ResetPassword() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reset', token],
    queryFn: () => api.get<{ email: string }>(`/auth/reset-password/${token}`),
    retry: false,
    enabled: !!token,
  });
  const valid = data?.success;
  const invalid = !isLoading && !valid;

  const reset = useMutation({
    mutationFn: () => api.post<{ id: string; email: string; role: string }>(`/auth/reset-password/${token}`, { password }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.setQueryData(['auth', 'me'], { data: res.data });
        navigate('/app', { replace: true });
      } else if (res.error) setToast(res.error);
    },
    onError: (err) => setToast(err instanceof Error ? err.message : t('resetPassword.invalidBody')),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);
    if (password !== confirm) {
      setToast(t('account.mismatch'));
      return;
    }
    reset.mutate();
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
        {isLoading ? (
          <p className="text-app-secondary text-sm py-8 text-center">{t('common.loading')}</p>
        ) : invalid ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-app-primary mb-1">{t('resetPassword.invalidTitle')}</h1>
            <p className="text-app-secondary text-sm mb-6">{t('resetPassword.invalidBody')}</p>
            <Link to="/forgot-password" className="text-app-accent font-medium hover:underline">{t('resetPassword.backToLogin')}</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-app-primary mb-1">{t('resetPassword.title')}</h1>
            <p className="text-app-secondary text-sm mb-6">{t('resetPassword.subtitle')}</p>
            {toast && (
              <div className="mb-4 p-3 rounded-xl bg-app-danger-muted border border-app-danger/30 text-app-danger text-sm" role="alert">
                {toast}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('resetPassword.newPassword')}</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('resetPassword.confirmPassword')}</label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full min-h-[48px] rounded-full" disabled={reset.isPending}>
                {reset.isPending ? t('resetPassword.resetting') : t('resetPassword.reset')}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
