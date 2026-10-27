-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nameSortKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" VARCHAR(255) NOT NULL,
    "price" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_date_id_idx" ON "products"("date" DESC, "id" ASC);

-- CreateIndex
CREATE INDEX "products_nameSortKey_id_idx" ON "products"("nameSortKey" ASC, "id" ASC);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
  ALTER COLUMN "nameSortKey" TYPE TEXT COLLATE "C";

ALTER TABLE "products"
  ADD CONSTRAINT "product_id_positive"
  CHECK ("id" > 0);

ALTER TABLE "products"
  ADD CONSTRAINT "product_price_nonnegative"
  CHECK ("price" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT "product_amount_nonnegative"
  CHECK ("amount" >= 0);