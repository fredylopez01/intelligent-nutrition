import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CreateRecipeDto } from "./dto/create-recipe.dto.js";
import { hasDuplicateSupplies } from "./dto/recipe-ingredient.dto.js";
import { ListRecipesQueryDto } from "./dto/list-recipes-query.dto.js";
import { UpdateRecipeDto } from "./dto/update-recipe.dto.js";

const recipeProductSelect = {
  select: { id: true, name: true, referenceCode: true, price: true },
} as const;

const recipeDetailSelect = {
  id: true,
  name: true,
  description: true,
  active: true,
  product: recipeProductSelect,
  createdAt: true,
  updatedAt: true,
  ingredients: {
    orderBy: { supply: { name: "asc" } },
    select: {
      id: true,
      quantity: true,
      supply: {
        select: {
          id: true,
          name: true,
          unitOfMeasure: { select: { id: true, abreviation: true } },
        },
      },
      unitOfMeasure: { select: { id: true, abreviation: true } },
    },
  },
} satisfies Prisma.RecipeSelect;

const recipeListSelect = {
  id: true,
  name: true,
  description: true,
  active: true,
  product: recipeProductSelect,
  createdAt: true,
  _count: { select: { ingredients: true } },
} satisfies Prisma.RecipeSelect;

type RecipeDetail = Prisma.RecipeGetPayload<{
  select: typeof recipeDetailSelect;
}>;

function recipeNameAlreadyExists() {
  return new ConflictException({
    code: "RECIPE_NAME_ALREADY_EXISTS",
    message: "A recipe with this name already exists.",
    details: {},
  });
}

function recipeNotFound() {
  return new NotFoundException({
    code: "NOT_FOUND",
    message: "Recipe not found.",
    details: {},
  });
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === code
  );
}

function formatProduct(product: RecipeDetail["product"]) {
  return product
    ? {
        id: product.id,
        name: product.name,
        referenceCode: product.referenceCode,
        price: product.price.toFixed(2),
      }
    : null;
}

