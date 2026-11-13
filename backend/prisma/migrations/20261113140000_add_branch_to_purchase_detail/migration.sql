ALTER TABLE "purchase_detail"
ADD COLUMN "branch_id" UUID;

CREATE INDEX "purchase_detail_branch_id_idx"
ON "purchase_detail"("branch_id");

ALTER TABLE "purchase_detail"
ADD CONSTRAINT "purchase_detail_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
