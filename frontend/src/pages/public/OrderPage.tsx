import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { CatalogImage } from '../../components/catalog-public/CatalogImage'
import { PublicLayout } from '../../components/landing/PublicLayout'
import { Alert } from '../../components/ui/Alert'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { useCart } from '../../hooks/useCart'
import { useCartAvailability, useOrderDocumentTypes } from '../../hooks/useOnlineOrderSupport'
import { onlineOrdersService } from '../../services/onlineOrders.service'
import type { CreateOnlineOrderPayload, OnlineOrder } from '../../types/onlineOrder'
import { CONTACT, whatsappUrl } from '../../utils/contact'
import { missingInBranch, orderWhatsappMessage, resolveOrderError } from '../../utils/onlineOrders'
import { formatPrice } from '../../utils/products'

import './OrderPage.css'

const orderSchema = z
  .object({
    fulfillment: z.enum(['PICKUP', 'DELIVERY']),
    branchId: z.string(),
    address: z.string().trim().max(255, 'Máximo 255 caracteres'),
    neighborhood: z.string().trim().max(100, 'Máximo 100 caracteres'),
    firstName: z.string().trim().min(1, 'Ingresa tus nombres').max(100, 'Máximo 100 caracteres'),
    lastName: z.string().trim().min(1, 'Ingresa tus apellidos').max(100, 'Máximo 100 caracteres'),
    phone: z
      .string()
      .transform((value) => value.replace(/\D/g, ''))
      .pipe(z.string().regex(/^3\d{9}$/, 'Escribe un celular de 10 dígitos que empiece por 3')),
    email: z.string().trim().max(150, 'Máximo 150 caracteres'),
    register: z.boolean(),
    documentTypeId: z.string(),
    documentNumber: z.string().trim(),
    notes: z.string().trim().max(500, 'Máximo 500 caracteres'),
  })
  .superRefine((values, context) => {
    const require = (path: keyof typeof values, message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    if (values.fulfillment === 'PICKUP' && !values.branchId) {
      require('branchId', 'Elige la sede donde recoges')
    }
    if (values.fulfillment === 'DELIVERY') {
      if (!values.address) require('address', 'Escribe la dirección de entrega')
      if (!values.neighborhood) require('neighborhood', 'Escribe el barrio')
    }
    if (values.email && !z.string().email().safeParse(values.email).success) {
      require('email', 'Escribe un correo válido')
    }
    if (values.register) {
      if (!values.email) require('email', 'El correo es necesario para registrarte')
      if (!values.documentTypeId) require('documentTypeId', 'Elige el tipo de documento')
      if (!/^[A-Za-z0-9-]{4,20}$/.test(values.documentNumber)) {
        require('documentNumber', 'Escribe tu número de documento')
      }
    }
  })

type OrderFormInput = z.input<typeof orderSchema>
type OrderFormValues = z.output<typeof orderSchema>

const DEFAULTS: OrderFormInput = {
  fulfillment: 'PICKUP',
  branchId: '',
  address: '',
  neighborhood: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  register: true,
  documentTypeId: '',
  documentNumber: '',
  notes: '',
}

const holdFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
})

function OrderConfirmation({ order, whatsapp }: { order: OnlineOrder; whatsapp: string }) {
  const link = whatsapp ? whatsappUrl(whatsapp, orderWhatsappMessage(order)) : null
  return (
    <section className="order-done" aria-labelledby="order-done-title">
      <p className="order-done__eyebrow">Pedido recibido</p>
      <h1 id="order-done-title" className="order-done__title">
        Tu pedido es el <span>{order.code}</span>
      </h1>
      <p className="order-done__text">
        Guardamos tus productos hasta el {holdFormatter.format(new Date(order.expiresAt))}.{' '}
        {order.fulfillment === 'DELIVERY'
          ? 'Escríbenos por WhatsApp para acordar el pago y el valor del domicilio.'
          : `Escríbenos por WhatsApp para coordinar el pago y recogerlo en ${order.branch.name}.`}
      </p>
      {link && (
        <a className="order-done__whatsapp" href={link} target="_blank" rel="noreferrer noopener">
          Enviar el pedido por WhatsApp
        </a>
      )}
      <dl className="order-done__summary">
        <div>
          <dt>{order.fulfillment === 'DELIVERY' ? 'Domicilio' : 'Recoges en'}</dt>
          <dd>
            {order.fulfillment === 'DELIVERY'
              ? `${order.delivery?.address}, ${order.delivery?.neighborhood}, Tunja`
              : `${order.branch.name} · ${order.branch.address}`}
          </dd>
        </div>
        <div>
          <dt>Productos</dt>
          <dd>{order.items.map((item) => `${item.quantity} x ${item.name}`).join(', ')}</dd>
        </div>
        <div>
          <dt>Total productos</dt>
          <dd>{formatPrice(order.subtotal)}</dd>
        </div>
      </dl>
      <Link className="order-done__more" to="/productos">
        Seguir viendo productos
      </Link>
    </section>
  )
}

