import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Prisma } from "../../../generated/prisma/client.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { businessDate } from "../../common/utils/business-day.util.js";
import { startOfTodayUtc } from "../../common/utils/expiration.util.js";
import {
  PENDING_HOLD_HOURS,
  RESERVING_STATUSES,
  reservationKey,
  reservedUnits,
} from "../../common/utils/stock-reservations.util.js";
import { AuditService } from "../audit/audit.service.js";
import { PersonsService } from "../persons/persons.service.js";
import { SalesService } from "../sales/sales.service.js";
import { CompleteOnlineOrderDto } from "./dto/complete-online-order.dto.js";
import {
  CreateOnlineOrderDto,
  OnlineOrderFulfillmentDto,
} from "./dto/create-online-order.dto.js";
import {
  ListOnlineOrdersQueryDto,
  OnlineOrderStatusDto,
} from "./dto/list-online-orders-query.dto.js";
import { OnlineOrderItemDto } from "./dto/online-order-item.dto.js";
import {
  ManualStatus,
  UpdateOnlineOrderStatusDto,
} from "./dto/update-online-order-status.dto.js";

const HOUR_MS = 60 * 60 * 1000;
const SCOPED_ROLES = new Set(["BRANCH_LEADER", "BRANCH_ASSISTANT"]);
const OPEN_STATUSES = ["PENDING", ...RESERVING_STATUSES] as const;

const TRANSITIONS: Record<string, ManualStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["READY", "OUT_FOR_DELIVERY", "CANCELLED"],
  READY: ["CANCELLED"],
  OUT_FOR_DELIVERY: ["CANCELLED"],
};

const orderSelect = {
  id: true,
  code: true,
  status: true,
  fulfillment: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  deliveryAddress: true,
  deliveryNeighborhood: true,
  notes: true,
  subtotal: true,
  expiresAt: true,
  cancelReason: true,
  confirmedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  createdAt: true,
  branch: { select: { id: true, name: true, address: true, phone: true } },
  customer: { select: { personId: true, fullName: true } },
  sale: { select: { id: true, saleNumber: true, total: true } },
  items: {
    orderBy: { product: { name: "asc" } },
    select: {
      productId: true,
      quantity: true,
      unitPrice: true,
      total: true,
      product: { select: { name: true, referenceCode: true } },
    },
  },
} satisfies Prisma.OnlineOrderSelect;

type OrderRow = Prisma.OnlineOrderGetPayload<{ select: typeof orderSelect }>;
type Tx = Prisma.TransactionClient;

export interface BranchAvailability {
  branchId: string;
  name: string;
  address: string;
  phone: string;
  deliveryEnabled: boolean;
  allAvailable: boolean;
  items: { productId: string; available: number }[];
}

function toCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

function toMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

function effectiveStatus(
  order: { status: string; expiresAt: Date },
  now: Date,
) {
  return order.status === "PENDING" && order.expiresAt <= now
    ? "EXPIRED"
    : order.status;
}

@Injectable()
export class OnlineOrdersService {
  private readonly logger = new Logger(OnlineOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly personsService: PersonsService,
    private readonly salesService: SalesService,
  ) {}

