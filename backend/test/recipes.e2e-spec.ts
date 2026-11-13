import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

const ROLES = [
  "SUPERADMIN",
  "DEV",
  "BRANCH_LEADER",
  "BRANCH_ASSISTANT",
] as const;

type TestRole = (typeof ROLES)[number];

interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

interface RecipeUnit {
  id: string;
  abbreviation: string;
}

interface RecipeIngredient {
  id: string;
  supply: { id: string; name: string; unitOfMeasure: RecipeUnit };
  quantity: string;
  unitOfMeasure: RecipeUnit;
}

interface RecipeDetail {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

interface RecipeSummary {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  ingredientsCount: number;
  createdAt: string;
}

interface RecipeList {
  data: RecipeSummary[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const RECIPES_PATH = "/api/v1/recipes";
const runId = Date.now().toString(36);
const tag = runId.slice(-6);
const DOCUMENT_CODE = "CC-RECIPES-E2E";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("Recipes endpoints (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const personIds: string[] = [];
  const tokens = {} as Record<TestRole, string>;
  const unitIds: string[] = [];
  const supplyIds: string[] = [];
  const recipeIds: string[] = [];
  const units = {} as Record<"grams" | "milliliters" | "scoop", string>;
  const supplies = {} as Record<"whey" | "milk" | "oats" | "inactive", string>;
  let shake: RecipeDetail;

  const send = (
    method: "get" | "post" | "patch",
    path: string,
    token?: string,
  ) => {
    const pending = request(app.getHttpServer())[method](
      `${RECIPES_PATH}${path}`,
    );
    if (token) pending.set("Authorization", `Bearer ${token}`);
    return pending;
  };

  const recipeName = (label: string) => `E2E ${label} ${runId}`;

  const createRecipe = async (token: string, body: Record<string, unknown>) => {
    const response = await send("post", "", token).send(body);
    if (response.status === 201) {
      recipeIds.push((response.body as { data: RecipeDetail }).data.id);
    }
    return response;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const documentTypeId = (
      await prisma.documentType.upsert({
        where: { code: DOCUMENT_CODE },
        update: { active: true },
        create: { code: DOCUMENT_CODE, name: "Documento (e2e recetas)" },
      })
    ).id;

    const jwtService = app.get(JwtService);
    for (const [index, roleName] of ROLES.entries()) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: { active: true },
        create: { name: roleName },
      });
      const person = await prisma.person.create({
        data: {
          documentTypeId,
          documentNumber: `${runId}${index}`,
          firstName: roleName,
          lastName: "Recipes E2E",
          email: `${roleName.toLowerCase()}.recipes.${runId}@e2e.test`,
          phone: "3000000000",
          address: "Calle 1 # 2-3",
          userAccount: {
            create: {
              roleId: role.id,
              active: true,
              mustChangePassword: false,
            },
          },
        },
      });
      personIds.push(person.id);
      tokens[roleName] = await jwtService.signAsync({ sub: person.id });
    }

    const createdUnits = await Promise.all(
      [
        { key: "grams", name: `Gramo ${runId}`, abreviation: `g${tag}` },
        {
          key: "milliliters",
          name: `Mililitro ${runId}`,
          abreviation: `ml${tag}`,
        },
        { key: "scoop", name: `Scoop ${runId}`, abreviation: `sc${tag}` },
      ].map(async ({ key, ...data }) => ({
        key,
        id: (await prisma.unitMeasure.create({ data, select: { id: true } }))
          .id,
      })),
    );
    for (const { key, id } of createdUnits) {
      units[key as keyof typeof units] = id;
      unitIds.push(id);
    }

