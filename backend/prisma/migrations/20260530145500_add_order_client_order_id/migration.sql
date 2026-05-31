-- Add nullable client idempotency key for frontend-created orders.
ALTER TABLE "orders" ADD COLUMN "clientOrderId" TEXT;

CREATE UNIQUE INDEX "orders_clientOrderId_key" ON "orders"("clientOrderId");