function OrderContent({ whatsapp }: { whatsapp: string }) {
  const cart = useCart()
  const lines = cart.items.map(({ productId, quantity }) => ({ productId, quantity }))
  const { status, availability } = useCartAvailability(lines)
  const documentTypes = useOrderDocumentTypes()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<OnlineOrder | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormInput, unknown, OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: DEFAULTS,
  })
  const fulfillment = useWatch({ control, name: 'fulfillment' })
  const branchId = useWatch({ control, name: 'branchId' })
  const wantsRegister = useWatch({ control, name: 'register' })

  const branches = [...(availability?.branches ?? [])].sort(
    (a, b) => Number(b.allAvailable) - Number(a.allAvailable),
  )
  const pickupBranch = branches.find((branch) => branch.branchId === branchId)
  const deliveryBranches = branches.filter((branch) => branch.deliveryEnabled)
  const deliveryReady = deliveryBranches.some((branch) => branch.allAvailable)
  const pickupAlternatives = branches
    .filter((branch) => branch.allAvailable && !branch.deliveryEnabled)
    .map((branch) => branch.name)
  const listFormatter = new Intl.ListFormat('es', { type: 'conjunction' })
  const deliveryNames = listFormatter.format(deliveryBranches.map((branch) => branch.name))
  const maxAvailable = (productId: string) =>
    Math.max(
      0,
      ...branches.map(
        (branch) => branch.items.find((item) => item.productId === productId)?.available ?? 0,
      ),
    )
  const blocked =
    status !== 'success' ||
    (fulfillment === 'PICKUP' && pickupBranch !== undefined && !pickupBranch.allAvailable) ||
    (fulfillment === 'DELIVERY' && !deliveryReady)

  useEffect(() => {
    if (pickupBranch && !pickupBranch.allAvailable) setValue('branchId', '')
  }, [pickupBranch, setValue])

  useEffect(() => {
    document.title = 'Tu pedido | Intelligent Nutrition'
  }, [])

  if (placed) return <OrderConfirmation order={placed} whatsapp={whatsapp} />

  if (cart.items.length === 0) {
    return (
      <section className="order-empty">
        <h1 className="order-page__title">Tu pedido</h1>
        <p>Todavía no agregas productos. Elige en el catálogo lo que necesitas.</p>
        <Link className="order-done__whatsapp" to="/productos">
          Ver el catálogo
        </Link>
      </section>
    )
  }

  const onSubmit = async (values: OrderFormValues) => {
    setSubmitError(null)
    const payload: CreateOnlineOrderPayload = {
      fulfillment: values.fulfillment,
      items: lines,
      customer: {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        register: values.register,
        ...(values.email ? { email: values.email } : {}),
        ...(values.register
          ? { documentTypeId: values.documentTypeId, documentNumber: values.documentNumber }
          : {}),
      },
      ...(values.fulfillment === 'PICKUP'
        ? { branchId: values.branchId }
        : { delivery: { address: values.address, neighborhood: values.neighborhood } }),
      ...(values.notes ? { notes: values.notes } : {}),
    }
    try {
      const order = await onlineOrdersService.create(payload)
      cart.clear()
      setPlaced(order)
      window.scrollTo({ top: 0 })
      if (whatsapp) {
        window.open(whatsappUrl(whatsapp, orderWhatsappMessage(order)), '_blank', 'noopener')
      }
    } catch (error) {
      setSubmitError(resolveOrderError(error, 'No pudimos enviar tu pedido. Intenta de nuevo.'))
    }
  }

  return (
    <form className="order-page" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="order-page__main">
        <h1 className="order-page__title">Tu pedido</h1>

        <ul className="order-lines" aria-label="Productos del pedido">
          {cart.items.map((item) => {
            const available = maxAvailable(item.productId)
            const short = status === 'success' && item.quantity > available
            return (
              <li key={item.productId} className="order-line">
                <div className="order-line__media">
                  <CatalogImage src={item.imageUrl} alt="" placeholder="Foto" />
                </div>
                <div className="order-line__info">
                  <Link className="order-line__name" to={`/productos/${item.productId}`}>
                    {item.name}
                  </Link>
                  <span className="order-line__price">{formatPrice(item.price)} c/u</span>
                  {short && (
                    <span className="order-line__warning" role="alert">
                      {available === 0
                        ? 'Ya no hay unidades disponibles'
                        : `Solo hay ${available} disponibles`}
                    </span>
                  )}
                </div>
                <div
                  className="order-line__stepper"
                  role="group"
                  aria-label={`Cantidad de ${item.name}`}
                >
                  <button
                    type="button"
                    aria-label={`Quitar una unidad de ${item.name}`}
                    disabled={item.quantity <= 1}
                    onClick={() => cart.setQuantity(item.productId, item.quantity - 1)}
                  >
                    −
                  </button>
                  <output>{item.quantity}</output>
                  <button
                    type="button"
                    aria-label={`Agregar una unidad de ${item.name}`}
                    disabled={status === 'success' && item.quantity >= available}
                    onClick={() => cart.setQuantity(item.productId, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <span className="order-line__total">
                  {formatPrice(Number(item.price) * item.quantity)}
                </span>
                <button
                  type="button"
                  className="order-line__remove"
                  aria-label={`Quitar ${item.name} del pedido`}
                  onClick={() => cart.remove(item.productId)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>

        <fieldset className="order-section">
          <legend className="order-section__title">¿Cómo lo recibes?</legend>
          <div className="order-options">
            <label
              className={`order-option${fulfillment === 'PICKUP' ? ' order-option--active' : ''}`}
            >
              <input type="radio" value="PICKUP" {...register('fulfillment')} />
              <span className="order-option__title">Recoger en sede</span>
              <span className="order-option__detail">
                Sin costo. Pagas al recoger o por transferencia.
              </span>
            </label>
            <label
              className={`order-option${fulfillment === 'DELIVERY' ? ' order-option--active' : ''}${
                availability && !availability.deliveryAvailable ? ' order-option--disabled' : ''
              }`}
            >
              <input
                type="radio"
                value="DELIVERY"
                disabled={availability !== null && !availability.deliveryAvailable}
                {...register('fulfillment')}
              />
              <span className="order-option__title">Domicilio en Tunja</span>
              <span className="order-option__detail">
                {availability && !availability.deliveryAvailable
                  ? 'Por ahora no estamos haciendo domicilios.'
                  : status === 'success' && !deliveryReady
                    ? `Sale desde ${deliveryNames}, que no tienen todo tu pedido.`
                    : 'El valor del domicilio se acuerda por WhatsApp.'}
              </span>
            </label>
          </div>

          {fulfillment === 'PICKUP' ? (
            <div className="order-branches" role="radiogroup" aria-label="Sede donde recoges">
              {status === 'loading' && (
                <p className="order-muted">Revisando la disponibilidad...</p>
              )}
              {status === 'error' && (
                <Alert tone="error">No pudimos revisar la disponibilidad. Recarga la página.</Alert>
              )}
              {branches.map((branch) => {
                const missing = missingInBranch(branch, cart.items)
                return (
                  <label
                    key={branch.branchId}
                    className={`order-branch${branchId === branch.branchId ? ' order-branch--active' : ''}${
                      branch.allAvailable ? '' : ' order-branch--disabled'
                    }`}
                  >
                    <input
                      type="radio"
                      value={branch.branchId}
                      disabled={!branch.allAvailable}
                      {...register('branchId')}
                    />
                    <span className="order-branch__name">{branch.name}</span>
                    <span className="order-branch__address">{branch.address}</span>
                    <span
                      className={`order-branch__stock${branch.allAvailable ? ' order-branch__stock--ok' : ''}`}
                    >
                      {branch.allAvailable
                        ? 'Todo el pedido disponible'
                        : `Falta: ${missing
                            .map((item) => `${item.name} (${item.available} disp.)`)
                            .join(', ')}`}
                    </span>
                  </label>
                )
              })}
              {errors.branchId && (
                <span className="ui-field__error" role="alert">
                  {errors.branchId.message}
                </span>
              )}
            </div>
          ) : (
            <div className="order-grid">
              {status === 'success' && !deliveryReady && (
                <Alert tone="info">
                  Los domicilios salen de {deliveryNames} y ahí no está todo tu pedido.{' '}
                  {pickupAlternatives.length > 0
                    ? `Puedes recogerlo en ${listFormatter.format(pickupAlternatives)}, o ajustar las cantidades.`
                    : 'Ajusta las cantidades o recógelo en una sede.'}
                </Alert>
              )}
              <TextField
                id="order-address"
                label="Dirección de entrega"
                autoComplete="street-address"
                error={errors.address?.message}
                {...register('address')}
              />
              <TextField
                id="order-neighborhood"
                label="Barrio"
                error={errors.neighborhood?.message}
                {...register('neighborhood')}
              />
              <p className="order-muted order-grid__full">
                Solo entregamos en Tunja. Te despachamos desde la sede que tenga todo tu pedido.
              </p>
            </div>
          )}
        </fieldset>

        <fieldset className="order-section">
          <legend className="order-section__title">Tus datos</legend>
          <div className="order-grid">
            <TextField
              id="order-first-name"
              label="Nombres"
              autoComplete="given-name"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <TextField
              id="order-last-name"
              label="Apellidos"
              autoComplete="family-name"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
            <TextField
              id="order-phone"
              label="Celular (WhatsApp)"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <TextField
              id="order-email"
              label={wantsRegister ? 'Correo electrónico' : 'Correo electrónico (opcional)'}
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <label className="order-register order-grid__full">
              <input type="checkbox" {...register('register')} />
              <span>
                <strong>Registrarme como cliente (recomendado)</strong>
                <span>
                  Guardamos tus compras para atenderte más rápido y asesorarte mejor. Si ya eres
                  cliente, te reconocemos por tu documento.
                </span>
              </span>
            </label>
            {wantsRegister && (
              <>
                <SelectField
                  id="order-document-type"
                  label="Tipo de documento"
                  placeholder="Elige el tipo"
                  options={documentTypes.map((type) => ({ value: type.id, label: type.name }))}
                  error={errors.documentTypeId?.message}
                  {...register('documentTypeId')}
                />
                <TextField
                  id="order-document-number"
                  label="Número de documento"
                  inputMode="numeric"
                  error={errors.documentNumber?.message}
                  {...register('documentNumber')}
                />
              </>
            )}
            <div className="ui-field order-grid__full">
              <label className="ui-field__label" htmlFor="order-notes">
                Notas para la tienda (opcional)
              </label>
              <textarea
                id="order-notes"
                className="ui-field__control order-notes"
                rows={3}
                aria-invalid={!!errors.notes}
                {...register('notes')}
              />
              {errors.notes && (
                <span className="ui-field__error" role="alert">
                  {errors.notes.message}
                </span>
              )}
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="order-summary" aria-labelledby="order-summary-title">
        <h2 id="order-summary-title" className="order-summary__eyebrow">
          Resumen
        </h2>
        <dl>
          <div>
            <dt>
              {cart.count} {cart.count === 1 ? 'producto' : 'productos'}
            </dt>
            <dd>{formatPrice(cart.subtotal)}</dd>
          </div>
          <div>
            <dt>{fulfillment === 'DELIVERY' ? 'Domicilio' : 'Recogida en sede'}</dt>
            <dd className={fulfillment === 'DELIVERY' ? '' : 'order-summary__free'}>
              {fulfillment === 'DELIVERY' ? 'Se acuerda por WhatsApp' : 'Sin costo'}
            </dd>
          </div>
        </dl>
        <div className="order-summary__total">
          <span>Total productos</span>
          <strong>{formatPrice(cart.subtotal)}</strong>
        </div>
        {submitError && <Alert tone="error">{submitError}</Alert>}
        <button type="submit" className="order-summary__submit" disabled={isSubmitting || blocked}>
          {isSubmitting ? 'Enviando pedido...' : 'Enviar pedido por WhatsApp'}
        </button>
        <p className="order-summary__note">
          Guardamos tus productos 48 horas. El pago y la entrega se coordinan por WhatsApp; no pagas
          nada en línea.
        </p>
      </aside>
    </form>
  )
}

export function OrderPage({ whatsapp = CONTACT.whatsapp }: { whatsapp?: string }) {
  return (
    <PublicLayout>
      <main className="order-page__wrap">
        <OrderContent whatsapp={whatsapp} />
      </main>
    </PublicLayout>
  )
}
