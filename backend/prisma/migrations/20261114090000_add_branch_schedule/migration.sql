CREATE TABLE "branch_schedule" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "opens_at" VARCHAR(5) NOT NULL,
    "closes_at" VARCHAR(5) NOT NULL,

    CONSTRAINT "branch_schedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "branch_schedule_day_of_week_check" CHECK ("day_of_week" BETWEEN 1 AND 7),
    CONSTRAINT "branch_schedule_interval_check" CHECK ("opens_at" < "closes_at")
);

CREATE UNIQUE INDEX "branch_schedule_branch_id_day_of_week_opens_at_key" ON "branch_schedule"("branch_id", "day_of_week", "opens_at");

CREATE INDEX "branch_schedule_branch_id_idx" ON "branch_schedule"("branch_id");

ALTER TABLE "branch_schedule" ADD CONSTRAINT "branch_schedule_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
