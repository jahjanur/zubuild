/**
 * Seed script: users, 10+ suppliers, products, orders, and sample reconciliations.
 * Run: npm run db:seed (from repo root or apps/api)
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Fixed default org id — matches the backfill in the scope_data_to_tenant migration.
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

const USERS = [
  { email: 'viewer@aem-residence.com', password: 'viewer', role: 'VIEWER' as const },
  { email: 'admin@aem-residence.com', password: 'admin', role: 'ADMIN' as const },
  { email: 'admin2@aem-residence.com', password: 'admin2', role: 'ADMIN' as const },
];

const SUPPLIERS = [
  { companyName: 'Ako Grad', contactPerson: 'Ahmet Yılmaz', phone: '+389 42 111 222', location: 'Gostivar', status: 'ACTIVE' as const },
  { companyName: 'Demir Market', contactPerson: 'Mehmet Kaya', phone: '+389 42 333 444', location: 'Skopje', status: 'ACTIVE' as const },
  { companyName: 'Boya ve Kimya', contactPerson: 'Fatma Demir', phone: '042 555 666', location: 'Tetovo', status: 'ACTIVE' as const },
  { companyName: 'Çimento A.Ş.', contactPerson: 'Ali Özkan', phone: '+389 2 777 8888', location: 'Skopje', status: 'ACTIVE' as const },
  { companyName: 'Inşaat Malzemeleri', contactPerson: 'Zeynep Arslan', phone: '078 123 456', location: 'Gostivar', status: 'ACTIVE' as const },
  { companyName: 'Elektrik Ekipman', contactPerson: 'Can Yıldız', phone: '+389 42 999 000', location: 'Ohrid', status: 'ACTIVE' as const },
  { companyName: 'Mermer ve Granit', contactPerson: 'Elif Şahin', phone: '042 111 3333', location: 'Prilep', status: 'ACTIVE' as const },
  { companyName: 'Kereste Depo', contactPerson: 'Burak Çelik', phone: '+389 78 444 555', location: 'Bitola', status: 'ACTIVE' as const },
  { companyName: 'Cam ve Pencere', contactPerson: 'Selin Aydın', phone: '02 666 7777', location: 'Skopje', status: 'ACTIVE' as const },
  { companyName: 'Tesisat Malzemeleri', contactPerson: 'Emre Koç', phone: '+389 42 888 999', location: 'Tetovo', status: 'ACTIVE' as const },
  { companyName: 'Hırdavat Dünyası', contactPerson: 'Deniz Polat', phone: null, location: 'Gostivar', status: 'INACTIVE' as const },
];

// Demo catalog in Albanian (product names/categories/units are per-org DATA, not
// UI strings — they display exactly as stored, so the seed sets the demo language).
const PRODUCTS = [
  { name: 'Hekur 12mm', category: 'Hekur', measurementUnit: 'ton' as const, price: 850, status: 'ACTIVE' as const },
  { name: 'Hekur 8mm', category: 'Hekur', measurementUnit: 'ton' as const, price: 820, status: 'ACTIVE' as const },
  { name: 'Çimento 50kg', category: 'Çimento', measurementUnit: 'torba' as const, price: 450, status: 'ACTIVE' as const },
  { name: 'Rërë ndërtimi', category: 'Agregat', measurementUnit: 'm³' as const, price: 1200, status: 'ACTIVE' as const },
  { name: 'Bojë e bardhë 15L', category: 'Bojë', measurementUnit: 'kutu' as const, price: 1800, status: 'ACTIVE' as const },
  { name: 'Bojë me bazë uji', category: 'Bojë', measurementUnit: 'litre' as const, price: 95, status: 'ACTIVE' as const },
  { name: 'Pllakë 30x30', category: 'Qeramikë', measurementUnit: 'm²' as const, price: 350, status: 'ACTIVE' as const },
  { name: 'Gozhdë 3"', category: 'Hekurishte', measurementUnit: 'kg' as const, price: 28, status: 'ACTIVE' as const },
  { name: 'Kabull 3x2.5', category: 'Elektrik', measurementUnit: 'm' as const, price: 45, status: 'ACTIVE' as const },
  { name: 'Tub PVC 50mm', category: 'Hidrosanitare', measurementUnit: 'm' as const, price: 85, status: 'ACTIVE' as const },
  { name: 'Tullë', category: 'Tullë', measurementUnit: 'adet' as const, price: 2.5, status: 'ACTIVE' as const },
  { name: 'Gëlqere 25kg', category: 'Çimento', measurementUnit: 'torba' as const, price: 320, status: 'ACTIVE' as const },
  { name: 'Pllakë mermeri', category: 'Mermer', measurementUnit: 'm²' as const, price: 1200, status: 'ACTIVE' as const },
  { name: 'Parket laminat', category: 'Parket', measurementUnit: 'm²' as const, price: 280, status: 'ACTIVE' as const },
  { name: 'Tjegull çatie', category: 'Çati', measurementUnit: 'adet' as const, price: 8, status: 'ACTIVE' as const },
];

async function main() {
  console.log('Seeding organization...');
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: {
      id: DEFAULT_ORG_ID,
      name: 'AEM Residence',
      slug: 'aem-residence',
      invoiceName: 'AEM Residence',
      invoiceAddress: 'ul. Marshal Tito 123, Gostivar 1230',
      invoiceRegNo: 'Mat. Br. 1234567890123',
      currency: 'MKD',
      locale: 'mk',
      plan: 'FREE',
    },
  });

  console.log('Seeding users...');
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, organizationId: DEFAULT_ORG_ID },
      create: { email: u.email, passwordHash, role: u.role, organizationId: DEFAULT_ORG_ID },
    });
    console.log(`  ${u.role}: ${u.email}`);
  }

  console.log('Seeding suppliers...');
  const supplierIds: string[] = [];
  for (const s of SUPPLIERS) {
    const created = await prisma.supplier.create({
      data: {
        companyName: s.companyName,
        contactPerson: s.contactPerson,
        phone: s.phone,
        location: s.location,
        status: s.status,
        organizationId: DEFAULT_ORG_ID,
      },
    });
    supplierIds.push(created.id);
  }
  console.log(`  Created ${supplierIds.length} suppliers.`);

  console.log('Seeding products...');
  const productRows: { id: string; name: string; unit: string; price: number }[] = [];
  for (const p of PRODUCTS) {
    const created = await prisma.product.create({
      data: {
        name: p.name,
        category: p.category,
        measurementUnit: p.measurementUnit,
        price: p.price,
        status: p.status,
        organizationId: DEFAULT_ORG_ID,
      },
    });
    productRows.push({
      id: created.id,
      name: created.name,
      unit: created.measurementUnit,
      price: created.price,
    });
  }
  console.log(`  Created ${productRows.length} products.`);

  console.log('Seeding orders...');
  const orderIds: string[] = [];
  const orderNumbers = ['ORD-SEED001', 'ORD-SEED002', 'ORD-SEED003', 'ORD-SEED004', 'ORD-SEED005', 'ORD-SEED006', 'ORD-SEED007', 'ORD-SEED008', 'ORD-SEED009', 'ORD-SEED010'];
  for (let i = 0; i < 10; i++) {
    const supplierId = supplierIds[i % supplierIds.length];
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) continue;
    const items = [
      { productId: productRows[i % productRows.length].id, name: productRows[i % productRows.length].name, unit: productRows[i % productRows.length].unit, price: productRows[i % productRows.length].price, quantity: (i % 3) + 2 },
      { productId: productRows[(i + 2) % productRows.length].id, name: productRows[(i + 2) % productRows.length].name, unit: productRows[(i + 2) % productRows.length].unit, price: productRows[(i + 2) % productRows.length].price, quantity: (i % 2) + 1 },
    ];
    const totalAmount = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - i * 3);

    const order = await prisma.order.create({
      data: {
        orderNumber: orderNumbers[i],
        orderDate,
        supplierId,
        supplierName: supplier.companyName,
        totalAmount,
        status: i < 3 ? 'RECONCILED' : i < 6 ? 'DELIVERED' : 'PENDING',
        notes: i === 0 ? 'İlk test siparişi' : null,
        organizationId: DEFAULT_ORG_ID,
        orderItems: {
          create: items.map((it) => ({
            productId: it.productId,
            name: it.name,
            unit: it.unit,
            price: it.price,
            quantity: it.quantity,
            organizationId: DEFAULT_ORG_ID,
          })),
        },
      },
      include: { orderItems: true },
    });
    orderIds.push(order.id);
  }
  console.log(`  Created ${orderIds.length} orders.`);

  console.log('Seeding reconciliations (for first 3 orders)...');
  for (let i = 0; i < 3 && i < orderIds.length; i++) {
    const order = await prisma.order.findUnique({
      where: { id: orderIds[i] },
      include: { orderItems: true },
    });
    if (!order || order.orderItems.length === 0) continue;
    const rec = await prisma.reconciliation.create({
      data: {
        orderId: order.id,
        totalLossValue: i === 0 ? 150 : i === 1 ? 0 : 320,
        organizationId: DEFAULT_ORG_ID,
        items: {
          create: order.orderItems.map((oi, idx) => ({
            orderItemId: oi.id,
            name: oi.name,
            unit: oi.unit,
            price: oi.price,
            orderedQty: oi.quantity,
            receivedQty: Math.max(0, oi.quantity - (i === 0 && idx === 0 ? 1 : 0)),
            missingQty: i === 0 && idx === 0 ? 1 : 0,
            lossValue: i === 0 && idx === 0 ? Number(oi.price) : 0,
            status: i === 0 && idx === 0 ? 'MISSING' : 'COMPLETE',
          })),
        },
      },
    });
    console.log(`  Reconciliation for ${order.orderNumber}, loss: ${rec.totalLossValue}`);
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
