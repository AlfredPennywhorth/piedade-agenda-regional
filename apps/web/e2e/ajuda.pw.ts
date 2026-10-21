import { expect, test, type Locator } from '@playwright/test'

async function contrasteTexto(botao: Locator) {
  return botao.evaluate(elemento => {
    const estilo = getComputedStyle(elemento)
    const luminancia = (cor: string) => {
      const canais = cor
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map(v => {
          const c = v / 255
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        })
      return canais[0] * 0.2126 + canais[1] * 0.7152 + canais[2] * 0.0722
    }
    const frente = luminancia(estilo.color)
    const fundo = luminancia(estilo.backgroundColor)
    return (Math.max(frente, fundo) + 0.05) / (Math.min(frente, fundo) + 0.05)
  })
}

test('ajuda sobre formulário real mantém dados, foco e busca em viewport responsivo', async ({
  page,
}, testInfo) => {
  page.on('pageerror', error => {
    throw error
  })
  await page.route('**/api/v1/**', route =>
    route.fulfill({
      json: route.request().url().endsWith('/escopos-autorizados')
        ? { master: true, escopos: [] }
        : [],
    })
  )
  await page.goto('/e2e/ajuda.html')
  await page.getByRole('button', { name: '+ Novo Local' }).click()
  const nome = page.getByRole('textbox', { name: 'Nome *', exact: true })
  await nome.fill('Local de teste sem gravação')
  const ajuda = page.getByRole('button', { name: 'Ajuda desta tela' })
  await ajuda.click()
  const painel = page.getByRole('dialog', { name: 'Central de Ajuda' })
  await expect(painel.getByRole('heading', { name: 'Locais e Espaços' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('ajuda.png') })
  const box = await painel.boundingBox()
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.keyboard.press('Escape')
  await expect(painel).not.toBeVisible()
  await expect(nome).toHaveValue('Local de teste sem gravação')
  await expect(ajuda).toBeFocused()
  await ajuda.click()
  await painel.getByRole('searchbox').fill('agd-adm-058')
  await painel.getByRole('button', { name: /Locais e Espaços/ }).click()
  await expect(painel.getByRole('heading', { name: 'Locais e Espaços' })).toBeVisible()
  await painel.getByRole('button', { name: 'Fechar ajuda' }).click()
  await expect(nome).toHaveValue('Local de teste sem gravação')
})

for (const tela of ['eventos', 'convocacoes'] as const) {
  test(`ajuda em ${tela} retorna à central e preserva o formulário real`, async ({ page }) => {
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname
      const json = path.endsWith('/auth/me')
        ? { id: 'gestor-teste', nome: 'Gestor fictício' }
        : path.endsWith('/eventos/filtros')
          ? { master: false, pessoas: [] }
          : []
      return route.fulfill({ json })
    })
    await page.goto(`/e2e/ajuda.html?tela=${tela}`)
    expect(
      await contrasteTexto(page.getByRole('button', { name: 'Ajuda', exact: true }))
    ).toBeGreaterThanOrEqual(4.5)
    await page.getByRole('button', { name: 'Ajuda', exact: true }).click()
    let painel = page.getByRole('dialog', { name: 'Central de Ajuda' })
    await expect(painel.getByRole('heading', { level: 3 })).toContainText(
      tela === 'eventos' ? 'Eventos' : 'Convocações'
    )
    await painel.getByRole('button', { name: 'Fechar ajuda' }).click()
    await page
      .getByRole('button', {
        name: tela === 'eventos' ? '+ Novo Evento' : 'Nova Convocação',
        exact: true,
      })
      .click()
    const campo =
      tela === 'eventos' ? page.getByLabel('Título *', { exact: true }) : page.locator('textarea')
    await campo.fill('Rascunho preservado durante consulta')
    const botao = page.getByRole('button', { name: 'Ajuda desta tela', exact: true })
    await botao.click()
    painel = page.getByRole('dialog', { name: 'Central de Ajuda' })
    await painel.getByRole('searchbox').fill('agd-adm-033')
    await painel.getByRole('button', { name: /Convocações —/ }).click()
    expect(
      await contrasteTexto(painel.getByRole('button', { name: 'Voltar à Central de Ajuda' }))
    ).toBeGreaterThanOrEqual(4.5)
    await painel.getByRole('button', { name: 'Voltar à Central de Ajuda' }).click()
    await expect(painel.getByRole('searchbox')).toHaveValue('')
    await expect(painel.getByRole('searchbox')).toBeFocused()
    await expect(painel.getByRole('button', { name: /Eventos —/ })).toBeVisible()
    await expect(painel.getByRole('button', { name: /Convocações —/ })).toBeVisible()
    await painel.getByRole('button', { name: 'Fechar ajuda' }).click()
    await expect(campo).toHaveValue('Rascunho preservado durante consulta')
    await expect(botao).toBeFocused()
  })
}
