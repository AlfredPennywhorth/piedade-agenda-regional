import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MainLayout } from '../components/layout/MainLayout'

describe('MainLayout — navegação móvel', () => {
  it('exibe código estável da tela atual', () => {
    const { rerender } = render(
      <MainLayout currentTab="agenda" onTabChange={vi.fn()} capacidades={{}}>
        <div>Conteúdo</div>
      </MainLayout>
    )

    expect(screen.getByLabelText('Código da tela AGD-MOB-001')).toHaveTextContent('Tela AGD-MOB-001')

    rerender(
      <MainLayout currentTab="membros" onTabChange={vi.fn()} capacidades={{}}>
        <div>Conteúdo</div>
      </MainLayout>
    )

    expect(screen.getByLabelText('Código da tela AGD-ADM-010')).toHaveTextContent('Tela AGD-ADM-010')
  })

  it('aplica safe areas no cabeçalho, conteúdo e navegação móvel', () => {
    const { container } = render(
      <MainLayout currentTab="agenda" onTabChange={vi.fn()} capacidades={{}}>
        <div>Conteúdo</div>
      </MainLayout>
    )

    const root = container.firstElementChild as HTMLElement
    const header = container.querySelector('header') as HTMLElement
    const nav = screen.getByRole('navigation', { name: /navegação móvel principal/i })

    expect(root.style.paddingBottom).toContain('env(safe-area-inset-bottom)')
    expect(header.style.paddingTop).toContain('env(safe-area-inset-top)')
    expect(nav.getAttribute('style')).toContain('safe-area-inset-bottom')
  })

  it('abre o menu Mais e permite acessar módulos administrativos', () => {
    const onTabChange = vi.fn()

    render(
      <MainLayout
        currentTab="agenda"
        onTabChange={onTabChange}
        capacidades={{
          podeVisualizarRelatorios: true,
          podeAdministrarAcessos: true,
          podeAdministrarEstrutura: true,
          podeAdministrarPessoas: true,
          podeGerirAgenda: true,
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

  it('mantém Mais ativo para módulos agrupados e move o foco para o menu', async () => {
    render(
      <MainLayout currentTab="series" onTabChange={vi.fn()} capacidades={{}}>
        <div>Conteúdo</div>
      </MainLayout>
    )

    const botaoMais = screen.getByRole('button', { name: /mais/i })
    expect(botaoMais.className).toContain('text-brand-600')

    fireEvent.click(botaoMais)
    const fechar = screen.getByRole('button', { name: /fechar menu/i })
    await waitFor(() => expect(fechar).toHaveFocus())

    fireEvent.click(fechar)
    await waitFor(() => expect(botaoMais).toHaveFocus())
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
