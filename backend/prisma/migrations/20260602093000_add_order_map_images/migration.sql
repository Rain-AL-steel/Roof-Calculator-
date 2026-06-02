-- CreateTable
CREATE TABLE "order_images" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "mimeType" VARCHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "order_images_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_images_sizeBytes_check" CHECK ("sizeBytes" <= 512000)
);

-- CreateIndex
CREATE UNIQUE INDEX "order_images_orderId_key" ON "order_images"("orderId");

-- AddForeignKey
ALTER TABLE "order_images" ADD CONSTRAINT "order_images_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
