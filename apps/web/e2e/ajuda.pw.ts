import { expect, test } from '@playwright/test'

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
