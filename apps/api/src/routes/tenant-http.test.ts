/**
 * Cross-tenant isolation — HTTP integration test (P0 security).
 *
 * Boots the real Express app against a throwaway SQLite DB, logs in two users in
 * two different orgs, and proves org A can never read or write org B's data
 * through the actual routes: suppliers, products, orders, PDFs, analytics.
 * Any leak here is a Sev-1. Runs in CI (self-contained; no external services).
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

const apiRoot = path.resolve(__dirname, '../..');
const dbFile = path.join(os.tmpdir(), `zubuild-http-tenant-${process.pid}.db`);
const dbUrl = `file:${dbFile}`;

let app: Express;
let prisma: PrismaClient;
let agentA: ReturnType<typeof request.agent>;
let agentB: ReturnType<typeof request.agent>;

type Seed = { orgId: string; supplierId: string; productId: string; orderId: string };
const seeded: Record<'A' | 'B', Seed> = {} as never;

const PASSWORD = 'secret123';

async function seedOrg(tag: 'A' | 'B'): Promise<Seed> {
  const orgId = `${tag.toLowerCase().repeat(8)}-0000-0000-0000-00000000000${tag === 'A' ? 'a' : 'b'}`;
  await prisma.organization.create({ data: { id: orgId, name: `Org ${tag}`, slug: `org-${tag.toLowerCase()}` } });
  await prisma.user.create({
    data: { email: `admin-${tag.toLowerCase()}@test.com`, passwordHash: await bcrypt.hash(PASSWORD, 12), role: 'ADMIN', organizationId: orgId },
  });
  const supplier = await prisma.supplier.create({ data: { companyName: `SUP-${tag}`, status: 'ACTIVE', organizationId: orgId } });
  const product = await prisma.product.create({ data: { name: `PROD-${tag}`, category: 'Test', measurementUnit: 'adet', price: 10, status: 'ACTIVE', organizationId: orgId } });
  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-${tag}`, orderDate: new Date('2026-07-13T12:00:00Z'), supplierId: supplier.id, supplierName: supplier.companyName,
      totalAmount: 20, status: 'RECONCILED', organizationId: orgId,
      orderItems: { create: [{ name: `ITEM-${tag}`, unit: 'adet', price: 10, quantity: 2, organizationId: orgId }] },
    },
    include: { orderItems: true },
  });
  // Reconciliation with a loss on ITEM-<tag> — feeds analytics/top-items.
  await prisma.reconciliation.create({
    data: {
      orderId: order.id, totalLossValue: 10, organizationId: orgId,
      items: { create: [{ orderItemId: order.orderItems[0].id, name: `ITEM-${tag}`, unit: 'adet', price: 10, orderedQty: 2, receivedQty: 1, missingQty: 1, lossValue: 10, status: 'MISSING' }] },
    },
  });
  return { orgId, supplierId: supplier.id, productId: product.id, orderId: order.id };
}

beforeAll(async () => {
  process.env.DATABASE_URL = dbUrl;
  process.env.SESSION_SECRET = 'test-secret-abcdefghijklmnop';
  process.env.NODE_ENV = 'test';
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  execSync('npx prisma migrate deploy', { cwd: apiRoot, env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'ignore' });

  // Import AFTER env is set so the singleton client + config bind to the test DB.
  prisma = (await import('../lib/prisma')).prisma;
  app = (await import('../index')).app;

  seeded.A = await seedOrg('A');
  seeded.B = await seedOrg('B');

  agentA = request.agent(app);
  agentB = request.agent(app);
  await agentA.post('/auth/login').send({ email: 'admin-a@test.com', password: PASSWORD }).expect(200);
  await agentB.post('/auth/login').send({ email: 'admin-b@test.com', password: PASSWORD }).expect(200);
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
});

describe('cross-tenant HTTP isolation', () => {
  it('requires auth', async () => {
    await request(app).get('/suppliers').expect(401);
  });

  describe('suppliers', () => {
    it("A sees only its own supplier", async () => {
      const res = await agentA.get('/suppliers').expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].companyName).toBe('SUP-A');
    });
    it("A cannot update B's supplier", async () => {
      await agentA.put(`/suppliers/${seeded.B.supplierId}`).send({ companyName: 'HACKED' }).expect(404);
    });
    it("A cannot delete B's supplier", async () => {
      await agentA.delete(`/suppliers/${seeded.B.supplierId}`).expect(404);
      const still = await agentB.get('/suppliers').expect(200);
      expect(still.body.data[0].companyName).toBe('SUP-B');
    });
  });

  describe('products', () => {
    it("A sees only its own product", async () => {
      const res = await agentA.get('/products').expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('PROD-A');
    });
    it("A cannot update B's product", async () => {
      await agentA.put(`/products/${seeded.B.productId}`).send({ name: 'HACKED' }).expect(404);
    });
  });

  describe('orders', () => {
    it("A's order list excludes B's order", async () => {
      const res = await agentA.get('/orders').expect(200);
      const list = res.body.data.list as { orderNumber: string }[];
      expect(list).toHaveLength(1);
      expect(list[0].orderNumber).toBe('ORD-A');
    });
    it("A cannot fetch B's order by id", async () => {
      await agentA.get(`/orders/${seeded.B.orderId}`).expect(404);
    });
    it("A cannot change B's order status", async () => {
      await agentA.put(`/orders/${seeded.B.orderId}/status`).send({ status: 'PENDING' }).expect(404);
    });
  });

  describe('PDF', () => {
    it("A can render its own order PDF", async () => {
      const res = await agentA.get(`/orders/${seeded.A.orderId}/pdf`).expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
    it("A cannot render B's order PDF (404, no leak)", async () => {
      await agentA.get(`/orders/${seeded.B.orderId}/pdf`).expect(404);
    });
  });

  describe('analytics', () => {
    it('overview counts reflect only the caller org', async () => {
      const res = await agentA.get('/analytics/overview').expect(200);
      expect(res.body.data.totalSuppliers).toBe(1);
      expect(res.body.data.totalProducts).toBe(1);
      expect(res.body.data.totalOrdersCount).toBe(1);
    });
    it('top-items never includes another org loss items', async () => {
      const res = await agentA.get('/analytics/top-items').expect(200);
      const names = [...res.body.data.byLossValue, ...res.body.data.byMissingQty].map((r: { name: string }) => r.name);
      expect(names).toContain('ITEM-A');
      expect(names).not.toContain('ITEM-B');
    });
    it('loss-rate counts only the caller org reconciliations', async () => {
      const res = await agentA.get('/analytics/loss-rate').expect(200);
      expect(res.body.data.totalReconciled).toBe(1);
      expect(res.body.data.incidentsWithLoss).toBe(1);
    });
  });

  describe('team invitations', () => {
    it('each org only sees and can revoke its own invitations', async () => {
      const aInv = (await agentA.post('/team/invitations').send({ email: 'newa@test.com', role: 'VIEWER' }).expect(201)).body.data;
      const bInv = (await agentB.post('/team/invitations').send({ email: 'newb@test.com', role: 'VIEWER' }).expect(201)).body.data;

      const aList = (await agentA.get('/team/invitations').expect(200)).body.data as { id: string; email: string }[];
      expect(aList.map((i) => i.email)).toContain('newa@test.com');
      expect(aList.map((i) => i.email)).not.toContain('newb@test.com');

      // A cannot revoke B's invitation
      await agentA.delete(`/team/invitations/${bInv.id}`).expect(404);
      // B's invitation still pending
      const bList = (await agentB.get('/team/invitations').expect(200)).body.data as { id: string }[];
      expect(bList.some((i) => i.id === bInv.id)).toBe(true);

      // A's members list never shows B's admin
      const aMembers = (await agentA.get('/team/members').expect(200)).body.data as { email: string }[];
      expect(aMembers.map((m) => m.email)).toEqual(['admin-a@test.com']);

      void aInv;
    });
  });
});
