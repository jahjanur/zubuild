/**
 * Role matrix — server-side enforcement test (P0).
 *
 * Boots the real app on a throwaway DB, logs in a VIEWER, MANAGER and ADMIN in
 * the same org, and proves each role can only do what the matrix allows via the
 * actual routes (never trusting a client-supplied role):
 *   VIEWER  — read only
 *   MANAGER — + operational writes + CSV export
 *   ADMIN   — + team administration
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
const dbFile = path.join(os.tmpdir(), `zubuild-roles-${process.pid}.db`);
const dbUrl = `file:${dbFile}`;
const ORG = 'cccccccc-0000-0000-0000-00000000000c';
const PASSWORD = 'secret123';

let app: Express;
let prisma: PrismaClient;
const agents: Record<'VIEWER' | 'MANAGER' | 'ADMIN', ReturnType<typeof request.agent>> = {} as never;

beforeAll(async () => {
  process.env.DATABASE_URL = dbUrl;
  process.env.SESSION_SECRET = 'test-secret-abcdefghijklmnop';
  process.env.NODE_ENV = 'test';
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  execSync('npx prisma migrate deploy', { cwd: apiRoot, env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'ignore' });

  prisma = (await import('../lib/prisma')).prisma;
  app = (await import('../index')).app;

  await prisma.organization.create({ data: { id: ORG, name: 'Roles Org', slug: 'roles-org' } });
  const hash = await bcrypt.hash(PASSWORD, 12);
  for (const role of ['VIEWER', 'MANAGER', 'ADMIN'] as const) {
    await prisma.user.create({ data: { email: `${role.toLowerCase()}@test.com`, passwordHash: hash, role, organizationId: ORG } });
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: `${role.toLowerCase()}@test.com`, password: PASSWORD }).expect(200);
    agents[role] = agent;
  }
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
});

// [role, method, path, body, expectedStatus]
type Case = ['VIEWER' | 'MANAGER' | 'ADMIN', 'get' | 'post', string, object | undefined, number];

describe('role matrix (server-enforced)', () => {
  const reads: Case[] = [
    ['VIEWER', 'get', '/suppliers', undefined, 200],
    ['VIEWER', 'get', '/products', undefined, 200],
    ['VIEWER', 'get', '/analytics/overview', undefined, 200],
  ];
  const viewerDenied: Case[] = [
    ['VIEWER', 'post', '/suppliers', { companyName: 'X' }, 403],
    ['VIEWER', 'post', '/products', { name: 'X', category: 'C', measurementUnit: 'adet', price: 1 }, 403],
    ['VIEWER', 'post', '/reconciliations', {}, 403],
    ['VIEWER', 'post', '/inventory/adjust', {}, 403],
    ['VIEWER', 'get', '/control/export.csv', undefined, 403],
    ['VIEWER', 'get', '/team/members', undefined, 403],
    ['VIEWER', 'post', '/team/invitations', { email: 'x@test.com', role: 'VIEWER' }, 403],
  ];
  const managerCan: Case[] = [
    ['MANAGER', 'post', '/suppliers', { companyName: 'By manager' }, 201],
    ['MANAGER', 'get', '/control/export.csv', undefined, 200],
  ];
  const managerDenied: Case[] = [
    ['MANAGER', 'get', '/team/members', undefined, 403],
    ['MANAGER', 'post', '/team/invitations', { email: 'y@test.com', role: 'VIEWER' }, 403],
  ];
  const adminCan: Case[] = [
    ['ADMIN', 'post', '/suppliers', { companyName: 'By admin' }, 201],
    ['ADMIN', 'get', '/team/members', undefined, 200],
    ['ADMIN', 'post', '/team/invitations', { email: 'z@test.com', role: 'MANAGER' }, 201],
  ];

  for (const [role, method, url, body, status] of [...reads, ...viewerDenied, ...managerCan, ...managerDenied, ...adminCan]) {
    it(`${role} ${method.toUpperCase()} ${url} -> ${status}`, async () => {
      const req = agents[role][method](url);
      const res = await (body ? req.send(body) : req);
      expect(res.status).toBe(status);
    });
  }
});
