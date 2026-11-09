import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client.js";
import { businessDayBounds } from "../../common/utils/business-day.util.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import { ListSalesReportQueryDto } from "./dto/list-sales-report-query.dto.js";

interface SalesReportGroup {
  day: string;
  branchId: string;
  branchName: string;
  salesCount: number;
  totalAmount: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(
    query: ListSalesReportQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    const { from, to, branchId, page, limit } = query;

    if (from && to && from > to) {
      throw new BadRequestException({
        code: "INVALID_DATE_RANGE",
        message: "from must be earlier than or equal to to.",
      });
    }

    if (currentUser.role.name === "BRANCH_LEADER") {
      const assignedBranchIds = new Set(
        (currentUser.branches ?? []).map((branch) => branch.id),
      );
      if (!branchId || !assignedBranchIds.has(branchId)) {
        throw new ForbiddenException({
          code: "BRANCH_SCOPE_VIOLATION",
          message: "You do not have access to this branch.",
          details: branchId ? { branchId } : {},
        });
      }
    }

    const filters: Prisma.Sql[] = [Prisma.sql`s.status = 'COMPLETED'`];
    if (branchId) {
      filters.push(Prisma.sql`s.branch_id = ${branchId}::uuid`);
    }
    if (from) {
      filters.push(Prisma.sql`s.sale_at >= ${businessDayBounds(from).start}`);
    }
    if (to) {
      const toExclusive = new Date(businessDayBounds(to).end.getTime() + 1);
      filters.push(Prisma.sql`s.sale_at < ${toExclusive}`);
    }

    const groupedSales = Prisma.sql`
      SELECT
        TO_CHAR(s.sale_at - INTERVAL '5 hours', 'YYYY-MM-DD') AS day,
        b.id AS "branchId",
        b.name AS "branchName",
        COUNT(*)::int AS "salesCount",
        SUM(s.total)::text AS "totalAmount"
      FROM sale s
      INNER JOIN branch b ON b.id = s.branch_id
      WHERE ${Prisma.join(filters, " AND ")}
      GROUP BY
        TO_CHAR(s.sale_at - INTERVAL '5 hours', 'YYYY-MM-DD'),
        b.id,
        b.name
    `;
    const skip = (page - 1) * limit;

    const [countRows, groups] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COUNT(*)::int AS total
        FROM (${groupedSales}) AS grouped_sales
      `,
      this.prisma.$queryRaw<SalesReportGroup[]>`
        SELECT *
        FROM (${groupedSales}) AS grouped_sales
        ORDER BY day DESC, "branchName" ASC
        LIMIT ${limit}
        OFFSET ${skip}
      `,
    ]);

    const total = countRows[0]?.total ?? 0;
    return {
      data: groups.map((group) => ({
        day: group.day,
        branch: { id: group.branchId, name: group.branchName },
        salesCount: group.salesCount,
        totalAmount: group.totalAmount,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}
