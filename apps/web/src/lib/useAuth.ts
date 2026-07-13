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
}

export function useAuth() {
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthUser>('/auth/me'),
    retry: false,
  });
  const user = data?.data;

  // Money renders in the org's currency (locale still follows the UI language).
  useEffect(() => {
    if (user?.currency) setOrgCurrency(user.currency);
  }, [user?.currency]);

  const role = user?.role;
  // UI gating mirrors the server matrix (server is the source of truth):
  //   canWrite = MANAGER or ADMIN (operational writes); isAdmin = ADMIN (org admin).
  return {
    user,
    isAdmin: role === 'ADMIN',
    canWrite: role === 'ADMIN' || role === 'MANAGER',
  };
}
