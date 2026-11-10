ALTER TABLE "sale"
    ADD COLUMN "promotion_id" UUID,
    ADD COLUMN "promotion_discount" DECIMAL(12, 2);

ALTER TABLE "sale"
    ADD CONSTRAINT "sale_promotion_id_fkey"
    FOREIGN KEY ("promotion_id") REFERENCES "promotion"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "sale_promotion_id_idx"
    ON "sale"("promotion_id");
