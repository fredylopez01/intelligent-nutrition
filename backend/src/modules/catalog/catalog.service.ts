import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import { startOfTodayUtc } from "../../common/utils/expiration.util.js";
import { normalizeSearchTerm } from "../../common/utils/search.util.js";
import {
  CatalogSort,
  ListCatalogProductsQueryDto,
} from "./dto/list-catalog-products-query.dto.js";

function availableLot(today: Date) {
  return { quantity: { gt: 0 }, expirationDate: { gte: today } };
}

function availableWhere(today: Date): Prisma.ProductWhereInput {
  return {
    active: true,
    category: { active: true },
    OR: [
      {
        inventories: {
          some: { ...availableLot(today), branch: { active: true } },
        },
      },
      { generalStock: { some: availableLot(today) } },
    ],
  };
}

function productSelect(today: Date) {
  return {
    id: true,
    name: true,
    referenceCode: true,
    description: true,
    price: true,
    category: { select: { id: true, name: true } },
    images: {
      orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
      select: { url: true },
    },
    inventories: {
      where: { ...availableLot(today), branch: { active: true } },
      select: {
        quantity: true,
        branch: { select: { id: true, name: true } },
      },
    },
    generalStock: {
      where: availableLot(today),
      select: { quantity: true },
    },
  } satisfies Prisma.ProductSelect;
}

type ProductRow = Prisma.ProductGetPayload<{
  select: ReturnType<typeof productSelect>;
}>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private toItem(product: ProductRow) {
    const branches = new Map<
      string,
      { branchId: string; name: string; quantity: number }
    >();
    for (const lot of product.inventories) {
      const current = branches.get(lot.branch.id) ?? {
        branchId: lot.branch.id,
        name: lot.branch.name,
        quantity: 0,
      };
      current.quantity += lot.quantity;
      branches.set(lot.branch.id, current);
    }
    const availability = [...branches.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    );
    return {
      productId: product.id,
      name: product.name,
      referenceCode: product.referenceCode,
      category: product.category,
      price: product.price.toFixed(2),
      imageUrl: product.images[0]?.url ?? null,
      branchUnits: availability.reduce((sum, item) => sum + item.quantity, 0),
      availableInWarehouse: product.generalStock.some(
        (lot) => lot.quantity > 0,
      ),
      branches: availability,
    };
  }

  async listProducts(query: ListCatalogProductsQueryDto) {
    const { page, limit, search, categoryId, branchId, sort } = query;
    if (search !== undefined && search.trim().length < 2) {
      throw new BadRequestException({
        code: "SEARCH_TOO_SHORT",
        message: "Search must contain at least 2 characters.",
        details: { minLength: 2 },
      });
    }
    const today = startOfTodayUtc();
    const where: Prisma.ProductWhereInput = {
      ...availableWhere(today),
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? { searchText: { contains: normalizeSearchTerm(search) } }
        : {}),
      ...(branchId
        ? {
            inventories: {
              some: {
                ...availableLot(today),
                branchId,
                branch: { active: true },
              },
            },
          }
        : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      sort === CatalogSort.PRICE_ASC
        ? [{ price: "asc" }, { name: "asc" }]
        : sort === CatalogSort.PRICE_DESC
          ? [{ price: "desc" }, { name: "asc" }]
          : [{ name: "asc" }];

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: productSelect(today),
      }),
    ]);

    return {
      data: products.map((product) => this.toItem(product)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listCategories() {
    const today = startOfTodayUtc();
    const categories = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: { products: { where: availableWhere(today) } },
        },
      },
    });
    return categories.map((category) => ({
      categoryId: category.id,
      name: category.name,
      productCount: category._count.products,
    }));
  }

  async getProduct(productId: string) {
    const today = startOfTodayUtc();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...availableWhere(today) },
      select: productSelect(today),
    });
    if (!product) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found in the catalog.",
      });
    }
    return {
      ...this.toItem(product),
      description: product.description,
      images: product.images.map((image) => image.url),
    };
  }
}
