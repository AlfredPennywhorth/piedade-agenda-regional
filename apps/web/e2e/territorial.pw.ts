import { expect, test, type Page } from '@playwright/test'

const regionalId = '11111111-1111-4111-8111-111111111111'
const admId = '22222222-2222-4222-8222-222222222222'
const nomeLongo = 'Regional ' + 'SãoPaulo'.repeat(30)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pwa-ios-install-dismissed-at', String(Date.now()))
  })
})

async function dados(page: Page) {
  const regional = { id: regionalId, nome: nomeLongo, codigo: 'REG'.repeat(16), ativo: true }
  const adm = {
    id: admId,
    regionalId,
    nome: 'Administração ' + 'Osasco'.repeat(38),
    codigo: 'ADM'.repeat(16),
    ativo: true,
  }
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    const entity = path.startsWith('/administracoes') ? adm : regional
    if (route.request().method() === 'PATCH') Object.assign(entity, route.request().postDataJSON())
    await route.fulfill({
      json: path === '/regionais' ? [regional] : path === '/administracoes' ? [adm] : entity,
    })
  })
}

async function semCortes(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const button of await page.getByRole('button', { name: /^(Detalhes|Editar)$/ }).all()) {
    const box = await button.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
}

for (const tela of ['regionais', 'administracoes'] as const) {
  test(`${tela}: seis superfícies com cabeçalho real, nomes longos e ações sem cortes`, async ({
    page,
  }, info) => {
    await dados(page)
    await page.goto(`/e2e/territorial.html?tela=${tela}`)
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible()
    for (const width of [320, 360, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(
        page.getByRole('banner').getByRole('heading', { name: 'Agenda Regional SP' })
      ).toBeVisible()
      const logo = page.getByRole('banner').locator('img')
      expect(
        await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
      ).toBe(true)
      await semCortes(page)
      if (width === 390 || width === 1280) {
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: info.outputPath(`${tela}-${width}.png`), fullPage: true })
      }
      await page
        .getByRole('button', {
          name: tela === 'regionais' ? '+ Nova Regional' : '+ Nova Administração',
          exact: true,
        })
        .click()
      await expect(
        page.locator(tela === 'regionais' ? '#input-nome' : '#input-regional')
      ).toBeFocused()
      await semCortes(page)
      await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click()
      const editar = page.getByRole('button', { name: 'Editar', exact: true })
      await editar.click()
      const nome = page.getByLabel(
        tela === 'regionais' ? 'Nome da Regional' : 'Nome da Administração'
      )
      await expect(nome).toHaveValue(
        tela === 'regionais' ? nomeLongo : 'Administração ' + 'Osasco'.repeat(38)
      )
      await semCortes(page)
      await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click()
      await expect(editar).toBeFocused()
      await page.getByRole('button', { name: 'Detalhes', exact: true }).click()
      const dialog = page.getByRole('dialog', {
        name: tela === 'regionais' ? 'Detalhes da Regional' : 'Detalhes da Administração',
        exact: true,
      })
      await expect(dialog).toBeVisible()
      await expect(dialog).not.toContainText(regionalId)
      expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
      if (width === 390) {
        const ajuda = dialog.getByRole('button', { name: 'Ajuda desta tela' })
        await ajuda.click()
        const painel = page.getByRole('dialog', { name: 'Central de Ajuda' })
        await expect(painel).toBeVisible()
        await painel.getByRole('button', { name: 'Fechar ajuda' }).click()
        await expect(dialog).toBeVisible()
        await expect(ajuda).toBeFocused()
      }
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Detalhes', exact: true })).toBeFocused()
    }
  })

  test(`${tela}: salvar preserva payload, filtro e devolve foco ao registro`, async ({ page }) => {
    await dados(page)
    await page.goto(`/e2e/territorial.html?tela=${tela}`)
    if (tela === 'administracoes')
      await page.getByLabel('Filtrar por Regional:').selectOption(regionalId)
    await page.getByRole('button', { name: 'Editar', exact: true }).click()
    const nome = page.getByLabel(
      tela === 'regionais' ? 'Nome da Regional' : 'Nome da Administração'
    )
    await expect(nome).not.toHaveValue('')
    await nome.fill('Nome atualizado')
    const request = page.waitForRequest(r => r.method() === 'PATCH')
    await page
      .getByRole('button', {
        name: tela === 'regionais' ? 'Atualizar Regional' : 'Atualizar Administração',
        exact: true,
      })
      .click()
    expect((await request).postDataJSON()).toEqual({
      nome: 'Nome atualizado',
      codigo: (tela === 'regionais' ? 'REG' : 'ADM').repeat(16),
      ativo: true,
      ...(tela === 'administracoes' ? { regionalId } : {}),
    })
    await expect(page.getByRole('status')).toContainText('atualizada com sucesso')
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeFocused()
    if (tela === 'administracoes')
      await expect(page.getByLabel('Filtrar por Regional:')).toHaveValue(regionalId)
  })

  test(`${tela}: carregamento, erro e vazio permanecem legíveis`, async ({ page }) => {
    let liberar!: () => void
    const gate = new Promise<void>(resolve => {
      liberar = resolve
    })
    await page.route('**/api/v1/**', async route => {
      await gate
      await route.fulfill({ status: 500, json: { error: 'Falha de teste' } })
    })
    await page.goto(`/e2e/territorial.html?tela=${tela}`)
    await expect(
      page.getByText(`Carregando ${tela === 'regionais' ? 'regionais' : 'administrações'}...`, {
        exact: true,
      })
    ).toBeVisible()
    liberar()
    await expect(page.getByRole('alert')).toContainText('Falha de teste')
    await page.unroute('**/api/v1/**')
    await page.route('**/api/v1/**', route => route.fulfill({ json: [] }))
    await page.reload()
    await expect(
      page.getByText(
        tela === 'regionais'
          ? 'Nenhuma regional cadastrada até o momento.'
          : 'Nenhuma administração cadastrada até o momento.'
      )
    ).toBeVisible()
    await semCortes(page)
  })

  test(`${tela}: fechar detalhes durante a consulta ignora a resposta atrasada`, async ({
    page,
  }) => {
    await dados(page)
    let liberar!: () => void
    const gate = new Promise<void>(resolve => {
      liberar = resolve
    })
    const endpoint = tela === 'regionais' ? `/regionais/${regionalId}` : `/administracoes/${admId}`
    await page.route(`**/api/v1${endpoint}`, async route => {
      await gate
      await route.fulfill({
        json: {
          id: tela === 'regionais' ? regionalId : admId,
          nome: 'Resposta atrasada',
          regionalId,
          codigo: null,
          ativo: true,
        },
      })
    })
    await page.goto(`/e2e/territorial.html?tela=${tela}`)
    const origem = page.getByRole('button', { name: 'Detalhes', exact: true })
    await origem.click()
    await expect(page.getByText('Carregando detalhes...', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(origem).toBeFocused()
    const resposta = page.waitForResponse(r => r.url().endsWith(endpoint))
    liberar()
    await (await resposta).finished()
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('Resposta atrasada')).toHaveCount(0)
  })
}

