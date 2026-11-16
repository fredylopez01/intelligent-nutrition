-- AlterTable
ALTER TABLE "supply" ADD COLUMN     "product_unit_quantity" DECIMAL(12,3),
ADD COLUMN     "source_product_id" UUID;

-- AddForeignKey
ALTER TABLE "supply" ADD CONSTRAINT "supply_source_product_id_fkey" FOREIGN KEY ("source_product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supply" ADD CONSTRAINT "supply_product_link_check" CHECK (("source_product_id" IS NULL AND "product_unit_quantity" IS NULL) OR ("source_product_id" IS NOT NULL AND "product_unit_quantity" > 0));
