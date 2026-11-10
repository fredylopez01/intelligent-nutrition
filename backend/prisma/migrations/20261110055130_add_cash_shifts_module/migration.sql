-- CreateEnum
CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "cash_shift" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "opened_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(6),
    "opening_amount" DECIMAL(12,2) NOT NULL,
    "closing_amount" DECIMAL(12,2),
    "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN',
    "observation" TEXT,

    CONSTRAINT "cash_shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_shift_branch_id_status_idx" ON "cash_shift"("branch_id", "status");

-- CreateIndex
CREATE INDEX "cash_shift_user_id_status_idx" ON "cash_shift"("user_id", "status");

-- AddForeignKey
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;
