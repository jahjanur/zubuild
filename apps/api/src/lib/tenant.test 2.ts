/**
 * Tenant-isolation integration test. Provisions a throwaway SQLite database,
 * applies the real tenant middleware, and proves that one org can never read or
 * write another org's rows. Locks in the P0 multi-tenancy guarantee so a future
 * change to the query layer can't silently reopen a cross-tenant leak.
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { applyTenantMiddleware } from './prisma';
import { runWithOrg } from './tenantContext';

const apiRoot = path.resolve(__dirname, '../..');
const dbFile = path.join(os.tmpdir(), `zubuild-tenant-test-${process.pid}.db`);
const dbUrl = `file:${dbFile}`;

let prisma: PrismaClient;
const ORG_A = 'aaaaaaaa-0000-0000-0000-00000000000a';
const ORG_B = 'bbbbbbbb-0000-0000-0000-00000000000b';
const seeded: Record<string, { supplierId: string; productId: string; orderId: string }> = {};

// Mirror how real (async) route handlers run inside the org store: the await
// boundary is what carries the AsyncLocalStorage context into the Prisma middleware.
const inOrg = <T>(org: string, fn: () => Promise<T>): Promise<T> => runWithOrg(org, async () => await fn());

async function seedOrg(org: string) {
  const supplier = await inOrg(org, () => prisma.supplier.create({ data: { companyName: `Supplier ${org}` } }));
  const product = await inOrg(org, () => prisma.product.create({ data: { name: `Product ${org}`, category: 'Test', measurementUnit: 'adet', price: 10 } }));
  const order = await inOrg(org, () =>
    prisma.order.create({
      data: {
        orderNumber: `ORD-${org.slice(0, 8)}`,
        orderDate: new Date('2026-07-13T12:00:00Z'),
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        totalAmount: 20,
        orderItems: { create: [{ name: 'Item', unit: 'adet', price: 10, quantity: 2, organizationId: org }] },
      },
    })
  );
  seeded[org] = { supplierId: supplier.id, productId: product.id, orderId: order.id };
}

beforeAll(async () => {
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  execSync('npx prisma migrate deploy', { cwd: apiRoot, env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'ignore' });
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  applyTenantMiddleware(prisma);
  await prisma.organization.create({ data: { id: ORG_A, name: 'Org A', slug: 'org-a' } });
  await prisma.organization.create({ data: { id: ORG_B, name: 'Org B', slug: 'org-b' } });
  await seedOrg(ORG_A);
  await seedOrg(ORG_B);
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
});

describe('tenant isolation', () => {
  it('creates are stamped with the caller org', async () => {
    const s = await inOrg(ORG_A, () => prisma.supplier.findUniqueOrThrow({ where: { id: seeded[ORG_A].supplierId } }));
    expect(s.organizationId).toBe(ORG_A);
    // nested order items get the org too
    const items = await inOrg(ORG_A, () => prisma.orderItem.findMany({ where: { orderId: seeded[ORG_A].orderId } }));
    expect(items.every((i) => i.organizationId === ORG_A)).toBe(true);
  });

  const MODELS: { model: 'supplier' | 'product' | 'order'; patch: Record<string, unknown> }[] = [
    { model: 'supplier', patch: { companyName: 'HACKED' } },
    { model: 'product', patch: { name: 'HACKED' } },
    { model: 'order', patch: { notes: 'HACKED' } },
  ];
  for (const { model, patch } of MODELS) {
    describe(model, () => {
      const otherId = () => seeded[ORG_B][`${model}Id` as keyof (typeof seeded)[string]];
      const client = () => (prisma as unknown as Record<string, any>)[model];

      it(`A's list excludes B's ${model}`, async () => {
        const list = (await inOrg(ORG_A, () => client().findMany())) as { id: string }[];
        expect(list.length).toBe(1);
        expect(list.some((r) => r.id === otherId())).toBe(false);
      });

      it(`A cannot read B's ${model} by id (findUnique -> null)`, async () => {
        const row = await inOrg(ORG_A, () => client().findUnique({ where: { id: otherId() } }));
        expect(row).toBeNull();
      });

      it(`A cannot update B's ${model}`, async () => {
        await expect(
          inOrg(ORG_A, () => client().update({ where: { id: otherId() }, data: patch }))
        ).rejects.toMatchObject({ code: 'P2025' });
      });

      it(`A cannot delete B's ${model}`, async () => {
        await expect(
          inOrg(ORG_A, () => client().delete({ where: { id: otherId() } }))
        ).rejects.toMatchObject({ code: 'P2025' });
      });

      it(`B's ${model} still exists after A's attempts`, async () => {
        const row = await inOrg(ORG_B, () => client().findUnique({ where: { id: otherId() } }));
        expect(row).not.toBeNull();
      });
    });
  }

  it('counts and aggregates are scoped', async () => {
    expect(await inOrg(ORG_A, () => prisma.supplier.count())).toBe(1);
    expect(await inOrg(ORG_B, () => prisma.supplier.count())).toBe(1);
    const agg = await inOrg(ORG_A, () => prisma.order.aggregate({ _sum: { totalAmount: true } }));
    expect(agg._sum.totalAmount).toBe(20); // only A's single order, not both
  });
});
