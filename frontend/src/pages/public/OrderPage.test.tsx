import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { onlineOrdersService } from '../../services/onlineOrders.service'
import { buildAvailability, buildOrder } from '../../test-utils/onlineOrders'

import { OrderPage } from './OrderPage'

vi.mock('../../services/onlineOrders.service', () => ({
  onlineOrdersService: { availability: vi.fn(), documentTypes: vi.fn(), create: vi.fn() },
}))

vi.mock('../../hooks/useBrandAssets', () => ({
  useBrandAssets: () => ({ logo: '/logo.svg', isotipo: '/isotipo.svg' }),
}))

const availability = vi.mocked(onlineOrdersService.availability)
const createOrder = vi.mocked(onlineOrdersService.create)
const cartLine = {
  productId: 'p-whey',
  name: 'Best Whey Vainilla 5lb',
  referenceCode: 'BW-5',
  price: '339900.00',
  imageUrl: null,
  quantity: 2,
}

function renderPage() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <OrderPage whatsapp="3102332100" />
    </MemoryRouter>,
  )
  return { user }
}

async function fillCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombres'), 'Camilo')
  await user.type(screen.getByLabelText('Apellidos'), 'Rojas Pineda')
  await user.type(screen.getByLabelText('Celular (WhatsApp)'), '311 482 7719')
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  localStorage.setItem('intelligent-nutrition:cart', JSON.stringify([cartLine]))
  window.scrollTo = vi.fn()
  window.open = vi.fn()
  availability.mockResolvedValue(buildAvailability())
  vi.mocked(onlineOrdersService.documentTypes).mockResolvedValue([
    { id: 'cc', code: 'CC', name: 'Cédula de ciudadanía' },
  ])
  createOrder.mockResolvedValue(buildOrder())
})

