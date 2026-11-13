CREATE TABLE "inventory_closure_supply_detail" (
    "id" UUID NOT NULL,
    "closure_id" UUID NOT NULL,
    "supply_id" UUID NOT NULL,
    "system_quantity" DECIMAL(12,3) NOT NULL,
    "physical_quantity" DECIMAL(12,3),
    "difference" DECIMAL(12,3),
    "observation" TEXT,

    CONSTRAINT "inventory_closure_supply_detail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_closure_supply_detail_closure_id_supply_id_key" ON "inventory_closure_supply_detail"("closure_id", "supply_id");

CREATE INDEX "inventory_closure_supply_detail_closure_id_idx" ON "inventory_closure_supply_detail"("closure_id");

CREATE INDEX "inventory_closure_supply_detail_supply_id_idx" ON "inventory_closure_supply_detail"("supply_id");

ALTER TABLE "inventory_closure_supply_detail" ADD CONSTRAINT "inventory_closure_supply_detail_closure_id_fkey" FOREIGN KEY ("closure_id") REFERENCES "inventory_closure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_closure_supply_detail" ADD CONSTRAINT "inventory_closure_supply_detail_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
