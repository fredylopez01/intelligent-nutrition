CREATE TABLE "promotion" (
    "id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "discount_percentage" DECIMAL(5, 2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promotion_active_start_date_end_date_idx"
    ON "promotion"("active", "start_date", "end_date");

ALTER TABLE "promotion"
    ADD CONSTRAINT "promotion_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "user_account"("person_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
