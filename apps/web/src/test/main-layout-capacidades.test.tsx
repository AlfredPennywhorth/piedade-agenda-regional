import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MainLayout } from '../components/layout/MainLayout'

describe('MainLayout — capabilities', () => {
  it('oculta módulos administrativos quando o usuário não possui capacidade', () => {
    render(
      <MainLayout
        currentTab="agenda"
        onTabChange={vi.fn()}
        capacidades={{
          podeGerirAgenda: false,
          podeAdministrarEstrutura: false,
          podeAdministrarPessoas: false,
          podeAdministrarAcessos: false,
        }}
      >
        <div>Conteúdo</div>
      </MainLayout>
    )

    expect(screen.queryByRole('button', { name: 'Eventos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Convocações' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mais' }))

    expect(screen.queryByRole('button', { name: 'Regionais' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Membros' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acessos' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Meu Cadastro' })).toBeInTheDocument()
  })

  it('exibe módulos permitidos para usuário com capacidades administrativas', () => {
    render(
      <MainLayout
        currentTab="agenda"
        onTabChange={vi.fn()}
        capacidades={{
          podeGerirAgenda: true,
          podeAdministrarEstrutura: true,
          podeAdministrarPessoas: true,
          podeAdministrarAcessos: true,
        }}
      >
        <div>Conteúdo</div>
      </MainLayout>
    )

    expect(screen.getByRole('button', { name: 'Eventos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Convocações' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mais' }))

    expect(screen.getByRole('button', { name: 'Regionais' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Membros' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acessos' })).toBeInTheDocument()
  })
})
