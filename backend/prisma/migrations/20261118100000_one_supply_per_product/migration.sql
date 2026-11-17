-- Keep the oldest supply linked to each product; the others stay as plain supplies.
UPDATE "supply" AS s
SET "source_product_id" = NULL, "product_unit_quantity" = NULL
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "source_product_id" ORDER BY "created_at", "id") AS "position"
  FROM "supply"
  WHERE "source_product_id" IS NOT NULL
) AS duplicated
WHERE s."id" = duplicated."id" AND duplicated."position" > 1;

-- Linked supplies take the name of their product when no other supply uses it.
WITH candidates AS (
  SELECT s."id", p."name", ROW_NUMBER() OVER (PARTITION BY lower(p."name") ORDER BY s."created_at", s."id") AS "position"
  FROM "supply" s
  JOIN "product" p ON p."id" = s."source_product_id"
  WHERE s."name" <> p."name"
)
UPDATE "supply" AS s
SET "name" = c."name", "updated_at" = CURRENT_TIMESTAMP
FROM candidates c
WHERE s."id" = c."id"
  AND c."position" = 1
  AND NOT EXISTS (
    SELECT 1 FROM "supply" other WHERE lower(other."name") = lower(c."name") AND other."id" <> c."id"
  );

-- CreateIndex
CREATE UNIQUE INDEX "supply_source_product_id_key" ON "supply"("source_product_id");
