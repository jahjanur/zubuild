-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "invoiceName" TEXT,
    "invoiceAddress" TEXT,
    "invoiceEmail" TEXT,
    "invoicePhone" TEXT,
    "invoiceRegNo" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MKD',
    "locale" TEXT NOT NULL DEFAULT 'mk',
    "mkdToEurRate" REAL NOT NULL DEFAULT 61.5,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Organization" ("createdAt", "currency", "id", "invoiceAddress", "invoiceEmail", "invoiceName", "invoicePhone", "invoiceRegNo", "locale", "logoUrl", "name", "plan", "slug", "updatedAt") SELECT "createdAt", "currency", "id", "invoiceAddress", "invoiceEmail", "invoiceName", "invoicePhone", "invoiceRegNo", "locale", "logoUrl", "name", "plan", "slug", "updatedAt" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