  private format(order: OrderRow, now = new Date()) {
    return {
      id: order.id,
      code: order.code,
      status: effectiveStatus(order, now),
      fulfillment: order.fulfillment,
      branch: order.branch,
      customer: {
        id: order.customer?.personId ?? null,
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        registered: order.customer !== null,
      },
      delivery:
        order.fulfillment === "DELIVERY"
          ? {
              address: order.deliveryAddress,
              neighborhood: order.deliveryNeighborhood,
            }
          : null,
      notes: order.notes,
      items: order.items.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        referenceCode: item.product.referenceCode,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice).toFixed(2),
        total: Number(item.total).toFixed(2),
      })),
      subtotal: Number(order.subtotal).toFixed(2),
      expiresAt: order.expiresAt,
      sale: order.sale
        ? {
            id: order.sale.id,
            saleNumber: order.sale.saleNumber,
            total: Number(order.sale.total).toFixed(2),
          }
        : null,
      cancelReason: order.cancelReason,
      confirmedAt: order.confirmedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
    };
  }

  private async loadProducts(
    client: Tx | PrismaService,
    items: OnlineOrderItemDto[],
  ) {
    const ids = items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) {
      throw new UnprocessableEntityException({
        code: "DUPLICATED_PRODUCT",
        message: "Items contain duplicated products.",
      });
    }
    const products = await client.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, price: true, active: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) {
        throw new NotFoundException({
          code: "PRODUCT_NOT_FOUND",
          message: `Product ${item.productId} not found.`,
        });
      }
      if (!product.active) {
        throw new UnprocessableEntityException({
          code: "PRODUCT_INACTIVE",
          message: `Product "${product.name}" is no longer available.`,
        });
      }
    }
    return byId;
  }

  private async branchAvailability(
    client: Tx | PrismaService,
    branches: {
      id: string;
      name: string;
      address: string;
      phone: string;
      deliveryEnabled: boolean;
    }[],
    items: OnlineOrderItemDto[],
    now = new Date(),
  ): Promise<BranchAvailability[]> {
    const branchIds = branches.map((branch) => branch.id);
    const productIds = items.map((item) => item.productId);
    const [stock, reserved] = await Promise.all([
      client.branchInventory.groupBy({
        by: ["branchId", "productId"],
        where: {
          branchId: { in: branchIds },
          productId: { in: productIds },
          expirationDate: { gte: startOfTodayUtc(now) },
        },
        _sum: { quantity: true },
      }),
      reservedUnits(client, { productIds, branchIds, now }),
    ]);
    const physical = new Map(
      stock.map((row) => [
        reservationKey(row.branchId, row.productId),
        row._sum.quantity ?? 0,
      ]),
    );
    return branches.map((branch) => {
      const lines = items.map((item) => {
        const key = reservationKey(branch.id, item.productId);
        return {
          productId: item.productId,
          available: Math.max(
            0,
            (physical.get(key) ?? 0) - (reserved.get(key) ?? 0),
          ),
        };
      });
      return {
        branchId: branch.id,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        deliveryEnabled: branch.deliveryEnabled,
        allAvailable: lines.every(
          (line, index) => line.available >= items[index].quantity,
        ),
        items: lines,
      };
    });
  }

  private activeBranches(
    client: Tx | PrismaService,
    where: Prisma.BranchWhereInput = {},
  ) {
    return client.branch.findMany({
      where: { active: true, ...where },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        deliveryEnabled: true,
      },
    });
  }

  async availability(items: OnlineOrderItemDto[]) {
    const products = await this.loadProducts(this.prisma, items);
    const branches = await this.activeBranches(this.prisma);
    return {
      products: items.map((item) => {
        const product = products.get(item.productId)!;
        return {
          productId: product.id,
          name: product.name,
          price: Number(product.price).toFixed(2),
          quantity: item.quantity,
        };
      }),
      branches: await this.branchAvailability(this.prisma, branches, items),
      deliveryAvailable: branches.some((branch) => branch.deliveryEnabled),
    };
  }

  documentTypes() {
    return this.prisma.documentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    });
  }

  private insufficientStock(
    items: OnlineOrderItemDto[],
    availability: BranchAvailability[],
    products: Map<string, { name: string }>,
  ) {
    return new UnprocessableEntityException({
      code: "INSUFFICIENT_STOCK",
      message: "One or more products do not have enough units.",
      details: {
        items: items
          .map((item, index) => ({
            productId: item.productId,
            productName: products.get(item.productId)?.name ?? "",
            requested: item.quantity,
            available: Math.max(
              0,
              ...availability.map((branch) => branch.items[index].available),
            ),
          }))
          .filter((line) => line.available < line.requested),
      },
    });
  }

  private async nextCode(tx: Tx, now: Date): Promise<string> {
    const day = businessDate(now).toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `P-${day}-`;
    const last = await tx.onlineOrder.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const next = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  private async resolveCustomer(
    tx: Tx,
    dto: CreateOnlineOrderDto,
    address: string,
  ): Promise<string | null> {
    const { customer } = dto;
    if (
      !customer.register ||
      !customer.documentTypeId ||
      !customer.documentNumber ||
      !customer.email
    ) {
      return null;
    }
    const person = await this.personsService.findOrCreateByDocument(tx, {
      documentTypeId: customer.documentTypeId,
      documentNumber: customer.documentNumber,
      ...(customer.businessName
        ? { businessName: customer.businessName }
        : { firstName: customer.firstName, lastName: customer.lastName }),
      email: customer.email.toLowerCase(),
      phone: customer.phone,
      address: customer.address || address,
    });
    if (!person.active) return null;
    const existing = await tx.customer.findUnique({
      where: { personId: person.id },
      select: { personId: true, active: true },
    });
    if (existing) return existing.active ? existing.personId : null;
    const fullName =
      person.businessName?.trim() ||
      [person.firstName, person.lastName].filter(Boolean).join(" ") ||
      `${customer.firstName} ${customer.lastName}`;
    const created = await tx.customer.create({
      data: { personId: person.id, fullName },
      select: { personId: true },
    });
    return created.personId;
  }

  private async notifyStaff(tx: Tx, order: OrderRow) {
    const users = await tx.userAccount.findMany({
      where: {
        active: true,
        person: { active: true },
        OR: [
          { role: { name: "SUPERADMIN" } },
          {
            role: { name: { in: ["BRANCH_LEADER", "BRANCH_ASSISTANT"] } },
            branchAssignments: {
              some: { branchId: order.branch.id, active: true },
            },
          },
        ],
      },
      select: { personId: true },
    });
    if (users.length === 0) return;
    const how =
      order.fulfillment === "DELIVERY"
        ? `domicilio desde ${order.branch.name}`
        : `recoge en ${order.branch.name}`;
    await tx.notification.createMany({
      data: users.map((user) => ({
        userId: user.personId,
        branchId: order.branch.id,
        type: "ONLINE_ORDER" as const,
        title: `Nuevo pedido web ${order.code}`,
        message: `${order.customerName} (${order.customerPhone}), ${how}. Total $${Number(order.subtotal).toLocaleString("es-CO")}.`,
      })),
    });
  }

  async create(dto: CreateOnlineOrderDto) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const products = await this.loadProducts(tx, dto.items);
      const isDelivery = dto.fulfillment === OnlineOrderFulfillmentDto.DELIVERY;
      const candidates = isDelivery
        ? await this.activeBranches(tx, { deliveryEnabled: true })
        : await this.activeBranches(tx, { id: dto.branchId });

      if (candidates.length === 0) {
        if (isDelivery) {
          throw new UnprocessableEntityException({
            code: "DELIVERY_UNAVAILABLE",
            message: "No branch is dispatching home deliveries right now.",
          });
        }
        const exists = await tx.branch.findUnique({
          where: { id: dto.branchId },
          select: { id: true },
        });
        throw exists
          ? new UnprocessableEntityException({
              code: "BRANCH_INACTIVE",
              message: "Branch is inactive.",
            })
          : new NotFoundException({
              code: "BRANCH_NOT_FOUND",
              message: "Branch not found.",
            });
      }

      for (const branch of candidates) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${branch.id}))::text AS locked`;
      }
      const availability = await this.branchAvailability(
        tx,
        candidates,
        dto.items,
        now,
      );
      const chosen = availability
        .filter((branch) => branch.allAvailable)
        .sort(
          (a, b) =>
            b.items.reduce((sum, item) => sum + item.available, 0) -
              a.items.reduce((sum, item) => sum + item.available, 0) ||
            a.name.localeCompare(b.name, "es"),
        )[0];
      if (!chosen)
        throw this.insufficientStock(dto.items, availability, products);

      const lines = dto.items.map((item) => {
        const priceCents = toCents(products.get(item.productId)!.price);
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: toMoney(priceCents),
          total: toMoney(priceCents * item.quantity),
          cents: priceCents * item.quantity,
        };
      });
      const address = isDelivery
        ? `${dto.delivery!.address}, ${dto.delivery!.neighborhood}, Tunja`
        : `Recoge en ${chosen.name}`;
      const customerId = await this.resolveCustomer(tx, dto, address);

      const order = await tx.onlineOrder.create({
        data: {
          code: await this.nextCode(tx, now),
          fulfillment: dto.fulfillment,
          branchId: chosen.branchId,
          customerId,
          customerName: `${dto.customer.firstName} ${dto.customer.lastName}`,
          customerPhone: dto.customer.phone,
          customerEmail: dto.customer.email?.toLowerCase() || null,
          deliveryAddress: isDelivery ? dto.delivery!.address : null,
          deliveryNeighborhood: isDelivery ? dto.delivery!.neighborhood : null,
          notes: dto.notes || null,
          subtotal: toMoney(lines.reduce((sum, line) => sum + line.cents, 0)),
          expiresAt: new Date(now.getTime() + PENDING_HOLD_HOURS * HOUR_MS),
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              total: line.total,
            })),
          },
        },
        select: orderSelect,
      });
      await this.notifyStaff(tx, order);
      return this.format(order, now);
    });
  }

  private scopeWhere(
    user: AuthenticatedUser,
    branchId?: string,
  ): Prisma.OnlineOrderWhereInput {
    if (!SCOPED_ROLES.has(user.role.name)) return branchId ? { branchId } : {};
    const allowed = (user.branches ?? []).map((branch) => branch.id);
    if (branchId && !allowed.includes(branchId)) {
      throw new ForbiddenException({
        code: "BRANCH_SCOPE_VIOLATION",
        message: "You do not have access to this branch.",
        details: { branchId },
      });
    }
    return { branchId: branchId ? branchId : { in: allowed } };
  }

  private statusWhere(
    status: OnlineOrderStatusDto | undefined,
    now: Date,
  ): Prisma.OnlineOrderWhereInput {
    if (!status) return {};
    if (status === OnlineOrderStatusDto.PENDING) {
      return { status: "PENDING", expiresAt: { gt: now } };
    }
    if (status === OnlineOrderStatusDto.EXPIRED) {
      return {
        OR: [
          { status: "EXPIRED" },
          { status: "PENDING", expiresAt: { lte: now } },
        ],
      };
    }
    return { status };
  }

  async findAll(query: ListOnlineOrdersQueryDto, user: AuthenticatedUser) {
    const now = new Date();
    const { page, limit, search, fulfillment } = query;
    const where: Prisma.OnlineOrderWhereInput = {
      AND: [
        this.scopeWhere(user, query.branchId),
        this.statusWhere(query.status, now),
        fulfillment ? { fulfillment } : {},
        search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                {
                  customerPhone: {
                    contains: search.replace(/\D/g, "") || search,
                  },
                },
              ],
            }
          : {},
      ],
    };
    const openWhere: Prisma.OnlineOrderWhereInput = {
      AND: [
        this.scopeWhere(user, query.branchId),
        {
          OR: [
            { status: { in: [...RESERVING_STATUSES] } },
            { status: "PENDING", expiresAt: { gt: now } },
          ],
        },
      ],
    };
    const [total, orders, open] = await this.prisma.$transaction([
      this.prisma.onlineOrder.count({ where }),
      this.prisma.onlineOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: orderSelect,
      }),
      this.prisma.onlineOrder.count({ where: openWhere }),
    ]);
    return {
      data: orders.map((order) => this.format(order, now)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        openOrders: open,
      },
    };
  }

  private async findScoped(
    client: Tx | PrismaService,
    id: string,
    user: AuthenticatedUser,
  ) {
    const order = await client.onlineOrder.findFirst({
      where: { id, ...this.scopeWhere(user) },
      select: orderSelect,
    });
    if (!order) {
      throw new NotFoundException({
        code: "ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }
    return order;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    return this.format(await this.findScoped(this.prisma, id, user));
  }

  private assertOpen(order: OrderRow, now: Date) {
    const status = effectiveStatus(order, now);
    if (status === "EXPIRED") {
      throw new ConflictException({
        code: "ORDER_EXPIRED",
        message: "The order hold expired. Ask the customer to place it again.",
      });
    }
    if (!(OPEN_STATUSES as readonly string[]).includes(status)) {
      throw new ConflictException({
        code: "INVALID_STATUS_TRANSITION",
        message: `The order is already ${status}.`,
        details: { from: status },
      });
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateOnlineOrderStatusDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findScoped(tx, id, user);
      this.assertOpen(order, now);
      const allowed = TRANSITIONS[order.status] ?? [];
      const wrongKind =
        (dto.status === "READY" && order.fulfillment !== "PICKUP") ||
        (dto.status === "OUT_FOR_DELIVERY" && order.fulfillment !== "DELIVERY");
      if (!allowed.includes(dto.status) || wrongKind) {
        throw new ConflictException({
          code: "INVALID_STATUS_TRANSITION",
          message: `An order in ${order.status} cannot move to ${dto.status}.`,
          details: { from: order.status, to: dto.status },
        });
      }
      const updated = await tx.onlineOrder.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === "CONFIRMED" ? { confirmedAt: now } : {}),
          ...(dto.status === "CANCELLED"
            ? { cancelledAt: now, cancelReason: dto.reason }
            : {}),
        },
        select: orderSelect,
      });
      await this.auditService.createAuditLog(
        {
          userId: user.id,
          action: dto.status === "CANCELLED" ? "CANCEL" : "UPDATE",
          entity: "ONLINE_ORDER",
          entityId: id,
          oldData: { status: order.status },
          newData: { status: dto.status, reason: dto.reason ?? null },
          reason: `Pedido web ${order.code}: ${order.status} → ${dto.status}`,
          ipAddress,
        },
        tx,
      );
      return this.format(updated, now);
    });
  }

  async complete(
    id: string,
    dto: CompleteOnlineOrderDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findScoped(tx, id, user);
      this.assertOpen(order, now);
      const products = await tx.product.findMany({
        where: { id: { in: order.items.map((item) => item.productId) } },
        select: { id: true, price: true },
      });
      const prices = new Map(
        products.map((product) => [product.id, toCents(product.price)]),
      );
      const totalCents = order.items.reduce(
        (sum, item) => sum + (prices.get(item.productId) ?? 0) * item.quantity,
        0,
      );
      const sale = await this.salesService.create(
        {
          branchId: order.branch.id,
          customerId: order.customer?.personId ?? null,
          items: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          promotionId: null,
          payments: [
            {
              paymentMethodId: dto.paymentMethodId,
              amount: toMoney(totalCents),
              reference: dto.reference || null,
            },
          ],
        },
        user,
        { onlineOrderId: id, client: tx },
      );
      const updated = await tx.onlineOrder.update({
        where: { id },
        data: { status: "DELIVERED", deliveredAt: now, saleId: sale.id },
        select: orderSelect,
      });
      await this.auditService.createAuditLog(
        {
          userId: user.id,
          action: "COMPLETE",
          entity: "ONLINE_ORDER",
          entityId: id,
          oldData: { status: order.status },
          newData: { status: "DELIVERED", saleId: sale.id },
          reason: `Pedido web ${order.code} entregado con la venta ${sale.saleNumber}`,
          ipAddress,
        },
        tx,
      );
      return { order: this.format(updated, now), sale };
    });
  }

  @Cron(CronExpression.EVERY_HOUR, { name: "online-orders-expiration" })
  async expirePendingOrders(now = new Date()): Promise<number> {
    try {
      const result = await this.prisma.onlineOrder.updateMany({
        where: { status: "PENDING", expiresAt: { lte: now } },
        data: { status: "EXPIRED" },
      });
      return result.count;
    } catch (error) {
      this.logger.error(
        "Could not expire the pending web orders",
        error as Error,
      );
      return 0;
    }
  }
}
