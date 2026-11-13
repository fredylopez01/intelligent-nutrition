INSERT INTO "supply_stock" ("id", "branch_id", "supply_id", "quantity", "minimum_quantity", "updated_at")
SELECT gen_random_uuid(), b."id", s."id", 0, 0, NOW()
FROM "supply" s
CROSS JOIN "branch" b
WHERE s."active" = true
  AND b."active" = true
ON CONFLICT ("branch_id", "supply_id") DO NOTHING;
