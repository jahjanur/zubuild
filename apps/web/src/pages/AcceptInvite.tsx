import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button, Input, LanguageSwitcher } from '../components/ui';

interface Invite {
  email: string;
  role: string;
  organizationName: string;
}

export default function AcceptInvite() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<Invite>(`/auth/invitation/${token}`),
    retry: false,
    enabled: !!token,
  });
  const invite = data?.success ? data.data : undefined;
  const invalid = !isLoading && !invite;

  const accept = useMutation({
    mutationFn: () => api.post<{ id: string; email: string; role: string }>(`/auth/invitation/${token}/accept`, { password }),
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
    accept.mutate();
  }

  const roleLabel = invite?.role === 'ADMIN' ? t('team.roleAdmin') : invite?.role === 'MANAGER' ? t('team.roleManager') : invite?.role === 'INSPECTOR' ? t('team.roleInspector') : t('team.roleViewer');

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
            <h1 className="text-2xl font-semibold tracking-tight text-app-primary mb-1">{t('acceptInvite.invalidTitle')}</h1>
            <p className="text-app-secondary text-sm mb-6">{t('acceptInvite.invalidBody')}</p>
            <Link to="/login" className="text-app-accent font-medium hover:underline">{t('acceptInvite.backToLogin')}</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-app-primary mb-1">{invite!.organizationName}</h1>
            <p className="text-app-secondary text-sm mb-1">{t('acceptInvite.invitedAs', { org: invite!.organizationName, role: roleLabel })}</p>
            <p className="text-app-muted text-sm mb-6">{invite!.email}</p>
            {toast && (
              <div className="mb-4 p-3 rounded-xl bg-app-danger-muted border border-app-danger/30 text-app-danger text-sm" role="alert">
                {toast}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('register.password')}</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('register.confirmPassword')}</label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full min-h-[48px] rounded-full" disabled={accept.isPending}>
                {accept.isPending ? t('acceptInvite.joining') : t('acceptInvite.join')}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