test('Regionais em consulta não oferece criação ou edição', async ({ page }) => {
  await dados(page)
  await page.goto('/e2e/territorial.html?consulta=1')
  await expect(page.getByRole('button', { name: 'Detalhes', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ Nova Regional', exact: true })).toHaveCount(0)
})

test('Administração movida para outra Regional preserva filtro e retorna foco a Nova Administração', async ({
  page,
}) => {
  const outraRegional = '33333333-3333-4333-8333-333333333333'
  const adm = { id: admId, regionalId, nome: 'Administração teste', codigo: null, ativo: true }
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    if (route.request().method() === 'PATCH') Object.assign(adm, route.request().postDataJSON())
    await route.fulfill({
      json:
        path === '/regionais'
          ? [
              { id: regionalId, nome: 'Regional A', codigo: null, ativo: true },
              { id: outraRegional, nome: 'Regional B', codigo: null, ativo: true },
            ]
          : path === '/administracoes'
            ? [adm]
            : adm,
    })
  })
  await page.goto('/e2e/territorial.html?tela=administracoes')
  await page.getByLabel('Filtrar por Regional:').selectOption(regionalId)
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(page.locator('#input-regional')).toHaveValue(regionalId)
  await page.locator('#input-regional').selectOption(outraRegional)
  await page.getByRole('button', { name: 'Atualizar Administração', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('atualizada com sucesso')
  await expect(page.getByLabel('Filtrar por Regional:')).toHaveValue(regionalId)
  await expect(
    page.getByText('Nenhuma administração encontrada para a regional selecionada.')
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '+ Nova Administração', exact: true })
  ).toBeFocused()
})
