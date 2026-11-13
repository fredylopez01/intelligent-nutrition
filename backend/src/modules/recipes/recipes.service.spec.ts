import { jest, describe, beforeEach, it, expect } from "@jest/globals";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Prisma } from "../../../generated/prisma/client.js";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type AsyncJestMock = ReturnType<typeof jest.fn<AsyncMock>>;
type TransactionClientMock = {
  supply: { findMany: AsyncJestMock };
  unitMeasure: { findMany: AsyncJestMock };
  recipe: { findFirst: AsyncJestMock; create: AsyncJestMock };
};
type TransactionMock = (
  operation: (tx: TransactionClientMock) => Promise<unknown>,
) => Promise<unknown>;

const transactionClientMock: TransactionClientMock = {
  supply: { findMany: jest.fn<AsyncMock>() },
  unitMeasure: { findMany: jest.fn<AsyncMock>() },
  recipe: {
    findFirst: jest.fn<AsyncMock>(),
    create: jest.fn<AsyncMock>(),
  },
};

const prismaMock = {
  $transaction: jest.fn<TransactionMock>(),
};

const auditMock = {
  createAuditLog: jest.fn<AsyncMock>(),
};

jest.unstable_mockModule("../../database/prisma/prisma.service.js", () => ({
  PrismaService: jest.fn().mockImplementation(() => prismaMock),
}));

jest.unstable_mockModule("../audit/audit.service.js", () => ({
  AuditService: jest.fn().mockImplementation(() => auditMock),
}));

const { Test } = await import("@nestjs/testing");
const { UnprocessableEntityException } = await import("@nestjs/common");
const { RecipesService } = await import("./recipes.service.js");
const { RecipeIngredientDto } = await import("./dto/recipe-ingredient.dto.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");
const { AuditService } = await import("../audit/audit.service.js");

const currentUser = {
  id: "recipe-creator",
  active: true,
  role: { name: "SUPERADMIN" },
};

const proteinSupply = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Proteína en polvo",
  active: true,
};
const milkSupply = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Leche entera",
  active: true,
};
const gramUnit = {
  id: "33333333-3333-4333-8333-333333333333",
  active: true,
};
const milliliterUnit = {
  id: "44444444-4444-4444-8444-444444444444",
  active: true,
};

function buildRecipe() {
  const createdAt = new Date("2026-11-06T15:30:00.000Z");
  return {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Batido de proteína",
    description: "Batido base",
    active: true,
    createdAt,
    updatedAt: createdAt,
    ingredients: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        quantity: new Prisma.Decimal("30"),
        supply: {
          ...proteinSupply,
          unitOfMeasure: { id: gramUnit.id, abreviation: "g" },
        },
        unitOfMeasure: { id: gramUnit.id, abreviation: "g" },
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        quantity: new Prisma.Decimal("200"),
        supply: {
          ...milkSupply,
          unitOfMeasure: { id: milliliterUnit.id, abreviation: "ml" },
        },
        unitOfMeasure: { id: milliliterUnit.id, abreviation: "ml" },
      },
    ],
  };
}

describe("RecipesService.create", () => {
  let service: InstanceType<typeof RecipesService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation((operation) =>
      operation(transactionClientMock),
    );
    transactionClientMock.supply.findMany.mockImplementation(() =>
      Promise.resolve([proteinSupply, milkSupply]),
    );
    transactionClientMock.unitMeasure.findMany.mockImplementation(() =>
      Promise.resolve([gramUnit, milliliterUnit]),
    );
    transactionClientMock.recipe.findFirst.mockImplementation(() =>
      Promise.resolve(null),
    );
    transactionClientMock.recipe.create.mockImplementation(() =>
      Promise.resolve(buildRecipe()),
    );
    auditMock.createAuditLog.mockImplementation(() => Promise.resolve());

    const module = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get(RecipesService);
  });

  it("creates a recipe with multiple supply ingredients and records the audit", async () => {
    const dto = {
      name: "Batido de proteína",
      description: "Batido base",
      ingredients: [
        {
          supplyId: proteinSupply.id,
          quantity: 30,
          unitOfMeasureId: gramUnit.id,
        },
        {
          supplyId: milkSupply.id,
          quantity: 200,
          unitOfMeasureId: milliliterUnit.id,
        },
      ],
    };

    const result = await service.create(dto, currentUser, "127.0.0.1");

    expect(result).toMatchObject({
      id: "55555555-5555-4555-8555-555555555555",
      name: dto.name,
      description: dto.description,
      active: true,
      ingredients: [
        {
          supply: {
            id: proteinSupply.id,
            name: proteinSupply.name,
            unitOfMeasure: { id: gramUnit.id, abbreviation: "g" },
          },
          quantity: "30.000",
          unitOfMeasure: { id: gramUnit.id, abbreviation: "g" },
        },
        {
          supply: {
            id: milkSupply.id,
            name: milkSupply.name,
            unitOfMeasure: { id: milliliterUnit.id, abbreviation: "ml" },
          },
          quantity: "200.000",
          unitOfMeasure: { id: milliliterUnit.id, abbreviation: "ml" },
        },
      ],
    });

    expect(transactionClientMock.recipe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: dto.name,
          description: dto.description,
          createdById: currentUser.id,
          ingredients: {
            create: [
              expect.objectContaining({
                supplyId: proteinSupply.id,
                quantity: expect.any(Prisma.Decimal),
                unitOfMeasureId: gramUnit.id,
              }),
              expect.objectContaining({
                supplyId: milkSupply.id,
                quantity: expect.any(Prisma.Decimal),
                unitOfMeasureId: milliliterUnit.id,
              }),
            ],
          },
        }),
      }),
    );
    expect(auditMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: currentUser.id,
        action: "CREATE",
        entity: "RECIPE",
        entityId: "55555555-5555-4555-8555-555555555555",
      }),
      transactionClientMock,
    );
  });

  it("rejects duplicated supply ingredients", async () => {
    await expect(
      service.create(
        {
          name: "Batido repetido",
          ingredients: [
            {
              supplyId: proteinSupply.id,
              quantity: 30,
              unitOfMeasureId: gramUnit.id,
            },
            {
              supplyId: proteinSupply.id,
              quantity: 20,
              unitOfMeasureId: gramUnit.id,
            },
          ],
        },
        currentUser,
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: "DUPLICATED_SUPPLY" },
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an ingredient whose supply is inactive", async () => {
    transactionClientMock.supply.findMany.mockImplementation(() =>
      Promise.resolve([{ ...proteinSupply, active: false }]),
    );

    await expect(
      service.create(
        {
          name: "Batido con insumo inactivo",
          ingredients: [
            {
              supplyId: proteinSupply.id,
              quantity: 30,
              unitOfMeasureId: gramUnit.id,
            },
          ],
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(transactionClientMock.recipe.create).not.toHaveBeenCalled();
  });
});

describe("RecipeIngredientDto contract", () => {
  it("requires a supplyId and does not accept productId as its substitute", async () => {
    const ingredient = plainToInstance(RecipeIngredientDto, {
      productId: proteinSupply.id,
      quantity: 30,
      unitOfMeasureId: gramUnit.id,
    });

    const errors = await validate(ingredient);

    expect(errors.map(({ property }) => property)).toContain("supplyId");
  });

  it("accepts a valid supply ingredient", async () => {
    const ingredient = plainToInstance(RecipeIngredientDto, {
      supplyId: proteinSupply.id,
      quantity: 30,
      unitOfMeasureId: gramUnit.id,
    });

    await expect(validate(ingredient)).resolves.toHaveLength(0);
  });
});
