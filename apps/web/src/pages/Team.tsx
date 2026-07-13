import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../lib/formatMKD';
import { Card, CardContent, CardHeader, Button, Input, Select, Badge } from '../components/ui';

interface Member { id: string; email: string; role: string; createdAt: string; }
interface Invite { id: string; email: string; role: string; token: string; expiresAt: string; }

function inviteLink(token: string): string {
  return `${window.location.origin}/accept-invite/${token}`;
}

export default function Team() {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const membersQ = useQuery({ queryKey: ['team', 'members'], queryFn: () => api.get<Member[]>('/team/members'), enabled: isAdmin });
  const invitesQ = useQuery({ queryKey: ['team', 'invitations'], queryFn: () => api.get<Invite[]>('/team/invitations'), enabled: isAdmin });

  const createInvite = useMutation({
    mutationFn: () => api.post<Invite>('/team/invitations', { email: email.trim(), role }),
    onSuccess: (res) => {
      if (res.success) {
        setEmail('');
        queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
        toast.show(t('team.inviteReady'));
      } else if (res.error) toast.show(res.error);
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : 'Error'),
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) => api.delete(`/team/invitations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] }),
  });

  async function copy(inv: Invite) {
    try {
      await navigator.clipboard.writeText(inviteLink(inv.token));
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId((c) => (c === inv.id ? null : c)), 1500);
    } catch {
      toast.show(inviteLink(inv.token));
    }
  }

  const roleLabel = (r: string) => (r === 'ADMIN' ? t('team.roleAdmin') : t('team.roleViewer'));

  if (!isAdmin) {
    return (
      <div className="page-container space-y-4 md:space-y-6">
        <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('team.title')}</h1>
        <Card><CardContent className="p-6"><p className="text-app-secondary">{t('team.adminOnly')}</p></CardContent></Card>
      </div>
    );
  }

  const members = membersQ.data?.data ?? [];
  const invites = invitesQ.data?.data ?? [];

  return (
    <div className="page-container space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold text-app-primary">{t('team.title')}</h1>

      {/* Invite form */}
      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-app-primary">{t('team.inviteTeammate')}</h2></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); if (email.trim()) createInvite.mutate(); }}
            className="flex flex-col sm:flex-row gap-3 sm:items-end"
          >
            <div className="flex-1">
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('register.email')}</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required />
            </div>
            <div className="sm:w-40">
              <label className="block text-sm font-medium text-app-secondary mb-1.5">{t('team.role')}</label>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="VIEWER">{t('team.roleViewer')}</option>
                <option value="ADMIN">{t('team.roleAdmin')}</option>
              </Select>
            </div>
            <Button type="submit" className="min-h-[48px] sm:w-auto" disabled={createInvite.isPending}>
              {createInvite.isPending ? t('team.inviting') : t('team.createInvite')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending invites */}
      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-app-primary">{t('team.pendingInvites')}</h2></CardHeader>
        <CardContent className="space-y-3">
          {invites.length === 0 ? (
            <p className="text-app-muted text-sm">{t('team.noInvites')}</p>
          ) : (
            invites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-app-surface-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-app-primary truncate">{inv.email}</p>
                  <p className="text-app-muted text-xs">
                    <Badge variant="outline" className="mr-2">{roleLabel(inv.role)}</Badge>
                    {t('team.expires', { date: formatDate(inv.expiresAt) })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => copy(inv)}>
                    {copiedId === inv.id ? t('team.copied') : t('team.copyLink')}
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => revokeInvite.mutate(inv.id)} disabled={revokeInvite.isPending}>
                    {t('team.revoke')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-app-primary">{t('team.members')}</h2></CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
              <span className="text-app-primary truncate">
                {m.email}
                {m.id === user?.id && <span className="text-app-muted text-xs ml-2">({t('team.you')})</span>}
              </span>
              <Badge variant={m.role === 'ADMIN' ? 'success' : 'default'}>{roleLabel(m.role)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