    const createdSupplies = await Promise.all(
      [
        { key: "whey", name: `E2E Proteína ${runId}`, unit: units.grams },
        { key: "milk", name: `E2E Leche ${runId}`, unit: units.milliliters },
        { key: "oats", name: `E2E Avena ${runId}`, unit: units.grams },
        {
          key: "inactive",
          name: `E2E Insumo inactivo ${runId}`,
          unit: units.grams,
          active: false,
        },
      ].map(async ({ key, name, unit, active }) => ({
        key,
        id: (
          await prisma.supply.create({
            data: { name, unitOfMeasureId: unit, active: active ?? true },
            select: { id: true },
          })
        ).id,
      })),
    );
    for (const { key, id } of createdSupplies) {
      supplies[key as keyof typeof supplies] = id;
      supplyIds.push(id);
    }
  });

  afterAll(async () => {
    if (prisma) {
      if (recipeIds.length > 0) {
        await prisma.recipeIngredient.deleteMany({
          where: { recipeId: { in: recipeIds } },
        });
        await prisma.recipe.deleteMany({ where: { id: { in: recipeIds } } });
      }
      if (supplyIds.length > 0) {
        await prisma.supply.deleteMany({ where: { id: { in: supplyIds } } });
      }
      if (unitIds.length > 0) {
        await prisma.unitMeasure.deleteMany({ where: { id: { in: unitIds } } });
      }
      if (personIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { userId: { in: personIds } },
        });
        await prisma.userAccount.deleteMany({
          where: { personId: { in: personIds } },
        });
        await prisma.person.deleteMany({ where: { id: { in: personIds } } });
      }
      await prisma.documentType.deleteMany({
        where: { code: DOCUMENT_CODE },
      });
      await app.close();
    }
  });

  describe("access control", () => {
    it("rejects every endpoint without a token with 401", async () => {
      const statuses = [
        (await send("get", "")).status,
        (await send("get", `/${UNKNOWN_ID}`)).status,
        (await send("post", "").send({})).status,
        (await send("patch", `/${UNKNOWN_ID}`).send({ name: "Sin token" }))
          .status,
        (await send("patch", `/${UNKNOWN_ID}/status`).send({ active: false }))
          .status,
      ];

      expect(statuses).toEqual([401, 401, 401, 401, 401]);
    });

    it("does not let DEV read the recipes", async () => {
      const list = await send("get", "", tokens.DEV);
      const detail = await send("get", `/${UNKNOWN_ID}`, tokens.DEV);

      expect(list.status).toBe(403);
      expect(detail.status).toBe(403);
    });

    it.each(["DEV", "BRANCH_ASSISTANT"] as const)(
      "does not let %s create a recipe",
      async (role) => {
        const response = await send("post", "", tokens[role]).send({
          name: recipeName(`sin permiso ${role}`),
          ingredients: [
            {
              supplyId: supplies.whey,
              quantity: 30,
              unitOfMeasureId: units.grams,
            },
          ],
        });

        expect(response.status).toBe(403);
        expect(
          await prisma.recipe.count({
            where: { name: recipeName(`sin permiso ${role}`) },
          }),
        ).toBe(0);
      },
    );
  });

  describe("POST /recipes", () => {
    it("creates a recipe with mixed supplies and units and returns its ingredients", async () => {
      const response = await createRecipe(tokens.SUPERADMIN, {
        name: recipeName("Batido"),
        description: "Batido de proteína con leche y avena",
        ingredients: [
          {
            supplyId: supplies.whey,
            quantity: 1,
            unitOfMeasureId: units.scoop,
          },
          {
            supplyId: supplies.milk,
            quantity: 250.5,
            unitOfMeasureId: units.milliliters,
          },
          {
            supplyId: supplies.oats,
            quantity: 0.125,
            unitOfMeasureId: units.grams,
          },
        ],
      });

      expect(response.status).toBe(201);
      shake = (response.body as { data: RecipeDetail }).data;
      expect(shake).toEqual({
        id: expect.any(String),
        name: recipeName("Batido"),
        description: "Batido de proteína con leche y avena",
        active: true,
        ingredients: expect.any(Array),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(shake.ingredients).toHaveLength(3);
      const bySupply = new Map(
        shake.ingredients.map((ingredient) => [
          ingredient.supply.id,
          ingredient,
        ]),
      );
      expect(bySupply.get(supplies.whey)).toEqual({
        id: expect.any(String),
        supply: {
          id: supplies.whey,
          name: `E2E Proteína ${runId}`,
          unitOfMeasure: { id: units.grams, abbreviation: `g${tag}` },
        },
        quantity: "1.000",
        unitOfMeasure: { id: units.scoop, abbreviation: `sc${tag}` },
      });
      expect(bySupply.get(supplies.milk)?.quantity).toBe("250.500");
      expect(bySupply.get(supplies.oats)?.quantity).toBe("0.125");

      const audit = await prisma.auditLog.findFirst({
        where: { entity: "RECIPE", entityId: shake.id, action: "CREATE" },
      });
      expect(audit?.userId).toBe(personIds[0]);
    });

    it("lets the branch leader create a recipe", async () => {
      const response = await createRecipe(tokens.BRANCH_LEADER, {
        name: recipeName("Avena del líder"),
        ingredients: [
          {
            supplyId: supplies.oats,
            quantity: 40,
            unitOfMeasureId: units.grams,
          },
        ],
      });

      expect(response.status).toBe(201);
      expect(
        (response.body as { data: RecipeDetail }).data.description,
      ).toBeNull();
    });

    it("requires at least one ingredient", async () => {
      const response = await createRecipe(tokens.SUPERADMIN, {
        name: recipeName("Vacía"),
        ingredients: [],
      });

      expect(response.status).toBe(400);
    });

    it("rejects a quantity that is not greater than zero", async () => {
      const response = await createRecipe(tokens.SUPERADMIN, {
        name: recipeName("Cantidad cero"),
        ingredients: [
          {
            supplyId: supplies.whey,
            quantity: 0,
            unitOfMeasureId: units.grams,
          },
        ],
      });

      expect(response.status).toBe(400);
    });

    it("rejects a repeated supply with 422 DUPLICATED_SUPPLY", async () => {
      const response = await createRecipe(tokens.SUPERADMIN, {
        name: recipeName("Repetida"),
        ingredients: [
          {
            supplyId: supplies.whey,
            quantity: 10,
            unitOfMeasureId: units.grams,
          },
          {
            supplyId: supplies.whey,
            quantity: 20,
            unitOfMeasureId: units.grams,
          },
        ],
      });

      expect(response.status).toBe(422);
      expect((response.body as ApiError).error.code).toBe("DUPLICATED_SUPPLY");
    });

    it("rejects an inactive supply with 422 SUPPLY_INACTIVE", async () => {
      const response = await createRecipe(tokens.SUPERADMIN, {
        name: recipeName("Con inactivo"),
        ingredients: [
          {
            supplyId: supplies.inactive,
            quantity: 10,
            unitOfMeasureId: units.grams,
          },
        ],
      });

      expect(response.status).toBe(422);
      expect((response.body as ApiError).error.code).toBe("SUPPLY_INACTIVE");
    });

    it("rejects a supply that does not exist with 404", async () => {
      const response = await createRecipe(tokens.SUPERADMIN, {
        name: recipeName("Insumo inexistente"),
        ingredients: [
          { supplyId: UNKNOWN_ID, quantity: 10, unitOfMeasureId: units.grams },
        ],
      });

      expect(response.status).toBe(404);
      expect((response.body as ApiError).error.code).toBe("SUPPLY_NOT_FOUND");
    });

    it("rejects a repeated name ignoring case with 409", async () => {
      const response = await createRecipe(tokens.SUPERADMIN, {
        name: recipeName("Batido").toUpperCase(),
        ingredients: [
          {
            supplyId: supplies.oats,
            quantity: 10,
            unitOfMeasureId: units.grams,
          },
        ],
      });

      expect(response.status).toBe(409);
      expect((response.body as ApiError).error.code).toBe(
        "RECIPE_NAME_ALREADY_EXISTS",
      );
    });
  });

  describe("GET /recipes", () => {
    it.each(["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const)(
      "lists the recipes with their ingredient count for %s",
      async (role) => {
        const response = await send(
          "get",
          `?search=${encodeURIComponent(runId)}&limit=100`,
          tokens[role],
        );

        expect(response.status).toBe(200);
        const body = response.body as RecipeList;
        expect(body.meta).toEqual({
          page: 1,
          limit: 100,
          total: 2,
          totalPages: 1,
        });
        const listed = body.data.find((recipe) => recipe.id === shake.id);
        expect(listed).toEqual({
          id: shake.id,
          name: recipeName("Batido"),
          description: "Batido de proteína con leche y avena",
          active: true,
          ingredientsCount: 3,
          createdAt: expect.any(String),
        });
      },
    );

    it("paginates and sorts by name", async () => {
      const response = await send(
        "get",
        `?search=${encodeURIComponent(runId)}&limit=1&page=2`,
        tokens.SUPERADMIN,
      );

      expect(response.status).toBe(200);
      const body = response.body as RecipeList;
      expect(body.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
      expect(body.data.map((recipe) => recipe.name)).toEqual([
        recipeName("Batido"),
      ]);
    });

    it("asks for at least two characters to search", async () => {
      const response = await send("get", "?search=a", tokens.SUPERADMIN);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /recipes/:recipeId", () => {
    it.each(["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const)(
      "returns the recipe with its ingredients for %s",
      async (role) => {
        const response = await send("get", `/${shake.id}`, tokens[role]);

        expect(response.status).toBe(200);
        const detail = (response.body as { data: RecipeDetail }).data;
        expect(detail.id).toBe(shake.id);
        expect(
          detail.ingredients.map((ingredient) => ingredient.supply.id).sort(),
        ).toEqual([supplies.whey, supplies.milk, supplies.oats].sort());
      },
    );

    it("answers 404 for a recipe that does not exist", async () => {
      const response = await send("get", `/${UNKNOWN_ID}`, tokens.SUPERADMIN);

      expect(response.status).toBe(404);
      expect((response.body as ApiError).error.code).toBe("NOT_FOUND");
    });

    it("answers 400 for an id that is not a UUID", async () => {
      const response = await send("get", "/not-a-uuid", tokens.SUPERADMIN);

      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /recipes/:recipeId", () => {
    it("lets the branch leader rename the recipe and keeps its ingredients", async () => {
      const response = await send(
        "patch",
        `/${shake.id}`,
        tokens.BRANCH_LEADER,
      ).send({
        name: recipeName("Batido clásico"),
      });

      expect(response.status).toBe(200);
      const detail = (response.body as { data: RecipeDetail }).data;
      expect(detail.name).toBe(recipeName("Batido clásico"));
      expect(detail.ingredients).toHaveLength(3);

      const audit = await prisma.auditLog.findFirst({
        where: { entity: "RECIPE", entityId: shake.id, action: "UPDATE" },
      });
      expect(audit?.userId).toBe(personIds[2]);
    });

    it("replaces the whole ingredient list", async () => {
      const response = await send(
        "patch",
        `/${shake.id}`,
        tokens.SUPERADMIN,
      ).send({
        ingredients: [
          {
            supplyId: supplies.milk,
            quantity: 300,
            unitOfMeasureId: units.milliliters,
          },
          {
            supplyId: supplies.whey,
            quantity: 35,
            unitOfMeasureId: units.grams,
          },
        ],
      });

      expect(response.status).toBe(200);
      const detail = (response.body as { data: RecipeDetail }).data;
      expect(
        detail.ingredients
          .map((ingredient) => [ingredient.supply.id, ingredient.quantity])
          .sort(),
      ).toEqual(
        [
          [supplies.milk, "300.000"],
          [supplies.whey, "35.000"],
        ].sort(),
      );
      expect(
        await prisma.recipeIngredient.count({ where: { recipeId: shake.id } }),
      ).toBe(2);
    });

    it("rejects the name of another recipe with 409", async () => {
      const response = await send(
        "patch",
        `/${shake.id}`,
        tokens.SUPERADMIN,
      ).send({
        name: recipeName("Avena del líder"),
      });

      expect(response.status).toBe(409);
      expect((response.body as ApiError).error.code).toBe(
        "RECIPE_NAME_ALREADY_EXISTS",
      );
    });

    it("rejects repeated supplies in the new list with 422", async () => {
      const response = await send(
        "patch",
        `/${shake.id}`,
        tokens.SUPERADMIN,
      ).send({
        ingredients: [
          {
            supplyId: supplies.oats,
            quantity: 10,
            unitOfMeasureId: units.grams,
          },
          {
            supplyId: supplies.oats,
            quantity: 15,
            unitOfMeasureId: units.grams,
          },
        ],
      });

      expect(response.status).toBe(422);
      expect((response.body as ApiError).error.code).toBe("DUPLICATED_SUPPLY");
    });

    it("does not let the branch assistant edit", async () => {
      const response = await send(
        "patch",
        `/${shake.id}`,
        tokens.BRANCH_ASSISTANT,
      ).send({ name: recipeName("Del ayudante") });

      expect(response.status).toBe(403);
    });

    it("answers 404 for a recipe that does not exist", async () => {
      const response = await send(
        "patch",
        `/${UNKNOWN_ID}`,
        tokens.SUPERADMIN,
      ).send({
        name: recipeName("Fantasma"),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /recipes/:recipeId/status", () => {
    it("lets only the superadmin change the state", async () => {
      const leader = await send(
        "patch",
        `/${shake.id}/status`,
        tokens.BRANCH_LEADER,
      ).send({ active: false });
      const superadmin = await send(
        "patch",
        `/${shake.id}/status`,
        tokens.SUPERADMIN,
      ).send({ active: false });
      const again = await send(
        "patch",
        `/${shake.id}/status`,
        tokens.SUPERADMIN,
      ).send({ active: false });

      expect(leader.status).toBe(403);
      expect(superadmin.status).toBe(200);
      expect(again.status).toBe(409);
      expect((again.body as ApiError).error.code).toBe("ALREADY_IN_STATE");
      const inactive = await send(
        "get",
        `?search=${encodeURIComponent(runId)}&active=false`,
        tokens.SUPERADMIN,
      );
      expect(
        (inactive.body as RecipeList).data.map((recipe) => recipe.id),
      ).toEqual([shake.id]);
    });
  });
});