function formatRecipe(recipe: RecipeDetail) {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    active: recipe.active,
    product: formatProduct(recipe.product),
    ingredients: recipe.ingredients.map((ingredient) => ({
      id: ingredient.id,
      supply: {
        id: ingredient.supply.id,
        name: ingredient.supply.name,
        unitOfMeasure: {
          id: ingredient.supply.unitOfMeasure.id,
          abbreviation: ingredient.supply.unitOfMeasure.abreviation,
        },
      },
      quantity: ingredient.quantity.toFixed(3),
      unitOfMeasure: {
        id: ingredient.unitOfMeasure.id,
        abbreviation: ingredient.unitOfMeasure.abreviation,
      },
    })),
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private assertUniqueSupplies(
    ingredients:
      CreateRecipeDto["ingredients"] | UpdateRecipeDto["ingredients"],
  ) {
    if (hasDuplicateSupplies(ingredients)) {
      throw new UnprocessableEntityException({
        code: "DUPLICATED_SUPPLY",
        message: "A supply can only appear once in a recipe.",
        details: {},
      });
    }
  }

  private async validateIngredients(
    tx: Prisma.TransactionClient,
    ingredients: CreateRecipeDto["ingredients"],
  ) {
    this.assertUniqueSupplies(ingredients);

    const supplyIds = [...new Set(ingredients.map(({ supplyId }) => supplyId))];
    const unitOfMeasureIds = [
      ...new Set(ingredients.map(({ unitOfMeasureId }) => unitOfMeasureId)),
    ];
    const [supplies, units] = await Promise.all([
      tx.supply.findMany({
        where: { id: { in: supplyIds } },
        select: { id: true, name: true, active: true },
      }),
      tx.unitMeasure.findMany({
        where: { id: { in: unitOfMeasureIds } },
        select: { id: true, active: true },
      }),
    ]);

    const supplyMap = new Map(supplies.map((supply) => [supply.id, supply]));
    for (const supplyId of supplyIds) {
      const supply = supplyMap.get(supplyId);
      if (!supply) {
        throw new NotFoundException({
          code: "SUPPLY_NOT_FOUND",
          message: "A selected supply does not exist.",
          details: { supplyId },
        });
      }
      if (!supply.active) {
        throw new UnprocessableEntityException({
          code: "SUPPLY_INACTIVE",
          message: `Supply "${supply.name}" is inactive.`,
          details: { supplyId },
        });
      }
    }

    const unitMap = new Map(units.map((unit) => [unit.id, unit]));
    for (const unitOfMeasureId of unitOfMeasureIds) {
      const unit = unitMap.get(unitOfMeasureId);
      if (!unit) {
        throw new NotFoundException({
          code: "UNIT_NOT_FOUND",
          message: "A selected unit of measure does not exist.",
          details: { unitOfMeasureId },
        });
      }
      if (!unit.active) {
        throw new UnprocessableEntityException({
          code: "UNIT_INACTIVE",
          message: "The selected unit of measure is inactive.",
          details: { unitOfMeasureId },
        });
      }
    }
  }

  private async assertProduct(
    tx: Prisma.TransactionClient,
    productId: string,
    recipeId?: string,
  ) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        active: true,
        recipe: { select: { id: true, name: true } },
        derivedSupply: { select: { id: true, name: true } },
      },
    });
    if (!product) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "The selected product does not exist.",
        details: { productId },
      });
    }
    if (!product.active) {
      throw new UnprocessableEntityException({
        code: "PRODUCT_INACTIVE",
        message: `Product "${product.name}" is inactive.`,
        details: { productId },
      });
    }
    if (product.recipe && product.recipe.id !== recipeId) {
      throw new ConflictException({
        code: "PRODUCT_ALREADY_HAS_RECIPE",
        message: `Product "${product.name}" is already prepared with the recipe "${product.recipe.name}".`,
        details: { productId, recipeId: product.recipe.id },
      });
    }
    if (product.derivedSupply) {
      throw new UnprocessableEntityException({
        code: "PRODUCT_IS_SUPPLY_SOURCE",
        message: `Product "${product.name}" is sold by lots and feeds the supply "${product.derivedSupply.name}", so it cannot be prepared with a recipe.`,
        details: {
          productId,
          supplyId: product.derivedSupply.id,
          supplyName: product.derivedSupply.name,
        },
      });
    }
  }

  async create(
    dto: CreateRecipeDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    this.assertUniqueSupplies(dto.ingredients);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.validateIngredients(tx, dto.ingredients);
        if (dto.productId) {
          await this.assertProduct(tx, dto.productId);
        }

        const existing = await tx.recipe.findFirst({
          where: { name: { equals: dto.name, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) {
          throw recipeNameAlreadyExists();
        }

        const recipe = await tx.recipe.create({
          data: {
            name: dto.name,
            description: dto.description ?? null,
            productId: dto.productId ?? null,
            createdById: currentUser.id,
            ingredients: {
              create: dto.ingredients.map((ingredient) => ({
                supplyId: ingredient.supplyId,
                quantity: new Prisma.Decimal(ingredient.quantity),
                unitOfMeasureId: ingredient.unitOfMeasureId,
              })),
            },
          },
          select: recipeDetailSelect,
        });
        const response = formatRecipe(recipe);

        await this.auditService.createAuditLog(
          {
            userId: currentUser.id,
            action: "CREATE",
            entity: "RECIPE",
            entityId: recipe.id,
            newData: response,
            reason: `Created recipe ${recipe.name}`,
            ipAddress,
          },
          tx,
        );

        return response;
      });
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        throw recipeNameAlreadyExists();
      }
      throw error;
    }
  }

  async findAll(query: ListRecipesQueryDto) {
    const { page, limit, search, active, sortBy, sortOrder } = query;
    if (search !== undefined && search.length < 2) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Search must contain at least 2 characters.",
        details: { minLength: 2 },
      });
    }

    const where: Prisma.RecipeWhereInput = {
      ...(active === undefined ? {} : { active }),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [total, recipes] = await this.prisma.$transaction([
      this.prisma.recipe.count({ where }),
      this.prisma.recipe.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: recipeListSelect,
      }),
    ]);

    return {
      data: recipes.map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        active: recipe.active,
        product: formatProduct(recipe.product),
        ingredientsCount: recipe._count.ingredients,
        createdAt: recipe.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(recipeId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: recipeDetailSelect,
    });
    if (!recipe) {
      throw recipeNotFound();
    }

    return formatRecipe(recipe);
  }

  async update(
    recipeId: string,
    dto: UpdateRecipeDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "At least one field must be provided.",
        details: {},
      });
    }

    if (dto.ingredients) {
      this.assertUniqueSupplies(dto.ingredients);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.recipe.findUnique({
          where: { id: recipeId },
          select: recipeDetailSelect,
        });
        if (!existing) {
          throw recipeNotFound();
        }

        if (dto.ingredients) {
          await this.validateIngredients(tx, dto.ingredients);
        }
        if (dto.productId) {
          await this.assertProduct(tx, dto.productId, recipeId);
        }

        if (dto.name !== undefined && dto.name !== existing.name) {
          const conflictingRecipe = await tx.recipe.findFirst({
            where: {
              name: { equals: dto.name, mode: "insensitive" },
              id: { not: recipeId },
            },
            select: { id: true },
          });
          if (conflictingRecipe) {
            throw recipeNameAlreadyExists();
          }
        }

        await tx.recipe.update({
          where: { id: recipeId },
          data: {
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.description === undefined
              ? {}
              : { description: dto.description }),
            ...(dto.productId === undefined
              ? {}
              : { productId: dto.productId }),
            ...(dto.ingredients === undefined
              ? {}
              : {
                  ingredients: {
                    deleteMany: {},
                    create: dto.ingredients.map((ingredient) => ({
                      supplyId: ingredient.supplyId,
                      quantity: new Prisma.Decimal(ingredient.quantity),
                      unitOfMeasureId: ingredient.unitOfMeasureId,
                    })),
                  },
                }),
          },
        });

        const updated = await tx.recipe.findUniqueOrThrow({
          where: { id: recipeId },
          select: recipeDetailSelect,
        });
        const response = formatRecipe(updated);

        await this.auditService.createAuditLog(
          {
            userId: currentUser.id,
            action: "UPDATE",
            entity: "RECIPE",
            entityId: recipeId,
            oldData: formatRecipe(existing),
            newData: response,
            reason: `Updated recipe ${updated.name}`,
            ipAddress,
          },
          tx,
        );

        return response;
      });
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        throw recipeNameAlreadyExists();
      }
      throw error;
    }
  }

  async updateStatus(
    recipeId: string,
    active: boolean,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.recipe.findUnique({
        where: { id: recipeId },
        select: { name: true, active: true },
      });
      if (!existing) {
        throw recipeNotFound();
      }
      if (existing.active === active) {
        throw new ConflictException({
          code: "ALREADY_IN_STATE",
          message: "Recipe is already in the requested state.",
          details: {},
        });
      }

      await tx.recipe.update({
        where: { id: recipeId },
        data: { active },
      });

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: active ? "ACTIVATE" : "DEACTIVATE",
          entity: "RECIPE",
          entityId: recipeId,
          oldData: { active: existing.active },
          newData: { active },
          reason: `${active ? "Activated" : "Deactivated"} recipe ${existing.name}`,
          ipAddress,
        },
        tx,
      );

      return { message: "Recipe status updated successfully." };
    });
  }
}
