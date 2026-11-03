-- AlterTable
ALTER TABLE "orders" ADD COLUMN "requestKey" VARCHAR(64);

-- CreateIndex: to samo żądanie (użytkownik + klucz) nie utworzy drugiego zamówienia
CREATE UNIQUE INDEX "orders_userId_requestKey_key" ON "orders"("userId", "requestKey");

-- Prisma nie wyraża CHECK w schema.prisma
ALTER TABLE "orders"
  ADD CONSTRAINT "order_request_key_not_empty" CHECK ("requestKey" IS NULL OR length("requestKey") > 0);
