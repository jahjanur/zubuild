/**
 * Password reset + change-password flow (integration).
 * Boots the real app on a throwaway DB and drives the standard flows end-to-end.
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
const dbFile = path.join(os.tmpdir(), `zubuild-authflow-${process.pid}.db`);
const dbUrl = `file:${dbFile}`;
const ORG = 'dddddddd-0000-0000-0000-00000000000d';
const EMAIL = 'reset@test.com';

let app: Express;
let prisma: PrismaClient;

beforeAll(async () => {
  process.env.DATABASE_URL = dbUrl;
  process.env.SESSION_SECRET = 'test-secret-abcdefghijklmnop';
  process.env.NODE_ENV = 'test';
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  execSync('npx prisma migrate deploy', { cwd: apiRoot, env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'ignore' });
  prisma = (await import('../lib/prisma')).prisma;
  app = (await import('../index')).app;
  await prisma.organization.create({ data: { id: ORG, name: 'Auth Org', slug: 'auth-org' } });
  await prisma.user.create({ data: { email: EMAIL, passwordHash: await bcrypt.hash('original1', 12), role: 'ADMIN', organizationId: ORG } });
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
});

async function tokenFor(email: string): Promise<string> {
  const res = await request(app).post('/auth/forgot-password').send({ email }).expect(200);
  return String(res.body.data.resetUrl).split('/reset-password/')[1];
}

describe('password reset', () => {
  it('unknown email still returns 200 and leaks no link', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'nobody@test.com' }).expect(200);
    expect(res.body.data.resetUrl).toBeUndefined();
  });

  it('reset link validates, sets a new password, and is single-use', async () => {
    const token = await tokenFor(EMAIL);
    await request(app).get(`/auth/reset-password/${token}`).expect(200);
    await request(app).post(`/auth/reset-password/${token}`).send({ password: 'brandnew1' }).expect(200);
    // consumed
    await request(app).post(`/auth/reset-password/${token}`).send({ password: 'again12345' }).expect(404);
    // new password works, old does not
    await request(app).post('/auth/login').send({ email: EMAIL, password: 'brandnew1' }).expect(200);
    await request(app).post('/auth/login').send({ email: EMAIL, password: 'original1' }).expect(401);
  });
});

describe('change password', () => {
  it('requires the correct current password, then updates it', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: EMAIL, password: 'brandnew1' }).expect(200);
    await agent.post('/auth/change-password').send({ currentPassword: 'WRONG', newPassword: 'changed123' }).expect(400);
    await agent.post('/auth/change-password').send({ currentPassword: 'brandnew1', newPassword: 'changed123' }).expect(200);
    await request(app).post('/auth/login').send({ email: EMAIL, password: 'changed123' }).expect(200);
  });

  it('rejects unauthenticated change-password', async () => {
    await request(app).post('/auth/change-password').send({ currentPassword: 'x', newPassword: 'yyyyyyyy' }).expect(401);
  });
});
