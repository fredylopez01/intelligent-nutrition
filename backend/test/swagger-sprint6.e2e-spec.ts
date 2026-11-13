import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";

type Operation = {
  summary?: string;
  tags?: string[];
  security?: unknown[];
  responses: Record<string, unknown>;
};

const SPRINT_6_OPERATIONS: [string, string, string][] = [
  ["Promotions", "post", "/api/v1/promotions"],
  ["Promotions", "get", "/api/v1/promotions"],
  ["Promotions", "get", "/api/v1/promotions/active"],
  ["Promotions", "get", "/api/v1/promotions/applicable"],
  ["Promotions", "get", "/api/v1/promotions/{promotionId}"],
  ["Promotions", "patch", "/api/v1/promotions/{promotionId}"],
  ["Promotions", "patch", "/api/v1/promotions/{promotionId}/status"],
  ["Dashboard", "get", "/api/v1/dashboard/global"],
  ["Dashboard", "get", "/api/v1/dashboard/branch/{branchId}"],
  ["Reports", "get", "/api/v1/reports/sales"],
  ["Reports", "get", "/api/v1/reports/restock"],
  ["Recipes", "get", "/api/v1/recipes"],
  ["Recipes", "post", "/api/v1/recipes"],
  ["Recipes", "get", "/api/v1/recipes/{recipeId}"],
  ["Recipes", "patch", "/api/v1/recipes/{recipeId}"],
  ["Recipes", "patch", "/api/v1/recipes/{recipeId}/status"],
  ["Supplies", "post", "/api/v1/supplies"],
  ["Supplies", "get", "/api/v1/supplies"],
  ["Supplies", "get", "/api/v1/supplies/{supplyId}"],
  ["Supplies", "patch", "/api/v1/supplies/{supplyId}"],
  ["Supplies", "patch", "/api/v1/supplies/{supplyId}/status"],
  ["Supply stock", "get", "/api/v1/supply-stock"],
  ["Supply stock", "post", "/api/v1/supply-stock/movement"],
  ["Supply stock", "patch", "/api/v1/supply-stock/minimum"],
  ["Cash shifts", "post", "/api/v1/cash-shifts"],
  ["Cash shifts", "patch", "/api/v1/cash-shifts/{shiftId}/close"],
  ["Cash shifts", "get", "/api/v1/cash-shifts"],
  ["Cash shifts", "get", "/api/v1/cash-shifts/active"],
  ["Cash shifts", "get", "/api/v1/cash-shifts/{shiftId}"],
];

const SCHEMA_PROPERTIES: Record<string, string[]> = {
  CreatePromotionDto: ["name", "discountPercentage", "startDate", "endDate"],
  UpdatePromotionDto: ["name", "discountPercentage", "startDate", "endDate"],
  UpdatePromotionStatusDto: ["active"],
  CreateRecipeDto: ["name", "description", "ingredients"],
  UpdateRecipeDto: ["name", "description", "ingredients"],
  RecipeIngredientDto: ["supplyId", "quantity", "unitOfMeasureId"],
  UpdateRecipeStatusDto: ["active"],
  CreateSupplyDto: ["name", "unitOfMeasureId"],
  UpdateSupplyDto: ["name", "unitOfMeasureId"],
  UpdateSupplyStatusDto: ["active"],
  CreateSupplyStockMovementDto: [
    "branchId",
    "supplyId",
    "movementType",
    "quantity",
    "observation",
  ],
  UpdateSupplyMinimumDto: ["branchId", "supplyId", "minimumQuantity"],
  OpenCashShiftDto: ["branchId", "openingAmount", "observation"],
  CloseCashShiftDto: ["closingAmount", "observation"],
};

describe("Swagger documentation of the Sprint 6 modules (e2e)", () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Intelligent Nutrition API").build(),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(SPRINT_6_OPERATIONS)(
    "documents %s %s %s with its summary, token and responses",
    (tag, method, path) => {
      const operation = (
        document.paths[path] as Record<string, Operation> | undefined
      )?.[method];

      expect(operation).toBeDefined();
      expect(operation?.tags).toEqual([tag]);
      expect(operation?.summary).toEqual(expect.any(String));
      expect(operation?.security).toEqual([{ bearer: [] }]);
      expect(Object.keys(operation?.responses ?? {})).toEqual(
        expect.arrayContaining(["401"]),
      );
    },
  );

  it.each(Object.entries(SCHEMA_PROPERTIES))(
    "documents every property of %s",
    (schemaName, properties) => {
      const schema = document.components?.schemas?.[schemaName] as
        { properties?: Record<string, unknown> } | undefined;

      expect(Object.keys(schema?.properties ?? {}).sort()).toEqual(
        [...properties].sort(),
      );
    },
  );

  it("documents the query parameters of the paginated lists", () => {
    const parameters = (
      document.paths["/api/v1/supply-stock"] as Record<
        string,
        { parameters: { name: string; in: string }[] }
      >
    ).get.parameters.map((parameter) => `${parameter.in}:${parameter.name}`);

    expect(parameters).toEqual(
      expect.arrayContaining([
        "query:branchId",
        "query:search",
        "query:lowStock",
        "query:page",
        "query:limit",
      ]),
    );
  });
});
