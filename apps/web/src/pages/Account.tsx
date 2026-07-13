import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, Button, Input, Badge } from '../components/ui';
import { useAuth } from '../lib/useAuth';
import { useToast } from '../context/ToastContext';

export default function Account() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-app-secondary">{t('account.email')}</span>
            <span className="text-app-primary font-medium truncate">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-app-secondary">{t('account.role')}</span>
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
    </div>
  );
}
