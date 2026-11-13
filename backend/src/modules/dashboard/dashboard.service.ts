import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import {
  businessDate,
  startOfBusinessDay,
  startOfBusinessMonth,
} from "../../common/utils/business-day.util.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const CRITICAL_STOCK_THRESHOLD = 5;
const HISTORY_DAYS = 7;
const EXPIRATION_WINDOW_DAYS = 60;
const TOP_CATEGORIES = 3;
const TOP_PRODUCTS = 5;
const MAX_ALERTS = 5;

export type DashboardAlertType =
  "OUT_OF_STOCK" | "LAST_UNIT" | "BELOW_MINIMUM" | "EXPIRING";

const ALERT_SEVERITY: Record<DashboardAlertType, number> = {
  OUT_OF_STOCK: 0,
  LAST_UNIT: 1,
  BELOW_MINIMUM: 2,
  EXPIRING: 3,
};

export interface ScopeBranch {
  id: string;
  name: string;
}

export interface DashboardAlert {
  type: DashboardAlertType;
  productId: string;
  productName: string;
  referenceCode: string;
  quantity: number;
  branches: ScopeBranch[];
  expirationDate: string | null;
}

function dayKey(date: Date): string {
  return businessDate(date).toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getBranchDashboard(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true },
    });

    if (!branch) {
      throw new NotFoundException({
        code: "BRANCH_NOT_FOUND",
        message: "Branch not found.",
      });
    }

    const overview = await this.buildOverview([branch]);
    return { branch: { id: branch.id, name: branch.name }, ...overview };
  }

  async getGlobalDashboard() {
    const branches = await this.prisma.branch.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    const overview = await this.buildOverview(branches);
    const topBranch = [...overview.branches.items].sort(
      (a, b) => b.salesToday - a.salesToday,
    )[0];

    return {
      branch: null,
      ...overview,
      totalSalesToday: overview.salesToday.totalAmount.toFixed(2),
      totalSalesCount: overview.salesToday.count,
      branchesActive: branches.length,
      lowStockAlerts: overview.alerts.lowStockProducts,
      topBranch:
        topBranch && topBranch.salesToday > 0
          ? {
              branchId: topBranch.branchId,
              name: topBranch.name,
              total: topBranch.salesToday.toFixed(2),
            }
          : null,
    };
  }

  private async buildOverview(branches: ScopeBranch[]) {
    const branchIds = branches.map((branch) => branch.id);
    const now = new Date();
    const dayStart = startOfBusinessDay(now);
    const historyStart = new Date(
      dayStart.getTime() - (HISTORY_DAYS - 1) * DAY_MS,
    );
    const yesterdayStart = new Date(dayStart.getTime() - DAY_MS);
    const yesterdayUntilNow = new Date(now.getTime() - DAY_MS);
    const monthStart = startOfBusinessMonth(now);
    const completed = {
      branchId: { in: branchIds },
      status: "COMPLETED" as const,
    };

    const [recentSales, monthlySales, topGroups, inventory, openShifts] =
      await Promise.all([
        this.prisma.sale.findMany({
          where: { ...completed, saleAt: { gte: historyStart, lte: now } },
          select: {
            branchId: true,
            customerId: true,
            saleAt: true,
            total: true,
          },
        }),
        this.prisma.sale.aggregate({
          where: { ...completed, saleAt: { gte: monthStart, lte: now } },
          _sum: { total: true },
        }),
        this.prisma.saleDetail.groupBy({
          by: ["productId"],
          where: {
            sale: { ...completed, saleAt: { gte: dayStart, lte: now } },
          },
          _sum: { quantity: true, total: true },
        }),
        this.prisma.branchInventory.findMany({
          where: { branchId: { in: branchIds }, product: { active: true } },
          select: {
            branchId: true,
            productId: true,
            quantity: true,
            minimumStock: true,
            expirationDate: true,
            product: {
              select: {
                name: true,
                referenceCode: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        }),
        this.prisma.cashShift.findMany({
          where: { branchId: { in: branchIds }, status: "OPEN" },
          distinct: ["branchId"],
          select: { branchId: true },
        }),
      ]);

    const todayKey = dayKey(now);
    const days = Array.from({ length: HISTORY_DAYS }, (_, index) =>
      dayKey(new Date(historyStart.getTime() + index * DAY_MS + DAY_MS / 2)),
    );
    const totalsByDay = new Map(days.map((day) => [day, 0]));
    const salesByBranch = new Map(branchIds.map((id) => [id, 0]));
    const customers = new Set<string>();
    let todayCount = 0;
    let todayTotal = 0;
    let yesterdayTotal = 0;

    for (const sale of recentSales) {
      const total = Number(sale.total);
      const key = dayKey(sale.saleAt);
      totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + total);
      if (sale.saleAt >= dayStart) {
        todayCount += 1;
        todayTotal += total;
        salesByBranch.set(
          sale.branchId,
          (salesByBranch.get(sale.branchId) ?? 0) + total,
        );
        if (sale.customerId) customers.add(sale.customerId);
      } else if (
        sale.saleAt >= yesterdayStart &&
        sale.saleAt <= yesterdayUntilNow
      ) {
        yesterdayTotal += total;
      }
    }

    const openBranchIds = new Set(openShifts.map((shift) => shift.branchId));
    const branchNames = new Map(
      branches.map((branch) => [branch.id, branch.name]),
    );

    return {
      date: todayKey,
      salesToday: { count: todayCount, totalAmount: round2(todayTotal) },
      salesYesterdayUntilNow: round2(yesterdayTotal),
      salesLast7Days: days.map((day) => ({
        date: day,
        totalAmount: round2(totalsByDay.get(day) ?? 0),
      })),
      uniqueCustomersToday: customers.size,
      monthlyRevenue: Number(monthlySales._sum.total ?? 0),
      ...this.summarizeInventory(inventory, branchNames, now),
      branches: {
        active: branches.length,
        open: branchIds.filter((id) => openBranchIds.has(id)).length,
        items: branches.map((branch) => ({
          branchId: branch.id,
          name: branch.name,
          open: openBranchIds.has(branch.id),
          salesToday: round2(salesByBranch.get(branch.id) ?? 0),
        })),
      },
      topProducts: await this.topProducts(topGroups),
    };
  }

  private summarizeInventory(
    inventory: {
      branchId: string;
      productId: string;
      quantity: number;
      minimumStock: number;
      expirationDate: Date;
      product: {
        name: string;
        referenceCode: string;
        category: { id: string; name: string };
      };
    }[],
    branchNames: Map<string, string>,
    now: Date,
  ) {
    const categories = new Map<string, { name: string; units: number }>();
    const products = new Map<
      string,
      {
        name: string;
        referenceCode: string;
        total: number;
        perBranch: Map<string, { quantity: number; minimum: number }>;
        expiring: { branchId: string; date: Date; quantity: number }[];
      }
    >();
    const expirationLimit = new Date(
      startOfBusinessDay(now).getTime() + EXPIRATION_WINDOW_DAYS * DAY_MS,
    );
    let totalUnits = 0;

    for (const row of inventory) {
      totalUnits += row.quantity;
      const category = categories.get(row.product.category.id) ?? {
        name: row.product.category.name,
        units: 0,
      };
      category.units += row.quantity;
      categories.set(row.product.category.id, category);

      const product = products.get(row.productId) ?? {
        name: row.product.name,
        referenceCode: row.product.referenceCode,
        total: 0,
        perBranch: new Map<string, { quantity: number; minimum: number }>(),
        expiring: [] as { branchId: string; date: Date; quantity: number }[],
      };
      product.total += row.quantity;
      const branch = product.perBranch.get(row.branchId) ?? {
        quantity: 0,
        minimum: 0,
      };
      branch.quantity += row.quantity;
      branch.minimum = Math.max(branch.minimum, row.minimumStock);
      product.perBranch.set(row.branchId, branch);
      if (
        row.quantity > 0 &&
        row.expirationDate >= startOfBusinessDay(now) &&
        row.expirationDate <= expirationLimit
      ) {
        product.expiring.push({
          branchId: row.branchId,
          date: row.expirationDate,
          quantity: row.quantity,
        });
      }
      products.set(row.productId, product);
    }

    const toBranches = (ids: string[]): ScopeBranch[] =>
      ids.map((id) => ({ id, name: branchNames.get(id) ?? "" }));
    const alerts: DashboardAlert[] = [];
    let criticalStockProducts = 0;
    let lowStockProducts = 0;

    for (const [productId, product] of products) {
      if (product.total < CRITICAL_STOCK_THRESHOLD) criticalStockProducts += 1;
      const entries = [...product.perBranch.entries()];
      const out = entries.filter(([, value]) => value.quantity === 0);
      const last = entries.filter(([, value]) => value.quantity === 1);
      const below = entries.filter(
        ([, value]) => value.minimum > 0 && value.quantity < value.minimum,
      );
      if (below.length > 0) lowStockProducts += 1;
      const base = {
        productId,
        productName: product.name,
        referenceCode: product.referenceCode,
      };

      if (out.length > 0) {
        alerts.push({
          ...base,
          type: "OUT_OF_STOCK",
          quantity: 0,
          branches: toBranches(out.map(([id]) => id)),
          expirationDate: null,
        });
      } else if (last.length > 0) {
        alerts.push({
          ...base,
          type: "LAST_UNIT",
          quantity: 1,
          branches: toBranches(last.map(([id]) => id)),
          expirationDate: null,
        });
      } else if (below.length > 0) {
        alerts.push({
          ...base,
          type: "BELOW_MINIMUM",
          quantity: below.reduce((sum, [, value]) => sum + value.quantity, 0),
          branches: toBranches(below.map(([id]) => id)),
          expirationDate: null,
        });
      } else if (product.expiring.length > 0) {
        const soonest = [...product.expiring].sort(
          (a, b) => a.date.getTime() - b.date.getTime(),
        )[0];
        alerts.push({
          ...base,
          type: "EXPIRING",
          quantity: soonest.quantity,
          branches: toBranches([soonest.branchId]),
          expirationDate: soonest.date.toISOString().slice(0, 10),
        });
      }
    }

    alerts.sort(
      (a, b) =>
        ALERT_SEVERITY[a.type] - ALERT_SEVERITY[b.type] ||
        a.quantity - b.quantity ||
        a.productName.localeCompare(b.productName, "es"),
    );

    return {
      criticalStockProducts,
      stock: {
        totalUnits,
        byCategory: [...categories.entries()]
          .map(([categoryId, value]) => ({
            categoryId,
            name: value.name,
            units: value.units,
          }))
          .sort((a, b) => b.units - a.units)
          .slice(0, TOP_CATEGORIES),
      },
      alerts: {
        total: alerts.length,
        lowStockProducts,
        items: alerts.slice(0, MAX_ALERTS),
      },
    };
  }

  private async topProducts(
    groups: {
      productId: string;
      _sum: { quantity: number | null; total: unknown };
    }[],
  ) {
    const ranked = groups
      .map((group) => ({
        productId: group.productId,
        quantity: group._sum.quantity ?? 0,
        total: Number(group._sum.total ?? 0),
      }))
      .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
      .slice(0, TOP_PRODUCTS);
    if (ranked.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: ranked.map((item) => item.productId) } },
      select: { id: true, name: true, referenceCode: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return ranked.map((item) => ({
      productId: item.productId,
      name: byId.get(item.productId)?.name ?? "",
      referenceCode: byId.get(item.productId)?.referenceCode ?? "",
      quantity: item.quantity,
      total: round2(item.total),
    }));
  }
}
