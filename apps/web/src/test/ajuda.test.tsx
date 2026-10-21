import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { MainLayout } from '../components/layout/MainLayout'
import { AjudaContextual } from '../components/ajuda/AjudaContextual'
import { obterArtigos, pesquisarArtigos } from '../components/ajuda/artigos'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})

describe('Central de Ajuda', () => {
  it('abre no Mais sem navegar e preserva dados digitados e foco', () => {
    const navegar = vi.fn()
    render(
      <MainLayout currentTab="agenda" onTabChange={navegar}>
        <input aria-label="Rascunho" defaultValue="" />
      </MainLayout>
    )
    fireEvent.change(screen.getByLabelText('Rascunho'), { target: { value: 'não perder' } })
    fireEvent.click(screen.getByRole('button', { name: /Mais$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Central de Ajuda' }))
    expect(screen.getByRole('dialog', { name: 'Central de Ajuda' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Contas e Acessos/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar ajuda' }))
    expect(screen.getByLabelText('Rascunho')).toHaveValue('não perder')
    expect(navegar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Mais$/ })).toHaveFocus()
  })

  it.each([
    ['eventos', 'podeGerirAgenda', 'Eventos'],
    ['convocacoes', 'podeGerirAgenda', 'Convocações'],
    ['regionais', 'podeAdministrarEstrutura', 'Regionais'],
    ['administracoes', 'podeAdministrarEstrutura', 'Administrações'],
    ['setores', 'podeAdministrarEstrutura', 'Setores'],
    ['casas', 'podeAdministrarEstrutura', 'Casas de Oração'],
    ['locais', 'podeGerirAgenda', 'Locais e Espaços'],
    ['membros', 'podeAdministrarPessoas', 'Membros'],
    ['funcoes', 'podeAdministrarFuncoes', 'Funções'],
    ['vinculos-funcionais', 'podeAdministrarPessoas', 'Vínculos Funcionais'],
    ['acessos', 'podeAdministrarAcessos', 'Contas e Acessos'],
  ] as const)('abre ajuda contextual de %s sem desmontar formulário', (tab, capacidade, titulo) => {
    render(
      <MainLayout currentTab={tab} capacidades={{ [capacidade]: true }} onTabChange={vi.fn()}>
        <input aria-label="Nome" defaultValue="rascunho" />
        <AjudaContextual />
      </MainLayout>
    )
    const botao = screen.getByRole('button', { name: 'Ajuda' })
    botao.focus()
    fireEvent.click(botao)
    expect(within(screen.getByRole('dialog')).getByRole('heading', { level: 3 })).toHaveTextContent(
      titulo
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fechar ajuda' }))
    expect(botao).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Ajuda desta tela' }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('rascunho')
  })

  it('pesquisa códigos e texto sem acentos e mostra estado vazio', () => {
    render(
      <MainLayout
        currentTab="agenda"
        capacidades={{ podeAdministrarPessoas: true }}
        onTabChange={vi.fn()}
      >
        <div />
      </MainLayout>
    )
    fireEvent.click(screen.getByRole('button', { name: /Mais$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Central de Ajuda' }))
    const busca = screen.getByRole('searchbox')
    fireEvent.change(busca, { target: { value: 'agd-adm-053' } })
    fireEvent.click(screen.getByRole('button', { name: /Vínculos Funcionais/ }))
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Vínculos Funcionais')
    fireEvent.change(busca, { target: { value: 'inexistente-xyz' } })
    expect(screen.getByText(/Nenhum assunto encontrado/)).toBeInTheDocument()
    expect(
      pesquisarArtigos(obterArtigos({ podeAdministrarPessoas: true }), 'vinculos funcionais')
    ).toHaveLength(1)
  })

  it('volta à central limpando a busca sem fechar ajuda nem perder formulário', () => {
    const navegar = vi.fn()
    render(
      <MainLayout
        currentTab="eventos"
        capacidades={{ podeGerirAgenda: true }}
        onTabChange={navegar}
      >
        <input aria-label="Rascunho" defaultValue="reunião em elaboração" />
      </MainLayout>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ajuda' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'AGD-ADM-033' } })
    fireEvent.click(screen.getByRole('button', { name: /Convocações —/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à Central de Ajuda' }))
    expect(screen.getByRole('dialog', { name: 'Central de Ajuda' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('searchbox')).toHaveFocus()
    expect(screen.getByRole('button', { name: /Eventos —/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Convocações —/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Rascunho')).toHaveValue('reunião em elaboração')
    expect(navegar).not.toHaveBeenCalled()
  })

  it('filtra antes de pesquisar e separa instruções exclusivas do Master', () => {
    expect(pesquisarArtigos(obterArtigos(), 'AGD-ADM-015')).toHaveLength(0)
    expect(pesquisarArtigos(obterArtigos(), 'AGD-ADM-016')).toHaveLength(0)
    expect(pesquisarArtigos(obterArtigos(), 'AGD-ADM-033')).toHaveLength(0)
    const regional = obterArtigos({ podeAdministrarEstrutura: true, podeAdministrarAcessos: true })
    expect(regional.find(a => a.id === 'regionais')?.passos.join(' ')).toContain(
      'exclusivas do Master'
    )
    expect(regional.find(a => a.id === 'acessos')?.passos.join(' ')).not.toContain('Sessões ativas')
    const master = obterArtigos({ podeAdministrarAcessos: true, podeGerenciarSessoes: true })
    expect(master.find(a => a.id === 'acessos')?.passos.join(' ')).toContain('Sessões ativas')
  })
})
