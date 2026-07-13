import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped tenant context. The Express `tenantContext` middleware runs the
 * rest of each authenticated request inside a store carrying the caller's
 * organizationId; the Prisma middleware (lib/prisma.ts) reads it to scope every
 * query. Using AsyncLocalStorage means no orgId has to be threaded through call
 * sites — a query cannot forget to scope itself.
 */
const store = new AsyncLocalStorage<{ organizationId: string }>();

export function runWithOrg<T>(organizationId: string, fn: () => T): T {
  return store.run({ organizationId }, fn);
}

/** Current caller's organizationId, or undefined outside an authenticated request. */
export function currentOrgId(): string | undefined {
  return store.getStore()?.organizationId;
}
