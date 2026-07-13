import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button, Input, LanguageSwitcher } from '../components/ui';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const forgot = useMutation({
    mutationFn: () => api.post<{ resetUrl?: string }>('/auth/forgot-password', { email }),
    onSuccess: (res) => {
      setSent(true);
      if (res.data?.resetUrl) setDevLink(res.data.resetUrl);
    },
  });

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-6 safe-area-pt bg-app-bg"
      style={{ background: 'var(--app-bg-gradient, var(--app-bg))' }}
    >
      <div className="w-full max-w-md glass rounded-2xl shadow-modal p-6 md:p-8">
        <div className="flex justify-end mb-5">
          <LanguageSwitcher />
        </div>
        {sent ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-app-primary mb-1">{t('forgotPassword.sentTitle')}</h1>
            <p className="text-app-secondary text-sm mb-6">{t('forgotPassword.sentBody')}</p>
            {devLink && (
              <div className="mb-6 p-3 rounded-xl bg-app-surface-2 border border-[var(--border)] text-xs break-all">
                <span className="text-app-muted">{t('forgotPassword.devLink')} </span>
                <a href={devLink} className="text-app-accent hover:underline">{devLink}</a>
              </div>
            )}
            <Link to="/login" className="text-app-accent font-medium hover:underline">{t('forgotPassword.backToLogin')}</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-app-primary mb-1">{t('forgotPassword.title')}</h1>
            <p className="text-app-secondary text-sm mb-6">{t('forgotPassword.subtitle')}</p>
            <form
              onSubmit={(e) => { e.preventDefault(); forgot.mutate(); }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('forgotPassword.email')}</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
              </div>
              <Button type="submit" className="w-full min-h-[48px] rounded-full" disabled={forgot.isPending}>
                {forgot.isPending ? t('forgotPassword.sending') : t('forgotPassword.sendLink')}
              </Button>
            </form>
            <p className="text-app-secondary text-sm text-center mt-5">
              <Link to="/login" className="text-app-accent font-medium hover:underline">{t('forgotPassword.backToLogin')}</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
