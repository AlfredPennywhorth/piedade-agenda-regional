import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MainLayout } from '../components/layout/MainLayout'

describe('MainLayout — navegação móvel', () => {
  it('abre o menu Mais e permite acessar módulos administrativos', () => {
    const onTabChange = vi.fn()

    render(
      <MainLayout
        currentTab="agenda"
        onTabChange={onTabChange}
        capacidades={{
          podeVisualizarRelatorios: true,
          podeAdministrarAcessos: true,
        }}
        nomeUsuario="Usuário Teste"
      >
        <div>Conteúdo</div>
      </MainLayout>
    )

    fireEvent.click(screen.getByRole('button', { name: /mais/i }))

    const dialog = screen.getByRole('dialog', { name: /mais opções/i })
    const menu = within(dialog)
    expect(dialog).toBeInTheDocument()
    expect(menu.getByRole('button', { name: 'Locais' })).toBeInTheDocument()
    expect(menu.getByRole('button', { name: 'Membros' })).toBeInTheDocument()
    expect(menu.getByRole('button', { name: 'Meu Cadastro' })).toBeInTheDocument()

    fireEvent.click(menu.getByRole('button', { name: 'Locais' }))
    expect(onTabChange).toHaveBeenCalledWith('locais')
    expect(screen.queryByRole('dialog', { name: /mais opções/i })).not.toBeInTheDocument()
  })

  it('não mostra opções condicionais sem capacidade', () => {
    render(
      <MainLayout currentTab="agenda" onTabChange={vi.fn()} capacidades={{}}>
        <div>Conteúdo</div>
      </MainLayout>
    )

    fireEvent.click(screen.getByRole('button', { name: /mais/i }))

    const menu = within(screen.getByRole('dialog', { name: /mais opções/i }))
    expect(menu.queryByRole('button', { name: 'Relatórios' })).not.toBeInTheDocument()
    expect(menu.queryByRole('button', { name: 'Acessos' })).not.toBeInTheDocument()
    expect(menu.queryByRole('button', { name: 'Portaria' })).not.toBeInTheDocument()
  })
})
