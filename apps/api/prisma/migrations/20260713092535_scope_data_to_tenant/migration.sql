-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "deltaQty" INTEGER NOT NULL,
    "reason" TEXT,
    "orderId" TEXT,
    "reconciliationId" TEXT,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InventoryMovement" ("createdAt", "deltaQty", "id", "orderId", "productId", "reason", "reconciliationId", "type") SELECT "createdAt", "deltaQty", "id", "orderId", "productId", "reason", "reconciliationId", "type" FROM "InventoryMovement";
DROP TABLE "InventoryMovement";
ALTER TABLE "new_InventoryMovement" RENAME TO "InventoryMovement";
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");
CREATE INDEX "InventoryMovement_organizationId_idx" ON "InventoryMovement"("organizationId");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "orderDate" DATETIME NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "id", "notes", "orderDate", "orderNumber", "status", "supplierId", "supplierName", "totalAmount", "updatedAt") SELECT "createdAt", "id", "notes", "orderDate", "orderNumber", "status", "supplierId", "supplierName", "totalAmount", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_organizationId_idx" ON "Order"("organizationId");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "OrderItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id", "name", "orderId", "price", "productId", "quantity", "unit") SELECT "id", "name", "orderId", "price", "productId", "quantity", "unit" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_organizationId_idx" ON "OrderItem"("organizationId");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "measurementUnit" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("category", "createdAt", "id", "measurementUnit", "name", "price", "status", "updatedAt") SELECT "category", "createdAt", "id", "measurementUnit", "name", "price", "status", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_organizationId_idx" ON "Product"("organizationId");
CREATE TABLE "new_Reconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "reconciliationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "totalLossValue" REAL NOT NULL,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reconciliation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reconciliation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Reconciliation" ("createdAt", "id", "notes", "orderId", "reconciliationDate", "totalLossValue") SELECT "createdAt", "id", "notes", "orderId", "reconciliationDate", "totalLossValue" FROM "Reconciliation";
DROP TABLE "Reconciliation";
ALTER TABLE "new_Reconciliation" RENAME TO "Reconciliation";
CREATE UNIQUE INDEX "Reconciliation_orderId_key" ON "Reconciliation"("orderId");
CREATE INDEX "Reconciliation_organizationId_idx" ON "Reconciliation"("organizationId");
CREATE TABLE "new_Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Supplier" ("companyName", "contactPerson", "createdAt", "id", "location", "phone", "status", "updatedAt") SELECT "companyName", "contactPerson", "createdAt", "id", "location", "phone", "status", "updatedAt" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE INDEX "Supplier_organizationId_idx" ON "Supplier"("organizationId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "passwordHash", "role", "updatedAt") SELECT "createdAt", "email", "id", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- Backfill: put every pre-existing (unscoped) row into a single default org.
-- The default org id is fixed and referenced by the seed script so local resets
-- stay consistent. Idempotent via WHERE organizationId IS NULL.
INSERT INTO "Organization" ("id", "name", "slug", "invoiceName", "invoiceAddress", "invoiceRegNo", "currency", "locale", "plan", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'AEM Residence', 'aem-residence', 'AEM Residence', 'ul. Marshal Tito 123, Gostivar 1230', 'Mat. Br. 1234567890123', 'MKD', 'mk', 'FREE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "User" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Supplier" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Product" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Order" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "OrderItem" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Reconciliation" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "InventoryMovement" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
