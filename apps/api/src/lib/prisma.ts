import { PrismaClient, Prisma } from '@prisma/client';
import { currentOrgId } from './tenantContext';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Models that carry an organizationId and must be tenant-scoped on every query.
// (ReconciliationItem is reached only via its scoped Reconciliation parent.)
const TENANT_MODELS = new Set<string>([
  'User',
  'Supplier',
  'Product',
  'Order',
  'OrderItem',
  'Reconciliation',
  'InventoryMovement',
]);

/**
 * Register the tenant-isolation middleware on a client. When a request has an org
 * context, every query on a tenant model is forced to that org — reads/updates/
 * deletes get organizationId added to their `where`, creates get it added to their
 * `data`. findUnique is rewritten to findFirst so the org filter actually applies
 * (a bare unique lookup would otherwise ignore it). With no org context (e.g.
 * pre-login), tenant models are left alone so login can look up the user.
 *
 * Exported so tests can apply the exact same enforcement to an isolated client.
 */
export function applyTenantMiddleware(client: PrismaClient): void {
  client.$use(async (params, next) => {
    const orgId = currentOrgId();
    if (!orgId || !params.model || !TENANT_MODELS.has(params.model)) {
      return next(params);
    }

    const args = (params.args ?? {}) as Record<string, unknown>;
    const withOrg = (where: unknown) => ({ ...(where as object), organizationId: orgId });

    switch (params.action) {
      case 'findUnique':
      case 'findUniqueOrThrow':
        // A unique lookup ignores extra filters, so promote to findFirst.
        params.action = params.action === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
        args.where = withOrg(args.where);
        break;
      case 'findFirst':
      case 'findFirstOrThrow':
      case 'findMany':
      case 'count':
      case 'aggregate':
      case 'groupBy':
      case 'update':
      case 'updateMany':
      case 'delete':
      case 'deleteMany':
        args.where = withOrg(args.where);
        break;
      case 'upsert':
        args.where = withOrg(args.where);
        args.create = { ...(args.create as object), organizationId: orgId };
        break;
      case 'create':
        args.data = { ...(args.data as object), organizationId: orgId };
        break;
      case 'createMany': {
        const data = args.data;
        args.data = Array.isArray(data)
          ? data.map((row) => ({ ...(row as object), organizationId: orgId }))
          : { ...(data as object), organizationId: orgId };
        break;
      }
      default:
        break;
    }

    params.args = args as Prisma.MiddlewareParams['args'];
    return next(params);
  });
}

applyTenantMiddleware(prisma);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
