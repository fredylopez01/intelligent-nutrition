ALTER TABLE "sale_detail"
ADD COLUMN "recipe_id" UUID;

CREATE INDEX "sale_detail_recipe_id_idx"
ON "sale_detail"("recipe_id");

ALTER TABLE "sale_detail"
ADD CONSTRAINT "sale_detail_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
