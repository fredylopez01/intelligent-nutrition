-- CreateEnum
CREATE TYPE "OnlineOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OnlineOrderFulfillment" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ONLINE_ORDER';

-- AlterTable
ALTER TABLE "branch" ADD COLUMN     "delivery_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "online_order" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "status" "OnlineOrderStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillment" "OnlineOrderFulfillment" NOT NULL,
    "branch_id" UUID NOT NULL,
    "customer_id" UUID,
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_phone" VARCHAR(30) NOT NULL,
    "customer_email" VARCHAR(150),
    "delivery_address" VARCHAR(255),
    "delivery_neighborhood" VARCHAR(100),
    "notes" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "sale_id" UUID,
    "cancel_reason" TEXT,
    "confirmed_at" TIMESTAMP(6),
    "delivered_at" TIMESTAMP(6),
    "cancelled_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "online_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_order_item" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "online_order_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "online_order_item_quantity_check" CHECK ("quantity" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "online_order_code_key" ON "online_order"("code");

-- CreateIndex
CREATE UNIQUE INDEX "online_order_sale_id_key" ON "online_order"("sale_id");

-- CreateIndex
CREATE INDEX "online_order_branch_id_status_idx" ON "online_order"("branch_id", "status");

-- CreateIndex
CREATE INDEX "online_order_status_expires_at_idx" ON "online_order"("status", "expires_at");

-- CreateIndex
CREATE INDEX "online_order_created_at_idx" ON "online_order"("created_at");

-- CreateIndex
CREATE INDEX "online_order_item_product_id_idx" ON "online_order_item"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "online_order_item_order_id_product_id_key" ON "online_order_item"("order_id", "product_id");

-- AddForeignKey
ALTER TABLE "online_order" ADD CONSTRAINT "online_order_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_order" ADD CONSTRAINT "online_order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("person_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_order" ADD CONSTRAINT "online_order_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_order_item" ADD CONSTRAINT "online_order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "online_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_order_item" ADD CONSTRAINT "online_order_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

