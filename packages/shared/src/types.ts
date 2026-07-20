/**
 * Shared domain types for AEM Residence Operations
 */

export type UserRole = 'ADMIN' | 'MANAGER' | 'INSPECTOR' | 'VIEWER';

export type SupplierStatus = 'ACTIVE' | 'INACTIVE';
export type ProductStatus = 'ACTIVE' | 'INACTIVE';
export type OrderStatus = 'PENDING' | 'DELIVERED' | 'RECONCILED';
export type ReconciliationItemStatus = 'COMPLETE' | 'MISSING' | 'EXCESS';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}
