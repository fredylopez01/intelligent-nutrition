-- CreateTable
CREATE TABLE "supply_purchase" (
    "id" UUID NOT NULL,
    "purchase_number" VARCHAR(30) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purchase_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(12,2) NOT NULL,
    "observation" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING_RECEIPT',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "supply_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_purchase_detail" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "supply_id" UUID NOT NULL,
    "requested_quantity" DECIMAL(12,3) NOT NULL,
    "received_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "supply_purchase_detail_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supply_purchase_detail_quantity_check" CHECK ("requested_quantity" > 0 AND "received_quantity" >= 0 AND "received_quantity" <= "requested_quantity")
);

-- CreateIndex
CREATE UNIQUE INDEX "supply_purchase_purchase_number_key" ON "supply_purchase"("purchase_number");

-- CreateIndex
CREATE INDEX "supply_purchase_supplier_id_idx" ON "supply_purchase"("supplier_id");

-- CreateIndex
CREATE INDEX "supply_purchase_purchase_at_idx" ON "supply_purchase"("purchase_at");

-- CreateIndex
CREATE INDEX "supply_purchase_detail_supply_id_idx" ON "supply_purchase_detail"("supply_id");

-- CreateIndex
CREATE UNIQUE INDEX "supply_purchase_detail_purchase_id_supply_id_key" ON "supply_purchase_detail"("purchase_id", "supply_id");

-- AddForeignKey
ALTER TABLE "supply_purchase" ADD CONSTRAINT "supply_purchase_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_purchase" ADD CONSTRAINT "supply_purchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_purchase_detail" ADD CONSTRAINT "supply_purchase_detail_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "supply_purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_purchase_detail" ADD CONSTRAINT "supply_purchase_detail_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

