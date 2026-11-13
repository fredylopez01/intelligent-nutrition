import { test, expect } from '@playwright/test'

const OTHER_USER_ROW = 'table tbody tr:nth-child(2)'

test.describe('TK-031.3 — Actualización de usuarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', 'natalia.bernal@intelligent.co')
    await page.fill('#password', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => url.pathname !== '/login')
    await page.goto('/usuarios')
    await page.waitForSelector('table tbody tr')
  })

  const openDetail = async (page: import('@playwright/test').Page) => {
    await page.locator(`${OTHER_USER_ROW} .users-table__identity-link`).click()
    await page.waitForURL(/\/usuarios\/[^/]+$/)
    await page.waitForSelector('#user-firstName')
  }

  const fillRequiredContact = async (page: import('@playwright/test').Page) => {
    await page.fill('#user-phone', '3001234567')
    await page.fill('#user-address', 'Carrera 9 # 8-7')
  }

  test('Muestra la página de detalle al seleccionar un usuario', async ({ page }) => {
    await openDetail(page)

    await expect(page.locator('#user-profile-name')).toBeVisible()
    await expect(page.locator('#user-firstName')).toBeVisible()
    await expect(page.locator('#user-lastName')).toBeVisible()
    await expect(page.locator('#user-email')).toBeVisible()
    await expect(page.locator('button:has-text("Guardar cambios")')).toBeVisible()
  })

  test('Muestra error si el nombre está vacío', async ({ page }) => {
    await openDetail(page)
    await page.fill('#user-firstName', '')
    await page.click('button:has-text("Guardar cambios")')

    await expect(page.locator('text=Ingresa los nombres')).toBeVisible()
  })

  test('Muestra error si el correo es inválido', async ({ page }) => {
    await openDetail(page)
    await page.fill('#user-email', 'no-es-email')
    await page.click('button:has-text("Guardar cambios")')

    await expect(page.locator('text=Ingresa un correo válido')).toBeVisible()
  })

  test('Exige teléfono y dirección antes de enviar', async ({ page }) => {
    await openDetail(page)
    await page.fill('#user-firstName', 'Fabian')
    await page.click('button:has-text("Guardar cambios")')

    await expect(page.locator('text=Ingresa el teléfono')).toBeVisible()
    await expect(page.locator('text=Ingresa la dirección')).toBeVisible()
  })

  test('Actualiza nombres y correo exitosamente', async ({ page }) => {
    await openDetail(page)
    await page.fill('#user-firstName', 'Fabian')
    await page.fill('#user-email', 'fabian.updated@test.com')
    await fillRequiredContact(page)
    await page.click('button:has-text("Guardar cambios")')

    await expect(page.locator('text=Los datos se guardaron correctamente')).toBeVisible()
  })

  test('Cambia el rol desde la pestaña de acceso', async ({ page }) => {
    await openDetail(page)
    await page.click('#user-tab-acceso')

    const saveRole = page.locator('button:has-text("Guardar rol")')
    await expect(saveRole).toBeDisabled()

    await page.locator('input[name="roleId"]:not(:checked)').first().check({ force: true })
    await expect(saveRole).toBeEnabled()
    await saveRole.click()

    await expect(page.locator('text=El rol se actualizó correctamente')).toBeVisible()
  })

  test('El botón de guardar muestra estado de carga', async ({ page }) => {
    await openDetail(page)
    await page.fill('#user-firstName', 'Test')
    await fillRequiredContact(page)
    await page.click('button:has-text("Guardar cambios")')

    await expect(page.locator('button:has-text("Guardando...")')).toBeVisible()
  })

  test('El botón Desactivar abre el modal de confirmación', async ({ page }) => {
    await openDetail(page)

    const deactivate = page.locator('button:has-text("Desactivar usuario")')
    await expect(deactivate).toBeEnabled()
    await deactivate.click()
    await expect(page.locator('text=¿Desactivar esta cuenta?')).toBeVisible()

    await page.click('button:has-text("Cancelar")')
    await expect(page.locator('text=¿Desactivar esta cuenta?')).toBeHidden()
  })

  test('Redirige a login si no hay sesión', async ({ page }) => {
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear())
    await page.goto('/usuarios')

    await expect(page).toHaveURL(/\/login/)
  })
})
