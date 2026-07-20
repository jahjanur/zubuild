import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { setOrgCurrency } from './formatMKD';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  organizationId?: string | null;
  currency?: string;
  locale?: string;
  createdAt?: string | null;
}

export function useAuth() {
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    // A 401 means "not logged in", not an error — never toast it.
    queryFn: () => api.get<AuthUser>('/auth/me', { silent: true }),
    retry: false,
  });
  const user = data?.data;

  // Money renders in the org's currency (locale still follows the UI language).
  useEffect(() => {
    if (user?.currency) setOrgCurrency(user.currency);
  }, [user?.currency]);

  const role = user?.role;
  // UI gating mirrors the server matrix (server is the source of truth):
  //   canWrite      = MANAGER or ADMIN (operational writes); isAdmin = ADMIN (org admin).
  //   canReconcile  = INSPECTOR, MANAGER or ADMIN (delivery checks: reconcile an
  //                   order and mark it delivered). INSPECTOR gets only this.
  const canWrite = role === 'ADMIN' || role === 'MANAGER';
  return {
    user,
    isAdmin: role === 'ADMIN',
    canWrite,
    canReconcile: canWrite || role === 'INSPECTOR',
  };
}
