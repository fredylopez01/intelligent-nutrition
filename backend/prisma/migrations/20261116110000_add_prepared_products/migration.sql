-- AlterTable
ALTER TABLE "recipe" ADD COLUMN     "product_id" UUID;

-- AlterTable
ALTER TABLE "supply_stock_movement" ADD COLUMN     "sale_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "recipe_product_id_key" ON "recipe"("product_id");

-- CreateIndex
CREATE INDEX "supply_stock_movement_sale_id_idx" ON "supply_stock_movement"("sale_id");

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock_movement" ADD CONSTRAINT "supply_stock_movement_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
