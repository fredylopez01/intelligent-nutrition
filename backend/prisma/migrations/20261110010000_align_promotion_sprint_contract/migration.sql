ALTER TABLE "promotion"
    ALTER COLUMN "start_date" DROP NOT NULL,
    ALTER COLUMN "end_date" DROP NOT NULL,
    ALTER COLUMN "active" SET DEFAULT false,
    ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "promotion"
    ALTER COLUMN "updated_at" DROP DEFAULT;

WITH ranked_active_promotions AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "created_at" DESC, "id" ASC) AS row_num
    FROM "promotion"
    WHERE "active" = true
)
UPDATE "promotion"
SET "active" = false
FROM ranked_active_promotions
WHERE "promotion"."id" = ranked_active_promotions."id"
  AND ranked_active_promotions.row_num > 1;

ALTER TABLE "promotion"
    ADD CONSTRAINT "promotion_name_key" UNIQUE ("name");

DROP INDEX "promotion_active_start_date_end_date_idx";

CREATE INDEX "promotion_active_idx"
    ON "promotion"("active");

CREATE UNIQUE INDEX "promotion_one_active_idx"
    ON "promotion"("active")
    WHERE "active" = true;
