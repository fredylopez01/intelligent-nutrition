import { ApiError } from '../services/http'
import type {
  BranchCartAvailability,
  CartItem,
  ManualOrderStatus,
  OnlineOrder,
  OnlineOrderStatus,
} from '../types/onlineOrder'

import { formatPrice } from './products'

export const ORDER_STATUS_LABELS: Record<OnlineOrderStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  READY: 'Listo para recoger',
  OUT_FOR_DELIVERY: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Vencido',
}

export const ORDER_STATUS_TONES: Record<OnlineOrderStatus, 'activo' | 'inactivo' | 'pendiente'> = {
  PENDING: 'pendiente',
  CONFIRMED: 'pendiente',
  READY: 'activo',
  OUT_FOR_DELIVERY: 'activo',
  DELIVERED: 'activo',
  CANCELLED: 'inactivo',
  EXPIRED: 'inactivo',
}

export const FULFILLMENT_LABELS = {
  PICKUP: 'Recoge en sede',
  DELIVERY: 'Domicilio',
} as const

const OPEN: OnlineOrderStatus[] = ['PENDING', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY']

export function isOpenOrder(order: Pick<OnlineOrder, 'status'>): boolean {
  return OPEN.includes(order.status)
}

export interface OrderAction {
  status: ManualOrderStatus
  label: string
}

export function nextOrderActions(
  order: Pick<OnlineOrder, 'status' | 'fulfillment'>,
): OrderAction[] {
  if (order.status === 'PENDING') return [{ status: 'CONFIRMED', label: 'Confirmar pedido' }]
  if (order.status === 'CONFIRMED') {
    return order.fulfillment === 'PICKUP'
      ? [{ status: 'READY', label: 'Marcar listo para recoger' }]
      : [{ status: 'OUT_FOR_DELIVERY', label: 'Marcar en camino' }]
  }
  return []
}

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
})

export function formatOrderDate(iso: string): string {
  return dateTimeFormatter.format(new Date(iso)).replace(/\./g, '').replace(/\s+/g, ' ')
}

export function holdLabel(
  order: Pick<OnlineOrder, 'status' | 'expiresAt'>,
  now = new Date(),
): string {
  if (order.status !== 'PENDING') return ''
  const hours = Math.max(0, Math.round((Date.parse(order.expiresAt) - now.getTime()) / 3_600_000))
  return hours <= 1 ? 'Vence en menos de una hora' : `Vence en ${hours} h`
}

export function missingInBranch(
  branch: BranchCartAvailability,
  cart: CartItem[],
): { name: string; available: number }[] {
  return cart.flatMap((line) => {
    const available = branch.items.find((item) => item.productId === line.productId)?.available ?? 0
    return available < line.quantity ? [{ name: line.name, available }] : []
  })
}

export function orderWhatsappMessage(order: OnlineOrder): string {
  const lines = order.items.map(
    (item) => `• ${item.quantity} x ${item.name} (${formatPrice(item.total)})`,
  )
  const where =
    order.fulfillment === 'DELIVERY'
      ? `Domicilio en Tunja: ${order.delivery?.address ?? ''}, ${order.delivery?.neighborhood ?? ''}`
      : `Recojo en ${order.branch.name} (${order.branch.address})`
  return [
    `Hola, hice el pedido ${order.code} en la tienda web.`,
    ...lines,
    `Total productos: ${formatPrice(order.subtotal)}`,
    where,
    `A nombre de ${order.customer.name}, cel. ${order.customer.phone}.`,
    order.fulfillment === 'DELIVERY'
      ? 'Quedo atento al valor del domicilio y a la forma de pago.'
      : 'Quedo atento para coordinar el pago y la recogida.',
  ].join('\n')
}

export function customerWhatsappMessage(order: Pick<OnlineOrder, 'code' | 'customer'>): string {
  const firstName = order.customer.name.split(' ')[0]
  return `Hola ${firstName}, te escribimos de Intelligent Nutrition por tu pedido ${order.code}.`
}

export function resolveOrderError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'INSUFFICIENT_STOCK': {
      const items = (error.details as { items?: { productName: string; available: number }[] })
        ?.items
      const detail = items
        ?.map((item) => `${item.productName} (${item.available} disponibles)`)
        .join(', ')
      return detail
        ? `No hay unidades suficientes de: ${detail}. Ajusta las cantidades.`
        : 'Algunos productos ya no tienen unidades suficientes. Ajusta las cantidades.'
    }
    case 'DELIVERY_UNAVAILABLE':
      return 'En este momento no estamos haciendo domicilios. Puedes recoger en una sede.'
    case 'EMAIL_ALREADY_IN_USE':
      return 'Ese correo ya está registrado con otro documento. Usa otro correo o desmarca el registro.'
    case 'PRODUCT_INACTIVE':
    case 'PRODUCT_NOT_FOUND':
      return 'Uno de los productos ya no está disponible. Quítalo del pedido.'
    case 'BRANCH_INACTIVE':
    case 'BRANCH_NOT_FOUND':
      return 'La sede elegida ya no está disponible. Elige otra.'
    case 'ORDER_EXPIRED':
      return 'La reserva de este pedido venció. Pide al cliente que lo haga de nuevo.'
    case 'INVALID_STATUS_TRANSITION':
      return 'El pedido cambió de estado. Recarga para ver su estado actual.'
    case 'INVENTORY_CLOSED':
      return 'El inventario de la sede ya está cerrado por hoy.'
    case 'BRANCH_SCOPE_VIOLATION':
      return 'No tienes acceso a esta sede.'
    default:
      return error.message || fallback
  }
}
