-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "color" TEXT NOT NULL DEFAULT '#E9B21C',
    "icon" TEXT NOT NULL DEFAULT 'sparkles',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Category" ("active", "color", "icon", "id", "kind", "name", "order", "slug") SELECT "active", "color", "icon", "id", "kind", "name", "order", "slug" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE TABLE "new_ExpenseCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#E9B21C',
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_ExpenseCategory" ("active", "color", "id", "name") SELECT "active", "color", "id", "name" FROM "ExpenseCategory";
DROP TABLE "ExpenseCategory";
ALTER TABLE "new_ExpenseCategory" RENAME TO "ExpenseCategory";
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "businessName" TEXT NOT NULL DEFAULT 'Ariale Studio',
    "tagline" TEXT NOT NULL DEFAULT 'Manicura, pedicura y depilación',
    "logoUrl" TEXT,
    "slug" TEXT NOT NULL DEFAULT 'ariale-studio',
    "phone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Caracas',
    "countryCode" TEXT NOT NULL DEFAULT '+58',
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT false,
    "maxDaysAhead" INTEGER NOT NULL DEFAULT 45,
    "minHoursAhead" INTEGER NOT NULL DEFAULT 1,
    "currencyLabel" TEXT NOT NULL DEFAULT 'Dólar BCV',
    "rateMode" TEXT NOT NULL DEFAULT 'AUTO',
    "manualRate" REAL NOT NULL DEFAULT 0,
    "accentColor" TEXT NOT NULL DEFAULT '#E9B21C',
    "menuColor" TEXT NOT NULL DEFAULT '#1A1A1A',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("accentColor", "address", "autoConfirm", "businessName", "countryCode", "currencyLabel", "id", "instagram", "logoUrl", "manualRate", "maxDaysAhead", "menuColor", "minHoursAhead", "phone", "rateMode", "slotMinutes", "slug", "tagline", "timezone", "updatedAt", "whatsapp") SELECT "accentColor", "address", "autoConfirm", "businessName", "countryCode", "currencyLabel", "id", "instagram", "logoUrl", "manualRate", "maxDaysAhead", "menuColor", "minHoursAhead", "phone", "rateMode", "slotMinutes", "slug", "tagline", "timezone", "updatedAt", "whatsapp" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_Specialist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pin" TEXT NOT NULL DEFAULT '0000',
    "phone" TEXT,
    "email" TEXT,
    "color" TEXT NOT NULL DEFAULT '#E9B21C',
    "avatarUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Specialist" ("active", "avatarUrl", "color", "createdAt", "email", "id", "name", "phone", "pin", "slug", "updatedAt") SELECT "active", "avatarUrl", "color", "createdAt", "email", "id", "name", "phone", "pin", "slug", "updatedAt" FROM "Specialist";
DROP TABLE "Specialist";
ALTER TABLE "new_Specialist" RENAME TO "Specialist";
CREATE UNIQUE INDEX "Specialist_slug_key" ON "Specialist"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