describe('OrderPage', () => {
  it('lets the customer pick a branch with the whole order and sends it to WhatsApp', async () => {
    const { user } = renderPage()

    expect(await screen.findByText('Todo el pedido disponible')).toBeInTheDocument()
    expect(availability).toHaveBeenCalledWith([{ productId: 'p-whey', quantity: 2 }])
    expect(screen.getByText('Falta: Best Whey Vainilla 5lb (1 disp.)')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Sede Viva/ })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /Sede Makro/ }))
    await fillCustomer(user)
    await user.click(screen.getByRole('checkbox', { name: /Registrarme como cliente/ }))
    await user.click(screen.getByRole('button', { name: 'Enviar pedido por WhatsApp' }))

    await waitFor(() =>
      expect(createOrder).toHaveBeenCalledWith({
        fulfillment: 'PICKUP',
        branchId: 'makro',
        items: [{ productId: 'p-whey', quantity: 2 }],
        customer: {
          firstName: 'Camilo',
          lastName: 'Rojas Pineda',
          phone: '3114827719',
          register: false,
        },
      }),
    )
    expect(
      await screen.findByRole('heading', { name: /Tu pedido es el P-20261114-0001/ }),
    ).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Enviar el pedido por WhatsApp' })
    expect(link.getAttribute('href')).toMatch(
      /^https:\/\/wa\.me\/573102332100\?text=Hola%2C%20hice%20el%20pedido/,
    )
    expect(window.open).toHaveBeenCalledWith(link.getAttribute('href'), '_blank', 'noopener')
    expect(localStorage.getItem('intelligent-nutrition:cart')).toBe('[]')
  })

  it('registers the customer with the document when the box stays checked', async () => {
    const { user } = renderPage()

    await user.click(await screen.findByRole('radio', { name: /Sede Makro/ }))
    await fillCustomer(user)
    await user.click(screen.getByRole('button', { name: 'Enviar pedido por WhatsApp' }))
    expect(await screen.findByText('El correo es necesario para registrarte')).toBeInTheDocument()
    expect(screen.getByText('Elige el tipo de documento')).toBeInTheDocument()
    expect(createOrder).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Correo electrónico'), 'camilo@correo.com')
    await user.selectOptions(screen.getByLabelText('Tipo de documento'), 'cc')
    await user.type(screen.getByLabelText('Número de documento'), '1049632145')
    await user.click(screen.getByRole('button', { name: 'Enviar pedido por WhatsApp' }))

    await waitFor(() =>
      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({
            register: true,
            email: 'camilo@correo.com',
            documentTypeId: 'cc',
            documentNumber: '1049632145',
          }),
        }),
      ),
    )
  })

  it('asks for the address for a delivery in Tunja', async () => {
    const { user } = renderPage()

    await user.click(await screen.findByRole('radio', { name: /Domicilio en Tunja/ }))
    expect(screen.getByText('Se acuerda por WhatsApp')).toBeInTheDocument()
    await fillCustomer(user)
    await user.click(screen.getByRole('checkbox', { name: /Registrarme como cliente/ }))
    await user.click(screen.getByRole('button', { name: 'Enviar pedido por WhatsApp' }))
    expect(await screen.findByText('Escribe la dirección de entrega')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Dirección de entrega'), 'Calle 19 # 9-35')
    await user.type(screen.getByLabelText('Barrio'), 'Centro')
    await user.click(screen.getByRole('button', { name: 'Enviar pedido por WhatsApp' }))

    await waitFor(() =>
      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          fulfillment: 'DELIVERY',
          delivery: { address: 'Calle 19 # 9-35', neighborhood: 'Centro' },
        }),
      ),
    )
    expect(await screen.findByRole('heading', { name: /Tu pedido es el/ })).toBeInTheDocument()
  })

  it('blocks the delivery when no delivery branch has the whole order', async () => {
    availability.mockResolvedValue(
      buildAvailability({
        branches: buildAvailability().branches.map((branch) => ({
          ...branch,
          allAvailable: false,
        })),
      }),
    )
    const { user } = renderPage()

    await user.click(await screen.findByRole('radio', { name: /Domicilio en Tunja/ }))

    expect(
      screen.getByText(/Los domicilios salen de Sede Makro y ahí no está todo tu pedido\./),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sale desde Sede Makro, que no tienen todo tu pedido.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar pedido por WhatsApp' })).toBeDisabled()
  })

  it('suggests the branches where the order can be picked up when delivery is not possible', async () => {
    const [makro, viva] = buildAvailability().branches
    availability.mockResolvedValue(
      buildAvailability({
        branches: [
          { ...makro, allAvailable: false },
          { ...viva, allAvailable: true },
        ],
      }),
    )
    const { user } = renderPage()

    await user.click(await screen.findByRole('radio', { name: /Domicilio en Tunja/ }))

    expect(
      screen.getByText(
        'Los domicilios salen de Sede Makro y ahí no está todo tu pedido. Puedes recogerlo en Sede Viva, o ajustar las cantidades.',
      ),
    ).toBeInTheDocument()
  })

  it('updates the quantities and warns when there are not enough units', async () => {
    const { user } = renderPage()

    await screen.findByText('Todo el pedido disponible')
    await user.click(
      screen.getByRole('button', { name: 'Agregar una unidad de Best Whey Vainilla 5lb' }),
    )

    await waitFor(() =>
      expect(availability).toHaveBeenLastCalledWith([{ productId: 'p-whey', quantity: 3 }]),
    )
    availability.mockResolvedValue(
      buildAvailability({
        branches: [
          { ...buildAvailability().branches[0], items: [{ productId: 'p-whey', available: 1 }] },
        ],
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Agregar una unidad de Best Whey Vainilla 5lb' }),
    )
    expect(await screen.findByText('Solo hay 1 disponibles')).toBeInTheDocument()
  })

  it('explains an API error and keeps the order', async () => {
    createOrder.mockRejectedValue(new ApiError('Conflict', 409, undefined, 'EMAIL_ALREADY_IN_USE'))
    const { user } = renderPage()

    await user.click(await screen.findByRole('radio', { name: /Sede Makro/ }))
    await fillCustomer(user)
    await user.click(screen.getByRole('checkbox', { name: /Registrarme como cliente/ }))
    await user.click(screen.getByRole('button', { name: 'Enviar pedido por WhatsApp' }))

    expect(await screen.findByText(/Ese correo ya está registrado/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Productos del pedido' })).toBeInTheDocument()
  })

  it('invites to the catalog when the cart is empty', () => {
    localStorage.clear()
    renderPage()

    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute(
      'href',
      '/productos',
    )
    expect(availability).not.toHaveBeenCalled()
  })
})
