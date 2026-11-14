import type { Prisma } from "../../../generated/prisma/client.js";

export const RESERVING_STATUSES = [
  "CONFIRMED",
  "READY",
  "OUT_FOR_DELIVERY",
] as const;

export const PENDING_HOLD_HOURS = 48;

type ReservationClient = {
  onlineOrderItem: {
    findMany: (args: Prisma.OnlineOrderItemFindManyArgs) => Promise<unknown[]>;
  };
};

export function activeReservationWhere(
  now: Date,
  excludeOrderId?: string,
): Prisma.OnlineOrderWhereInput {
  return {
    ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    OR: [
      { status: { in: [...RESERVING_STATUSES] } },
      { status: "PENDING", expiresAt: { gt: now } },
    ],
  };
}

export function reservationKey(branchId: string, productId: string): string {
  return `${branchId}:${productId}`;
}

export async function reservedUnits(
  client: ReservationClient,
  {
    productIds,
    branchIds,
    now = new Date(),
    excludeOrderId,
  }: {
    productIds: string[];
    branchIds?: string[];
    now?: Date;
    excludeOrderId?: string;
  },
): Promise<Map<string, number>> {
  const reserved = new Map<string, number>();
  if (productIds.length === 0) return reserved;
  const rows = (await client.onlineOrderItem.findMany({
    where: {
      productId: { in: productIds },
      order: {
        ...activeReservationWhere(now, excludeOrderId),
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
    },
    select: {
      productId: true,
      quantity: true,
      order: { select: { branchId: true } },
    },
  })) as { productId: string; quantity: number; order: { branchId: string } }[];
  for (const row of rows) {
    const key = reservationKey(row.order.branchId, row.productId);
    reserved.set(key, (reserved.get(key) ?? 0) + row.quantity);
  }
  return reserved;
}
