CREATE TABLE "recipe" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_ingredient" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "supply_id" UUID NOT NULL,
    "quantity" DECIMAL(12, 3) NOT NULL,
    "unit_of_measure_id" UUID NOT NULL,

    CONSTRAINT "recipe_ingredient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recipe_ingredient_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "recipe_name_key"
    ON "recipe"("name");

CREATE INDEX "recipe_active_name_idx"
    ON "recipe"("active", "name");

CREATE UNIQUE INDEX "recipe_ingredient_recipe_id_supply_id_key"
    ON "recipe_ingredient"("recipe_id", "supply_id");

CREATE INDEX "recipe_ingredient_supply_id_idx"
    ON "recipe_ingredient"("supply_id");

CREATE INDEX "recipe_ingredient_unit_of_measure_id_idx"
    ON "recipe_ingredient"("unit_of_measure_id");

ALTER TABLE "recipe"
    ADD CONSTRAINT "recipe_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "user_account"("person_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recipe_ingredient"
    ADD CONSTRAINT "recipe_ingredient_recipe_id_fkey"
    FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "recipe_ingredient_supply_id_fkey"
    FOREIGN KEY ("supply_id") REFERENCES "supply"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "recipe_ingredient_unit_of_measure_id_fkey"
    FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
