-- CreateEnum
CREATE TYPE "SupplyMovementType" AS ENUM ('ENTRY', 'EXIT');

-- CreateTable
CREATE TABLE "supply" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "unit_of_measure_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "supply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_stock" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "supply_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minimum_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "supply_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_stock_movement" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "supply_id" UUID NOT NULL,
    "movement_type" "SupplyMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "observation" TEXT,
    "user_id" UUID NOT NULL,
    "movement_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supply_name_key" ON "supply"("name");

-- CreateIndex
CREATE INDEX "supply_unit_of_measure_id_idx" ON "supply"("unit_of_measure_id");

-- CreateIndex
CREATE INDEX "supply_stock_branch_id_idx" ON "supply_stock"("branch_id");

-- CreateIndex
CREATE INDEX "supply_stock_supply_id_idx" ON "supply_stock"("supply_id");

-- CreateIndex
CREATE UNIQUE INDEX "supply_stock_branch_id_supply_id_key" ON "supply_stock"("branch_id", "supply_id");

-- CreateIndex
CREATE INDEX "supply_stock_movement_branch_id_supply_id_idx" ON "supply_stock_movement"("branch_id", "supply_id");

-- CreateIndex
CREATE INDEX "supply_stock_movement_movement_at_idx" ON "supply_stock_movement"("movement_at");

-- AddForeignKey
ALTER TABLE "supply" ADD CONSTRAINT "supply_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock" ADD CONSTRAINT "supply_stock_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock" ADD CONSTRAINT "supply_stock_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock_movement" ADD CONSTRAINT "supply_stock_movement_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock_movement" ADD CONSTRAINT "supply_stock_movement_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock_movement" ADD CONSTRAINT "supply_stock_movement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;
