-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('ACCESSORY', 'STEEL', 'OTHER_TILE');

-- CreateEnum
CREATE TYPE "ProductOptionGroup" AS ENUM ('UNIT', 'COLOR', 'SEGMENT_LENGTH', 'TUBE_SPEC', 'THICKNESS', 'BOLT_SPEC');

-- CreateEnum
CREATE TYPE "OrderLineType" AS ENUM ('ACCESSORY', 'STEEL', 'OTHER_TILE');

-- CreateEnum
CREATE TYPE "MapProvider" AS ENUM ('AMAP');

-- CreateEnum
CREATE TYPE "MapLocationStatus" AS ENUM ('RESOLVED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT,
    "hashAlgorithm" TEXT NOT NULL DEFAULT 'PBKDF2-SHA256',
    "hashIterations" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderNo" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "customerName" TEXT,
    "tileColor" TEXT,
    "remark" TEXT,
    "deliveryAddress" TEXT,
    "completionMonth" VARCHAR(7),
    "areaTotal" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "mainAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "accessoryAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "steelAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherTileAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mapLocationCacheId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_main_rows" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "lengthsText" TEXT,
    "totalQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "actual" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "area" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "order_main_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "type" "OrderLineType" NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "nameSnapshot" TEXT NOT NULL,
    "unitSnapshot" TEXT,
    "qty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "length" DECIMAL(14,4),
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "defaultUnit" TEXT NOT NULL,
    "defaultPrice" DECIMAL(14,2),
    "spec" TEXT,
    "common" BOOLEAN,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_options" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "group" "ProductOptionGroup" NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" DECIMAL(14,4),
    "sort" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_location_caches" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "provider" "MapProvider" NOT NULL DEFAULT 'AMAP',
    "cityHint" TEXT NOT NULL DEFAULT '',
    "sourceAddress" TEXT NOT NULL,
    "normalizedAddress" TEXT NOT NULL,
    "formattedAddress" TEXT,
    "province" TEXT,
    "city" TEXT,
    "district" TEXT,
    "adcode" TEXT,
    "lng" DECIMAL(10,6),
    "lat" DECIMAL(10,6),
    "status" "MapLocationStatus" NOT NULL DEFAULT 'RESOLVED',
    "errorMessage" TEXT,
    "geocodedAt" TIMESTAMP(3),

    CONSTRAINT "map_location_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNo_key" ON "orders"("orderNo");

-- CreateIndex
CREATE INDEX "orders_orderDate_idx" ON "orders"("orderDate");

-- CreateIndex
CREATE INDEX "orders_customerName_idx" ON "orders"("customerName");

-- CreateIndex
CREATE INDEX "orders_mapLocationCacheId_idx" ON "orders"("mapLocationCacheId");

-- CreateIndex
CREATE INDEX "order_main_rows_orderId_idx" ON "order_main_rows"("orderId");

-- CreateIndex
CREATE INDEX "order_line_items_orderId_idx" ON "order_line_items"("orderId");

-- CreateIndex
CREATE INDEX "order_line_items_productId_idx" ON "order_line_items"("productId");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "product_options_group_idx" ON "product_options"("group");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "system_configs_group_idx" ON "system_configs"("group");

-- CreateIndex
CREATE INDEX "map_location_caches_adcode_idx" ON "map_location_caches"("adcode");

-- CreateIndex
CREATE UNIQUE INDEX "map_location_caches_provider_cityHint_normalizedAddress_key" ON "map_location_caches"("provider", "cityHint", "normalizedAddress");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_mapLocationCacheId_fkey" FOREIGN KEY ("mapLocationCacheId") REFERENCES "map_location_caches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_main_rows" ADD CONSTRAINT "order_main_rows_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
