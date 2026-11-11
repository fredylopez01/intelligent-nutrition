ALTER TABLE "inventory_closure"
ADD COLUMN "cash_shift_id" UUID;

CREATE INDEX "inventory_closure_cash_shift_id_idx"
ON "inventory_closure"("cash_shift_id");

ALTER TABLE "inventory_closure"
ADD CONSTRAINT "inventory_closure_cash_shift_id_fkey"
FOREIGN KEY ("cash_shift_id") REFERENCES "cash_shift"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
