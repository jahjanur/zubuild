import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface Org {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  invoiceName?: string | null;
  invoiceAddress?: string | null;
  invoiceEmail?: string | null;
  invoicePhone?: string | null;
  invoiceRegNo?: string | null;
  currency: string;
  locale: string;
  plan: string;
}

/** Current organization (branding for the header + settings). */
export function useOrg() {
  const { data } = useQuery({ queryKey: ['organization'], queryFn: () => api.get<Org>('/organization'), retry: false });
  return data?.success ? data.data : undefined;
}
