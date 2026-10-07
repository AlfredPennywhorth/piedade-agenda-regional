import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ContasAcessoView } from '../components/acessos/ContasAcessoView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  postWithAuth: vi.fn(),
  patchWithAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    body: unknown
    constructor(status: number, message: string, body: unknown) {
      super(message)
      this.status = status
      this.body = body
    }
  },
}))

const contaAtiva = {
  membroId: 'membro-1',
  nome: 'Pessoa Teste',
  celular: '11999990000',
  codigoCarteirinha: 'CARTEIRA-1',
  dataOrdenacao: '2000-01-01',
  regionalId: 'regional-1',
  casaId: 'casa-1',
  contaAcessoId: 'conta-1',
  status: 'ATIVA',
  ativadoEm: '2026-01-01T00:00:00.000Z',
  acessos: [
    {
      id: 'acesso-1',
      perfilCodigo: 'USUARIO_COMUM',
      escopoTipo: 'CASA',
      escopoId: 'casa-1',
    },
    {
      id: 'acesso-2',
      perfilCodigo: 'GESTOR_AGENDA',
      escopoTipo: 'REGIONAL',
      escopoId: 'regional-1',
    },
  ],
}

describe('ContasAcessoView — PR-ACC-05', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/admin/acessos') return [contaAtiva] as any
      return [] as any
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'open').mockImplementation(() => null)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('lista somente os dados administrativos retornados pela API', async () => {
    render(<ContasAcessoView />)

    expect(await screen.findByText('Pessoa Teste')).toBeDefined()
    expect(screen.getByText('11999990000')).toBeDefined()
    expect(screen.getByText(/CARTEIRA-1/)).toBeDefined()
    expect(screen.getByText(/USUARIO_COMUM/)).toBeDefined()
    expect(apiClient.fetchWithAuth).toHaveBeenCalledWith('/admin/acessos')
  })

  it('filtra contas por hierarquia geográfica e status', async () => {
    const outraConta = {
      ...contaAtiva,
      membroId: 'membro-2',
      nome: 'Pessoa Bloqueada',
      contaAcessoId: 'conta-2',
      status: 'BLOQUEADA',
      casaId: 'casa-2',
      acessos: [],
    }
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/admin/acessos') return [contaAtiva, outraConta] as any
      if (endpoint === '/regionais') return [
        { id: 'regional-1', nome: 'Regional 1' },
        { id: 'regional-2', nome: 'Regional 2' },
      ] as any
      if (endpoint === '/administracoes') return [
        { id: 'adm-1', nome: 'Administração 1', regionalId: 'regional-1' },
        { id: 'adm-2', nome: 'Administração 2', regionalId: 'regional-2' },
      ] as any
      if (endpoint === '/setores') return [
        { id: 'setor-1', nome: 'Setor 1', administracaoId: 'adm-1' },
        { id: 'setor-2', nome: 'Setor 2', administracaoId: 'adm-2' },
      ] as any
      if (endpoint === '/casas') return [
        { id: 'casa-1', nome: 'Casa 1', setorId: 'setor-1' },
        { id: 'casa-2', nome: 'Casa 2', setorId: 'setor-2' },
      ] as any
      return [] as any
    })

    render(<ContasAcessoView />)
    expect(await screen.findByText('Pessoa Teste')).toBeDefined()
    expect(screen.getByText('Pessoa Bloqueada')).toBeDefined()

    fireEvent.change(screen.getByLabelText('Filtrar por Regional'), {
      target: { value: 'regional-1' },
    })
    expect(screen.getByText('Pessoa Teste')).toBeDefined()
    expect(screen.queryByText('Pessoa Bloqueada')).toBeNull()

    fireEvent.change(screen.getByLabelText('Filtrar por Status'), {
      target: { value: 'BLOQUEADA' },
    })
    expect(screen.queryByText('Pessoa Teste')).toBeNull()
    expect(screen.getByText('Nenhuma conta corresponde aos filtros selecionados.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText('Pessoa Bloqueada')).toBeDefined()
  })

  it('confirma o bloqueio e atualiza a listagem', async () => {
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue({
      membroId: 'membro-1',
      contaAcessoId: 'conta-1',
      status: 'BLOQUEADA',
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Bloquear' }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(
        '/admin/acessos/membros/membro-1/status',
        { status: 'BLOQUEADA' }
      )
    })
    expect(window.confirm).toHaveBeenCalled()
    expect(await screen.findByText('Conta bloqueada e sessões revogadas.')).toBeDefined()
  })

  it('gera link temporário de redefinição sem persistir o token no cliente', async () => {
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      token: 'token-temporario',
      expiraEm: '2099-01-01T00:00:00.000Z',
      membroId: 'membro-1',
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir PIN' }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith(
        '/admin/acessos/membros/membro-1/reset-pin',
        {}
      )
    })
    const campo = await screen.findByLabelText('Link temporário de Pessoa Teste')
    expect((campo as HTMLInputElement).value).toContain('ativacao=token-temporario')
    expect(localStorage.getItem('token-temporario')).toBeNull()
  })

  it('exibe o link e o feedback junto da conta em que a ação foi executada', async () => {
    const outraConta = {
      ...contaAtiva,
      membroId: 'membro-2',
      nome: 'Outra Pessoa',
      codigoCarteirinha: 'CARTEIRA-2',
      contaAcessoId: 'conta-2',
      acessos: [],
    }
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([contaAtiva, outraConta])
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      token: 'token-contextual',
      expiraEm: '2099-01-01T00:00:00.000Z',
      membroId: 'membro-2',
    })

    render(<ContasAcessoView podeGerenciarSessoes />)

    const artigoOutraPessoa = (await screen.findByText('Outra Pessoa')).closest('article')
    expect(artigoOutraPessoa).not.toBeNull()
    fireEvent.click(within(artigoOutraPessoa!).getByRole('button', { name: 'Redefinir PIN' }))

    const campo = await within(artigoOutraPessoa!).findByLabelText('Link temporário de Outra Pessoa')
    expect((campo as HTMLInputElement).value).toContain('ativacao=token-contextual')

    const artigoPessoaTeste = screen.getByText('Pessoa Teste').closest('article')
    expect(artigoPessoaTeste).not.toBeNull()
    expect(within(artigoPessoaTeste!).queryByText('Link temporário gerado')).toBeNull()
  })

  it('preserva link temporário ao executar ação não relacionada em outra conta', async () => {
    const outraConta = {
      ...contaAtiva,
      membroId: 'membro-2',
      nome: 'Outra Pessoa',
      codigoCarteirinha: 'CARTEIRA-2',
      contaAcessoId: 'conta-2',
      acessos: [],
    }
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([contaAtiva, outraConta])
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      token: 'token-preservado',
      expiraEm: '2099-01-01T00:00:00.000Z',
      membroId: 'membro-1',
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue({
      membroId: 'membro-2',
      contaAcessoId: 'conta-2',
      status: 'BLOQUEADA',
    })

    render(<ContasAcessoView />)

    const artigoPessoaTeste = (await screen.findByText('Pessoa Teste')).closest('article')
    const artigoOutraPessoa = screen.getByText('Outra Pessoa').closest('article')
    expect(artigoPessoaTeste).not.toBeNull()
    expect(artigoOutraPessoa).not.toBeNull()

    fireEvent.click(within(artigoPessoaTeste!).getByRole('button', { name: 'Redefinir PIN' }))
    const campo = await within(artigoPessoaTeste!).findByLabelText('Link temporário de Pessoa Teste')
    expect((campo as HTMLInputElement).value).toContain('ativacao=token-preservado')

    fireEvent.click(within(artigoOutraPessoa!).getByRole('button', { name: 'Bloquear' }))

    expect(
      await within(artigoOutraPessoa!).findByText('Conta bloqueada e sessões revogadas.')
    ).toBeDefined()
    expect(
      within(artigoPessoaTeste!).getByLabelText('Link temporário de Pessoa Teste')
    ).toBeDefined()
  })

  it('abre o WhatsApp Web com telefone, link, validade e orientação de segurança', async () => {
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      token: 'token-whatsapp',
      expiraEm: '2099-01-01T12:30:00.000Z',
      membroId: 'membro-1',
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir PIN' }))

    await screen.findByLabelText('Link temporário de Pessoa Teste')
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pelo WhatsApp' }))

    expect(window.open).toHaveBeenCalledTimes(1)
    const [url, alvo, recursos] = vi.mocked(window.open).mock.calls[0]
    expect(alvo).toBe('_blank')
    expect(recursos).toBe('noopener,noreferrer')

    const destino = new URL(String(url))
    expect(destino.origin).toBe('https://web.whatsapp.com')
    expect(destino.pathname).toBe('/send')
    expect(destino.searchParams.get('phone')).toBe('5511999990000')

    const mensagem = destino.searchParams.get('text') || ''
    expect(mensagem).toContain('Caro irmão Pessoa Teste.')
    expect(mensagem).toContain('A paz de Deus!')
    expect(mensagem).toContain('ativacao=token-whatsapp')
    expect(mensagem).toContain('válido até')
    expect(mensagem).toContain('horário de São Paulo')
    expect(mensagem).toContain('não compartilhe')
  })

  it('distingue ativação de conta na mensagem do WhatsApp', async () => {
    const contaSemAcesso = {
      ...contaAtiva,
      contaAcessoId: null,
      status: null,
      acessos: [],
    }
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([contaSemAcesso])
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      token: 'token-ativacao',
      expiraEm: '2099-01-01T12:30:00.000Z',
      membroId: 'membro-1',
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar ativação' }))

    await screen.findByLabelText('Link temporário de Pessoa Teste')
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pelo WhatsApp' }))

    const [url] = vi.mocked(window.open).mock.calls[0]
    const destino = new URL(String(url))
    const mensagem = destino.searchParams.get('text') || ''

    expect(mensagem).toContain('ativação da sua conta')
    expect(mensagem).toContain('criar seu PIN')
    expect(mensagem).not.toContain('redefinição do seu PIN')
  })

  it('bloqueia envio pelo WhatsApp quando o celular é malformado', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([
      { ...contaAtiva, celular: '123' },
    ])
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      token: 'token-celular-invalido',
      expiraEm: '2099-01-01T12:30:00.000Z',
      membroId: 'membro-1',
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir PIN' }))
    await screen.findByLabelText('Link temporário de Pessoa Teste')

    fireEvent.click(screen.getByRole('button', { name: 'Enviar pelo WhatsApp' }))

    expect(window.open).not.toHaveBeenCalled()
    expect(await screen.findByText('O celular informado não é válido para envio pelo WhatsApp.')).toBeDefined()
    expect(screen.getByLabelText('Link temporário de Pessoa Teste')).toBeDefined()
  })

  it('não oferece envio pelo WhatsApp sem celular válido e mantém o link disponível', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([
      { ...contaAtiva, celular: null },
    ])
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      token: 'token-sem-celular',
      expiraEm: '2099-01-01T12:30:00.000Z',
      membroId: 'membro-1',
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir PIN' }))
    await screen.findByLabelText('Link temporário de Pessoa Teste')

    fireEvent.click(screen.getByRole('button', { name: 'Enviar pelo WhatsApp' }))

    expect(window.open).not.toHaveBeenCalled()
    expect(await screen.findByText('Cadastre um celular antes de enviar o link pelo WhatsApp.')).toBeDefined()
    expect(screen.getByLabelText('Link temporário de Pessoa Teste')).toBeDefined()
  })

  it('não redefine PIN quando a confirmação é cancelada', async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false)

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir PIN' }))

    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Redefinir o PIN de Pessoa Teste?')
    )
  })


  it('oculta gestão de sessões quando o operador não é Master', async () => {
    render(<ContasAcessoView />)

    await screen.findByText('Pessoa Teste')
    expect(screen.queryByRole('button', { name: 'Sessões ativas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Revogar todas' })).toBeNull()
  })

  it('lista sessões ativas e revoga somente a sessão escolhida', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/admin/acessos') return [contaAtiva] as any
      if (endpoint === '/admin/acessos/membros/membro-1/sessoes') {
        return [
          {
            id: 'sessao-1',
            criadoEm: '2026-09-30T12:00:00.000Z',
            ultimoAcessoEm: '2026-09-30T15:00:00.000Z',
            expiraEm: '2026-10-30T12:00:00.000Z',
            dispositivo: 'Chrome em Windows',
          },
          {
            id: 'sessao-2',
            criadoEm: '2026-09-30T13:00:00.000Z',
            ultimoAcessoEm: null,
            expiraEm: '2026-10-30T13:00:00.000Z',
            dispositivo: null,
          },
        ] as any
      }
      return [] as any
    })
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      message: 'Sessão revogada',
      membroId: 'membro-1',
      contaAcessoId: 'conta-1',
      sessaoId: 'sessao-1',
    })

    render(<ContasAcessoView podeGerenciarSessoes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sessões ativas' }))

    expect(await screen.findByText('Chrome em Windows')).toBeDefined()
    expect(screen.getByText('Dispositivo não identificado')).toBeDefined()

    const botoesRevogar = screen.getAllByRole('button', { name: 'Revogar esta sessão' })
    fireEvent.click(botoesRevogar[0])

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith(
        '/admin/acessos/membros/membro-1/sessoes/sessao-1/revogar',
        {}
      )
    })
  })

  it('revoga sessões após confirmação explícita', async () => {
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      message: 'Sessões revogadas',
      membroId: 'membro-1',
      contaAcessoId: 'conta-1',
    })

    render(<ContasAcessoView podeGerenciarSessoes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revogar todas' }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith(
        '/admin/acessos/membros/membro-1/revogar-sessoes',
        {}
      )
    })
    expect(await screen.findByText('Todas as sessões da conta foram revogadas.')).toBeDefined()
  })

  it('exibe o sucesso de revogação no cartão da conta correspondente', async () => {
    const outraConta = {
      ...contaAtiva,
      membroId: 'membro-2',
      nome: 'Outra Pessoa',
      codigoCarteirinha: 'CARTEIRA-2',
      contaAcessoId: 'conta-2',
      acessos: [],
    }
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([contaAtiva, outraConta])
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      message: 'Sessões revogadas',
      membroId: 'membro-2',
      contaAcessoId: 'conta-2',
    })

    render(<ContasAcessoView podeGerenciarSessoes />)

    const artigoOutraPessoa = (await screen.findByText('Outra Pessoa')).closest('article')
    expect(artigoOutraPessoa).not.toBeNull()
    fireEvent.click(within(artigoOutraPessoa!).getByRole('button', { name: 'Revogar todas' }))

    expect(
      await within(artigoOutraPessoa!).findByText('Todas as sessões da conta foram revogadas.')
    ).toBeDefined()

    const artigoPessoaTeste = screen.getByText('Pessoa Teste').closest('article')
    expect(artigoPessoaTeste).not.toBeNull()
    expect(
      within(artigoPessoaTeste!).queryByText('Todas as sessões da conta foram revogadas.')
    ).toBeNull()
  })

  it('atribui Administrador do Sistema a uma Regional', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/admin/acessos') return [contaAtiva] as any
      if (endpoint === '/regionais') return [
        { id: 'regional-1', nome: 'Regional São Paulo' },
      ] as any
      return [] as any
    })
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      id: 'novo-acesso',
      contaAcessoId: 'conta-1',
      perfilCodigo: 'ADMINISTRADOR_SISTEMA',
      escopoTipo: 'REGIONAL',
      escopoId: 'regional-1',
      ativo: true,
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gerenciar acessos' }))

    const unidade = await screen.findByLabelText('Unidade territorial')
    fireEvent.change(unidade, { target: { value: 'regional-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Atribuir acesso' }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/admin/acessos', {
        contaAcessoId: 'conta-1',
        perfilCodigo: 'ADMINISTRADOR_SISTEMA',
        escopoTipo: 'REGIONAL',
        escopoId: 'regional-1',
      })
    })
  })

  it('revoga acesso existente pela gestão de acessos', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string, options?: RequestInit) => {
      if (endpoint === '/admin/acessos/acesso-2' && options?.method === 'DELETE') {
        return { message: 'Acesso revogado', id: 'acesso-2' } as any
      }
      if (endpoint === '/admin/acessos') return [contaAtiva] as any
      if (endpoint === '/regionais') return [
        { id: 'regional-1', nome: 'Regional São Paulo' },
      ] as any
      return [] as any
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gerenciar acessos' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Revogar' }))

    await waitFor(() => {
      expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(
        '/admin/acessos/acesso-2',
        { method: 'DELETE' }
      )
    })
  })


  it('mantém o nível territorial escolhido quando ele é permitido para o perfil', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/admin/acessos') return [contaAtiva] as any
      if (endpoint === '/regionais') return [{ id: 'regional-1', nome: 'Regional São Paulo' }] as any
      if (endpoint === '/administracoes') return [{ id: 'adm-1', nome: 'Administração Centro' }] as any
      return [] as any
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gerenciar acessos' }))

    fireEvent.change(screen.getByLabelText('Perfil de acesso'), {
      target: { value: 'GESTOR_AGENDA' },
    })
    const nivel = screen.getByLabelText('Nível territorial') as HTMLSelectElement
    fireEvent.change(nivel, { target: { value: 'ADMINISTRACAO' } })

    await waitFor(() => {
      expect(nivel.value).toBe('ADMINISTRACAO')
    })
    expect(await screen.findByText('Administração Centro')).toBeDefined()
  })


  it('informa a quantidade de recuperações pendentes e prioriza essas contas', async () => {
    const onPendenciasAtualizadas = vi.fn()
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValueOnce([
      {
        membroId: 'membro-1',
        nome: 'Sem pendência',
        celular: '11911111111',
        codigoCarteirinha: 'C1',
        contaAcessoId: 'conta-1',
        status: 'ATIVA',
        ativadoEm: null,
        recuperacaoPinPendente: false,
        recuperacaoPinSolicitadaEm: null,
        acessos: [],
      },
      {
        membroId: 'membro-2',
        nome: 'Com pendência',
        celular: '11922222222',
        codigoCarteirinha: 'C2',
        contaAcessoId: 'conta-2',
        status: 'ATIVA',
        ativadoEm: null,
        recuperacaoPinPendente: true,
        recuperacaoPinSolicitadaEm: '2026-09-30T15:00:00.000Z',
        acessos: [],
      },
    ])

    render(<ContasAcessoView onPendenciasAtualizadas={onPendenciasAtualizadas} />)

    await waitFor(() => expect(onPendenciasAtualizadas).toHaveBeenCalledWith(1))
    const titulos = screen.getAllByRole('heading', { level: 3 }).map(item => item.textContent)
    expect(titulos.slice(0, 2)).toEqual(['Com pendência', 'Sem pendência'])
  })

})
