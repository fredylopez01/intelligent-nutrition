import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import {
  startOfBusinessDay,
  startOfBusinessMonth,
} from "../../common/utils/business-day.util.js";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getBranchDashboard(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException({
        code: "BRANCH_NOT_FOUND",
        message: "Branch not found.",
      });
    }

    const now = new Date();
    const dayStart = startOfBusinessDay(now);
    const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const monthStart = startOfBusinessMonth(now);
    const completedTodayWhere = {
      branchId,
      status: "COMPLETED" as const,
      saleAt: { gte: dayStart, lt: nextDayStart },
    };

    const [todaySales, todayCustomers, inventory, monthlySales] =
      await Promise.all([
        this.prisma.sale.aggregate({
          where: completedTodayWhere,
          _count: { _all: true },
          _sum: { total: true },
        }),
        this.prisma.sale.findMany({
          where: {
            ...completedTodayWhere,
            customerId: { not: null },
          },
          distinct: ["customerId"],
          select: { customerId: true },
        }),
        this.prisma.branchInventory.findMany({
          where: { branchId },
          select: { productId: true, quantity: true },
        }),
        this.prisma.sale.aggregate({
          where: {
            branchId,
            status: "COMPLETED",
            saleAt: { gte: monthStart, lte: now },
          },
          _sum: { total: true },
        }),
      ]);

    const quantitiesByProduct = new Map<string, number>();
    for (const row of inventory) {
      quantitiesByProduct.set(
        row.productId,
        (quantitiesByProduct.get(row.productId) ?? 0) + row.quantity,
      );
    }

    return {
      salesToday: {
        count: todaySales._count._all,
        totalAmount: Number(todaySales._sum.total ?? 0),
      },
      uniqueCustomersToday: todayCustomers.length,
      criticalStockProducts: [...quantitiesByProduct.values()].filter(
        (quantity) => quantity < 5,
      ).length,
      monthlyRevenue: Number(monthlySales._sum.total ?? 0),
    };
  }
}
