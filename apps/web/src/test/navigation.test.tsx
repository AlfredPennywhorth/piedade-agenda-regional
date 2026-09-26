import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MainLayout } from '../components/layout/MainLayout'

describe('Navegação e Visibilidade de Permissões — S12 Frontend', () => {
  it('1. Usuário comum (sem capacidades) NÃO vê Portaria, Relatórios nem Auditoria', () => {
    render(
      <MainLayout
        currentTab="agenda"
        onTabChange={() => {}}
        capacidades={{ podeOperarPortaria: false, podeVisualizarRelatorios: false, podeVisualizarAuditoria: false }}
      >
        <div>Conteúdo Principal</div>
      </MainLayout>
    )

    const nav = within(screen.getByRole('navigation', { name: /navegação móvel principal/i }))
    expect(nav.getByRole('button', { name: /Minha Agenda/i })).toBeDefined()
    expect(nav.getByRole('button', { name: /Calendário/i })).toBeDefined()

    fireEvent.click(nav.getByRole('button', { name: /Mais/i }))
    const menu = within(screen.getByRole('dialog', { name: /mais opções/i }))
    expect(menu.getByRole('button', { name: /Avisos/i })).toBeDefined()
    expect(menu.getByRole('button', { name: /Meu Cadastro/i })).toBeDefined()
    expect(menu.queryByRole('button', { name: /Portaria/i })).toBeNull()
    expect(menu.queryByRole('button', { name: /Relatórios/i })).toBeNull()
    expect(menu.queryByRole('button', { name: /Auditoria/i })).toBeNull()
  })

  it('2. OPERADOR_PORTARIA vê Portaria, mas NÃO vê Relatórios nem Auditoria', () => {
    render(
      <MainLayout
        currentTab="portaria"
        onTabChange={() => {}}
        capacidades={{ podeOperarPortaria: true, podeVisualizarRelatorios: false, podeVisualizarAuditoria: false }}
      >
        <div>Conteúdo Principal</div>
      </MainLayout>
    )

    const nav = within(screen.getByRole('navigation', { name: /navegação móvel principal/i }))
    fireEvent.click(nav.getByRole('button', { name: /Mais/i }))
    const menu = within(screen.getByRole('dialog', { name: /mais opções/i }))
    expect(menu.getByRole('button', { name: /Portaria/i })).toBeDefined()
    expect(menu.queryByRole('button', { name: /Relatórios/i })).toBeNull()
    expect(menu.queryByRole('button', { name: /Auditoria/i })).toBeNull()
  })

  it('3. GESTOR_RELATORIOS isolado vê Relatórios, mas NÃO vê Portaria nem Auditoria', () => {
    render(
      <MainLayout
        currentTab="relatorios"
        onTabChange={() => {}}
        capacidades={{ podeOperarPortaria: false, podeVisualizarRelatorios: true, podeVisualizarAuditoria: false }}
      >
        <div>Conteúdo Principal</div>
      </MainLayout>
    )

    const nav = within(screen.getByRole('navigation', { name: /navegação móvel principal/i }))
    fireEvent.click(nav.getByRole('button', { name: /Mais/i }))
    const menu = within(screen.getByRole('dialog', { name: /mais opções/i }))
    expect(menu.getByRole('button', { name: /Relatórios/i })).toBeDefined()
    expect(menu.queryByRole('button', { name: /Portaria/i })).toBeNull()
    expect(menu.queryByRole('button', { name: /Auditoria/i })).toBeNull()
  })

  it('4. AUDITOR_SISTEMA isolado vê Auditoria, mas NÃO vê Portaria nem Relatórios', () => {
    render(
      <MainLayout
        currentTab="auditoria"
        onTabChange={() => {}}
        capacidades={{ podeOperarPortaria: false, podeVisualizarAuditoria: true, podeVisualizarRelatorios: false }}
      >
        <div>Conteúdo Principal</div>
      </MainLayout>
    )

    const nav = within(screen.getByRole('navigation', { name: /navegação móvel principal/i }))
    fireEvent.click(nav.getByRole('button', { name: /Mais/i }))
    const menu = within(screen.getByRole('dialog', { name: /mais opções/i }))
    expect(menu.getByRole('button', { name: /Auditoria/i })).toBeDefined()
    expect(menu.queryByRole('button', { name: /Portaria/i })).toBeNull()
    expect(menu.queryByRole('button', { name: /Relatórios/i })).toBeNull()
  })

  it('5. Membro com múltiplas funções (Portaria + Relatórios) vê Portaria e Relatórios, mas NÃO vê Auditoria', () => {
    render(
      <MainLayout
        currentTab="agenda"
        onTabChange={() => {}}
        capacidades={{ podeOperarPortaria: true, podeVisualizarRelatorios: true, podeVisualizarAuditoria: false }}
      >
        <div>Conteúdo Principal</div>
      </MainLayout>
    )

    const nav = within(screen.getByRole('navigation', { name: /navegação móvel principal/i }))
    fireEvent.click(nav.getByRole('button', { name: /Mais/i }))
    const menu = within(screen.getByRole('dialog', { name: /mais opções/i }))
    expect(menu.getByRole('button', { name: /Portaria/i })).toBeDefined()
    expect(menu.getByRole('button', { name: /Relatórios/i })).toBeDefined()
    expect(menu.queryByRole('button', { name: /Auditoria/i })).toBeNull()
  })
})


  it('6. identifica a aba principal ativa com aria-current', () => {
    render(
      <MainLayout currentTab="agenda" onTabChange={() => {}} capacidades={{}}>
        <div>Conteúdo Principal</div>
      </MainLayout>
    )

    const nav = within(screen.getByRole('navigation', { name: /navegação móvel principal/i }))
    expect(nav.getByRole('button', { name: /Minha Agenda/i })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('button', { name: /Calendário/i })).not.toHaveAttribute('aria-current')
  })

  it('7. move o foco para o conteúdo principal ao trocar de módulo', () => {
    const { rerender } = render(
      <MainLayout currentTab="agenda" onTabChange={() => {}} capacidades={{}}>
        <div>Agenda</div>
      </MainLayout>
    )

    const main = screen.getByRole('main', { name: /conteúdo principal/i })
    expect(main).not.toHaveFocus()

    rerender(
      <MainLayout currentTab="calendario" onTabChange={() => {}} capacidades={{}}>
        <div>Calendário</div>
      </MainLayout>
    )

    expect(main).toHaveFocus()
  })

  it('8. oferece link de salto para o conteúdo principal', () => {
    render(
      <MainLayout currentTab="agenda" onTabChange={() => {}} capacidades={{}}>
        <div>Agenda</div>
      </MainLayout>
    )

    expect(screen.getByRole('link', { name: /ir para o conteúdo principal/i }))
      .toHaveAttribute('href', '#conteudo-principal')
  })
})
