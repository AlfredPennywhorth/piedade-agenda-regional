import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MainLayout } from '../components/layout/MainLayout'

describe('Navegação e Visibilidade de Permissões — S12 Frontend', () => {
  it('1. Usuário comum (sem permissões) não vê Relatórios nem Auditoria, mas vê navegação baseline (Agenda, Calendário, Portaria, Avisos, Meu Cadastro)', () => {
    render(
      <MainLayout
        currentTab="agenda"
        onTabChange={() => {}}
        capacidades={{ podeVisualizarRelatorios: false, podeVisualizarAuditoria: false, podeOperarPortaria: false }}
      >
        <div>Conteúdo Principal</div>
      </MainLayout>
    )

    expect(screen.getByRole('button', { name: /Minha Agenda/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Calendário/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Portaria/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Avisos/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Meu Cadastro/i })).toBeDefined()

    expect(screen.queryByRole('button', { name: /Relatórios/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Auditoria/i })).toBeNull()
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

    expect(screen.getByRole('button', { name: /Portaria/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Relatórios/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Auditoria/i })).toBeNull()
  })

  it('3. Gestor autorizado vê Relatórios, mas NÃO vê Auditoria', () => {
    render(
      <MainLayout
        currentTab="relatorios"
        onTabChange={() => {}}
        capacidades={{ podeVisualizarRelatorios: true, podeVisualizarAuditoria: false }}
      >
        <div>Conteúdo Principal</div>
      </MainLayout>
    )

    expect(screen.getByRole('button', { name: /Relatórios/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Auditoria/i })).toBeNull()
  })

  it('4. Auditor autorizado vê Auditoria, mas NÃO vê Relatórios se não for gestor', () => {
    render(
      <MainLayout
        currentTab="auditoria"
        onTabChange={() => {}}
        capacidades={{ podeVisualizarAuditoria: true, podeVisualizarRelatorios: false }}
      >
        <div>Conteúdo Principal</div>
      </MainLayout>
    )

    expect(screen.getByRole('button', { name: /Auditoria/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Relatórios/i })).toBeNull()
  })
})
