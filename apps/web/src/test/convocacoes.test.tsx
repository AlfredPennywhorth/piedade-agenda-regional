import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConvocacoesView } from '../components/convocacoes/ConvocacoesView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>()
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
    postWithAuth: vi.fn(),
    patchWithAuth: vi.fn(),
  }
})

const EVENTO_ID = '33333333-3333-3333-3333-333333333333'
const EVENTO_DISPONIVEL_ID = '77777777-7777-4777-8777-777777777777'
const CONVOCACAO_ID = '44444444-4444-4444-4444-444444444444'

const EVENTO_PASSADO_ID = '22222222-2222-2222-2222-222222222222'
const INICIO_EVENTO_FUTURO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
const FIM_EVENTO_FUTURO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString()
const INICIO_EVENTO_PASSADO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
const FIM_EVENTO_PASSADO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString()

const mockEventos = [
  {
    id: EVENTO_ID,
    titulo: 'Reunião Presencial Teste',
    descricao: null,
    pauta: null,
    modalidade: 'PRESENCIAL',
    inicioEm: INICIO_EVENTO_FUTURO,
    fimEm: FIM_EVENTO_FUTURO,
    localId: null,
    urlOnline: null,
    organizadorMembroId: null,
    regionalId: null,
    administracaoId: null,
    setorId: null,
    casaId: null,
    grupoTrabalhoId: null,
    observacoes: null,
    ativo: true,
  },
  {
    id: EVENTO_DISPONIVEL_ID,
    titulo: 'Reunião Nova Disponível',
    descricao: null,
    pauta: null,
    modalidade: 'PRESENCIAL',
    inicioEm: INICIO_EVENTO_FUTURO,
    fimEm: FIM_EVENTO_FUTURO,
    localId: null,
    urlOnline: null,
    organizadorMembroId: null,
    regionalId: null,
    administracaoId: null,
    setorId: null,
    casaId: null,
    grupoTrabalhoId: null,
    observacoes: null,
    ativo: true,
  },
  {
    id: EVENTO_PASSADO_ID,
    titulo: 'Reunião Antiga',
    descricao: null,
    pauta: null,
    modalidade: 'PRESENCIAL',
    inicioEm: INICIO_EVENTO_PASSADO,
    fimEm: FIM_EVENTO_PASSADO,
    localId: null,
    urlOnline: null,
    organizadorMembroId: null,
    regionalId: null,
    administracaoId: null,
    setorId: null,
    casaId: null,
    grupoTrabalhoId: null,
    observacoes: null,
    ativo: true,
  }
]

const mockConvocacoes = [
  {
    id: CONVOCACAO_ID,
    eventoId: EVENTO_ID,
    status: 'RASCUNHO',
    observacoes: 'Minha observação rascunho',
    ativo: true,
    createdAt: '2026-09-17T10:00:00.000Z',
    updatedAt: '2026-09-17T10:00:00.000Z'
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    eventoId: EVENTO_ID,
    status: 'PUBLICADA',
    observacoes: 'Convocação publicada',
    ativo: true,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z'
  }
]

describe('ConvocacoesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return mockEventos
      if (url === '/convocacoes') return mockConvocacoes
      return []
    })
  })

  it('deve listar convocações corretamente', async () => {
    render(<ConvocacoesView />)
    expect(screen.getByText('Gerencie os rascunhos de convocações')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getAllByText('Reunião Presencial Teste').length).toBeGreaterThan(0)
      expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
      expect(screen.getByText('Convocação publicada')).toBeInTheDocument()
    })
  })

  it('deve exibir empty state quando não houver convocações', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/convocacoes') return []
      if (url === '/eventos') return mockEventos
      return []
    })

    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByText('Nenhuma convocação encontrada.')).toBeInTheDocument()
    })
  })

  it('deve mostrar data/hora no seletor e ocultar eventos encerrados ou já convocados', async () => {
    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /novo rascunho/i }))

    const select = await screen.findByLabelText('Evento da convocação')
    const dataHoraEsperada = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(INICIO_EVENTO_FUTURO))
    expect(select).toHaveTextContent(`Reunião Nova Disponível — ${dataHoraEsperada}`)
    expect(select).not.toHaveTextContent('Reunião Presencial Teste')
    expect(select).not.toHaveTextContent('Reunião Antiga')
  })

  it('deve aplicar filtro geográfico por Regional em toda a cascata, inclusive GTs', async () => {
    const reg1 = { id: 'reg-1', nome: 'Regional 1' }
    const reg2 = { id: 'reg-2', nome: 'Regional 2' }
    const adm1 = { id: 'adm-1', nome: 'Administração 1', regionalId: reg1.id }
    const adm2 = { id: 'adm-2', nome: 'Administração 2', regionalId: reg2.id }
    const setor1 = { id: 'setor-1', nome: 'Setor Regional 1', administracaoId: adm1.id }
    const setor2 = { id: 'setor-2', nome: 'Setor Regional 2', administracaoId: adm2.id }
    const casa1 = { id: 'casa-1', nome: 'Casa Regional 1', setorId: setor1.id }
    const casa2 = { id: 'casa-2', nome: 'Casa Regional 2', setorId: setor2.id }
    const gtRegional = { id: 'gt-reg-1', nome: 'GT Regional 1', regionalId: reg1.id }
    const gtAdministracao = { id: 'gt-adm-1', nome: 'GT Administração 1', administracaoId: adm1.id }
    const gtSetor = { id: 'gt-setor-1', nome: 'GT Setor 1', setorId: setor1.id }
    const gtOutroSetor = { id: 'gt-setor-2', nome: 'GT Setor 2', setorId: setor2.id }

    const eventos = mockEventos.map(evento =>
      evento.id === EVENTO_ID
        ? {
            ...evento,
            regionalId: null,
            administracaoId: null,
            setorId: null,
            casaId: null,
            grupoTrabalhoId: gtSetor.id,
          }
        : evento.id === EVENTO_DISPONIVEL_ID
          ? { ...evento, regionalId: reg2.id }
          : evento
    )

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return eventos
      if (url === '/convocacoes') return mockConvocacoes
      if (url === '/regionais') return [reg1, reg2]
      if (url === '/administracoes') return [adm1, adm2]
      if (url === '/setores') return [setor1, setor2]
      if (url === '/casas') return [casa1, casa2]
      if (url === '/grupos-trabalho') return [gtRegional, gtAdministracao, gtSetor, gtOutroSetor]
      return []
    })

    render(<ConvocacoesView />)
    await screen.findByText('Minha observação rascunho')

    fireEvent.change(screen.getByLabelText('Filtrar por Regional'), {
      target: { value: reg1.id },
    })

    expect(screen.getByLabelText('Filtrar por Administração')).toHaveTextContent('Administração 1')
    expect(screen.getByLabelText('Filtrar por Administração')).not.toHaveTextContent('Administração 2')
    expect(screen.getByLabelText('Filtrar por Setor')).toHaveTextContent('Setor Regional 1')
    expect(screen.getByLabelText('Filtrar por Setor')).not.toHaveTextContent('Setor Regional 2')
    expect(screen.getByLabelText('Filtrar por Casa de Oração')).toHaveTextContent('Casa Regional 1')
    expect(screen.getByLabelText('Filtrar por Casa de Oração')).not.toHaveTextContent('Casa Regional 2')
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveTextContent('GT Regional 1')
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveTextContent('GT Administração 1')
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveTextContent('GT Setor 1')
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).not.toHaveTextContent('GT Setor 2')
    expect(await screen.findByText('Minha observação rascunho')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtrar por Grupo de Trabalho'), {
      target: { value: gtSetor.id },
    })
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveValue(gtSetor.id)

    fireEvent.change(screen.getByLabelText('Filtrar por Administração'), {
      target: { value: adm1.id },
    })
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveValue('')
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).not.toHaveTextContent('GT Regional 1')
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveTextContent('GT Administração 1')
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveTextContent('GT Setor 1')
    expect(await screen.findByText('Minha observação rascunho')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtrar por Grupo de Trabalho'), {
      target: { value: gtSetor.id },
    })
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveValue(gtSetor.id)

    fireEvent.change(screen.getByLabelText('Filtrar por Setor'), {
      target: { value: setor1.id },
    })
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveValue('')
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveTextContent('GT Setor 1')
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).not.toHaveTextContent('GT Administração 1')
    expect(await screen.findByText('Minha observação rascunho')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtrar por Casa de Oração'), {
      target: { value: casa1.id },
    })
    expect(screen.getByLabelText('Filtrar por Casa de Oração')).toHaveValue(casa1.id)

    fireEvent.change(screen.getByLabelText('Filtrar por Grupo de Trabalho'), {
      target: { value: gtSetor.id },
    })
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveValue(gtSetor.id)
    expect(screen.getByLabelText('Filtrar por Casa de Oração')).toHaveValue('')

    fireEvent.change(screen.getByLabelText('Filtrar por Casa de Oração'), {
      target: { value: casa1.id },
    })
    expect(screen.getByLabelText('Filtrar por Casa de Oração')).toHaveValue(casa1.id)
    expect(screen.getByLabelText('Filtrar por Grupo de Trabalho')).toHaveValue('')

    fireEvent.change(screen.getByLabelText('Filtrar por Regional'), {
      target: { value: reg2.id },
    })

    expect(screen.getByText('Nenhuma convocação corresponde aos filtros selecionados.')).toBeInTheDocument()
  })

  it('deve abrir convocação pré-selecionada e seguir direto para Gerenciar Funções', async () => {
    const novaConvocacaoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    vi.mocked(apiClient.postWithAuth).mockImplementation(async (url) => {
      if (url === '/convocacoes') {
        return {
          id: novaConvocacaoId,
          eventoId: EVENTO_DISPONIVEL_ID,
          status: 'RASCUNHO',
          observacoes: '',
          ativo: true,
          createdAt: '2026-10-01T12:00:00.000Z',
          updatedAt: '2026-10-01T12:00:00.000Z',
        }
      }
      return {}
    })

    render(<ConvocacoesView initialEventoId={EVENTO_DISPONIVEL_ID} />)

    const dialog = await screen.findByRole('dialog', { name: /nova convocação/i })
    expect(within(dialog).getByLabelText('Evento da convocação')).toHaveValue(EVENTO_DISPONIVEL_ID)

    fireEvent.click(within(dialog).getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/convocacoes', {
        eventoId: EVENTO_DISPONIVEL_ID,
        observacoes: '',
      })
      expect(screen.getByRole('dialog', { name: /gerenciar funções do rascunho/i })).toBeInTheDocument()
    })
  })

  it('deve devolver o foco à tela de Convocações ao fechar Gerenciar Funções no fluxo guiado', async () => {
    const novaConvocacaoId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    vi.mocked(apiClient.postWithAuth).mockImplementation(async (url) => {
      if (url === '/convocacoes') {
        return {
          id: novaConvocacaoId,
          eventoId: EVENTO_DISPONIVEL_ID,
          status: 'RASCUNHO',
          observacoes: '',
          ativo: true,
          createdAt: '2026-10-01T12:00:00.000Z',
          updatedAt: '2026-10-01T12:00:00.000Z',
        }
      }
      return {}
    })
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return mockEventos
      if (url === '/convocacoes') return mockConvocacoes
      if (url === '/funcoes') return []
      if (url === `/convocacoes/${novaConvocacaoId}/funcoes`) return []
      return []
    })

    render(<ConvocacoesView initialEventoId={EVENTO_DISPONIVEL_ID} />)

    const dialog = await screen.findByRole('dialog', { name: /nova convocação/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /salvar/i }))

    const funcoesDialog = await screen.findByRole('dialog', { name: /gerenciar funções do rascunho/i })
    fireEvent.click(within(funcoesDialog).getByRole('button', { name: /fechar/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /gerenciar funções do rascunho/i })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Convocações' })).toHaveFocus()
    })
  })

  it('deve consumir o fluxo guiado ao dispensar o formulário', async () => {
    const onFluxoConcluido = vi.fn()

    render(
      <ConvocacoesView
        initialEventoId={EVENTO_DISPONIVEL_ID}
        onFluxoConcluido={onFluxoConcluido}
      />
    )

    const dialog = await screen.findByRole('dialog', { name: /nova convocação/i })
    expect(within(dialog).getByLabelText('Evento da convocação')).toHaveValue(EVENTO_DISPONIVEL_ID)

    fireEvent.click(within(dialog).getByRole('button', { name: /cancelar/i }))

    await waitFor(() => {
      expect(onFluxoConcluido).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('dialog', { name: /nova convocação/i })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /novo rascunho/i }))
    const manual = await screen.findByRole('dialog', { name: /nova convocação/i })
    expect(within(manual).getByLabelText('Evento da convocação')).toHaveValue('')
  })

  it('deve permitir criar um rascunho', async () => {
    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /novo rascunho/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /nova convocação/i })).toBeInTheDocument()
    })

    const select = screen.getByLabelText('Evento da convocação')
    fireEvent.change(select, { target: { value: EVENTO_DISPONIVEL_ID } })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Nova obs' } })

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/convocacoes', {
        eventoId: EVENTO_DISPONIVEL_ID,
        observacoes: 'Nova obs'
      })
    })
  })

  it('deve permitir editar rascunho', async () => {
    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /editar/i })
    fireEvent.click(editButtons[0]) // O primeiro é o RASCUNHO

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /editar rascunho/i })).toBeInTheDocument()
    })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Obs atualizada' } })

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/convocacoes/${CONVOCACAO_ID}`, {
        observacoes: 'Obs atualizada'
      })
    })
  })

  it('deve exibir edição somente para RASCUNHO', async () => {
    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByText('Convocação publicada')).toBeInTheDocument()
    })

    expect(screen.getAllByRole('button', { name: /editar/i })).toHaveLength(1)
    expect(apiClient.patchWithAuth).not.toHaveBeenCalled()
  })

  it('deve exibir erro de API na listagem', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockRejectedValue(new Error('Falha no servidor'))

    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Falha no servidor')
    })
  })

  describe('Gestão de Funções do Rascunho', () => {
    it('deve exibir listas vazias e permitir adicionar/remover função', async () => {
      type ConvocacaoFuncaoMock = {
        id: string
        convocacaoId: string
        funcaoId: string
        createdAt: string
      }
      let vinculadas: ConvocacaoFuncaoMock[] = []
      
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url, options) => {
        if (options?.method === 'DELETE') {
          vinculadas = []
          return { success: true }
        }
        if (url === '/funcoes') return [{ id: '11111111-1111-1111-1111-111111111111', nome: 'Músico', ativo: true }]
        if (url === `/convocacoes/${CONVOCACAO_ID}/funcoes`) return vinculadas
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        return []
      })
      
      vi.mocked(apiClient.postWithAuth).mockImplementation(async () => {
        vinculadas = [{ id: 'v1', convocacaoId: CONVOCACAO_ID, funcaoId: '11111111-1111-1111-1111-111111111111', createdAt: '2026-09-17' }]
        return vinculadas[0]
      })

      render(<ConvocacoesView />)

      await waitFor(() => {
        expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
      })

      const botoesGerenciar = screen.getAllByRole('button', { name: /gerenciar funções/i })
      expect(botoesGerenciar).toHaveLength(1) // Apenas RASCUNHO

      fireEvent.click(botoesGerenciar[0])

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /gerenciar funções do rascunho/i })).toBeInTheDocument()
        expect(screen.getByText('Nenhuma função vinculada.')).toBeInTheDocument()
      })
      
      const select = screen.getByLabelText('Função para adicionar')
      fireEvent.change(select, { target: { value: '11111111-1111-1111-1111-111111111111' } })
      fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
      
      await waitFor(() => {
        expect(apiClient.postWithAuth).toHaveBeenCalledWith(`/convocacoes/${CONVOCACAO_ID}/funcoes`, { funcaoId: '11111111-1111-1111-1111-111111111111' })
        expect(screen.getByText('Músico')).toBeInTheDocument()
        expect(screen.queryByText('Nenhuma função vinculada.')).not.toBeInTheDocument()
        expect(screen.getByText('Nenhuma função disponível para adicionar.')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /remover/i }))
      
      await waitFor(() => {
        expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(`/convocacoes/${CONVOCACAO_ID}/funcoes/11111111-1111-1111-1111-111111111111`, { method: 'DELETE' })
        expect(screen.getByText('Nenhuma função vinculada.')).toBeInTheDocument()
      })
    })

    it('deve exibir erro da API e erro de validação (ex: função já adicionada)', async () => {
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
        if (url === '/funcoes') return [{ id: '22222222-2222-2222-2222-222222222222', nome: 'Porteiro', ativo: true }]
        if (url === `/convocacoes/${CONVOCACAO_ID}/funcoes`) return []
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        return []
      })
      
      vi.mocked(apiClient.postWithAuth).mockRejectedValueOnce(new Error('Função já adicionada a esta convocação'))

      render(<ConvocacoesView />)

      await waitFor(() => {
        expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /gerenciar funções/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /gerenciar funções do rascunho/i })).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Função para adicionar'), { target: { value: '22222222-2222-2222-2222-222222222222' } })
      fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Função já adicionada a esta convocação')
      })
    })

    it('deve exibir erro caso falhe o carregamento inicial das funções e listas', async () => {
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        if (url.includes('/funcoes')) throw new Error('Falha catastrófica')
        return []
      })

      render(<ConvocacoesView />)

      await waitFor(() => {
        expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /gerenciar funções/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Falha catastrófica')
      })
    })
  })

  describe('Ações: Publicar e Cancelar', () => {
    it('deve publicar RASCUNHO somente após confirmação e enviar POST correto', async () => {
      render(<ConvocacoesView />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /publicar convocação/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
      await waitFor(() => {
        expect(apiClient.postWithAuth).toHaveBeenCalledWith(`/convocacoes/${CONVOCACAO_ID}/publicar`, {})
      })
    })

    it('deve cancelar PUBLICADA somente após confirmação e enviar POST correto', async () => {
      render(<ConvocacoesView />)
      await waitFor(() => {
        expect(screen.getByText('Convocação publicada')).toBeInTheDocument()
      })
      const btns = screen.getAllByRole('button', { name: 'Cancelar' })
      fireEvent.click(btns[1]) // O segundo cancelar pertence à PUBLICADA
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /cancelar convocação/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
      await waitFor(() => {
        expect(apiClient.postWithAuth).toHaveBeenCalledWith('/convocacoes/55555555-5555-5555-5555-555555555555/cancelar', {})
      })
    })

    it('oculta CANCELADA por padrão e permite consultá-la pelo filtro de status', async () => {
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
        if (url === '/convocacoes') return [{ ...mockConvocacoes[0], status: 'CANCELADA' }]
        if (url === '/eventos') return mockEventos
        return []
      })
      render(<ConvocacoesView />)

      await waitFor(() => {
        expect(screen.getByText('Nenhuma convocação corresponde aos filtros selecionados.')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Filtrar por status'), {
        target: { value: 'CANCELADA' },
      })

      expect(await screen.findByText('Minha observação rascunho')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    })

    it('cancelar na janela de confirmação não envia request', async () => {
      render(<ConvocacoesView />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /publicar convocação/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /publicar convocação/i })).not.toBeInTheDocument()
      })
      expect(apiClient.postWithAuth).not.toHaveBeenCalledWith(`/convocacoes/${CONVOCACAO_ID}/publicar`, {})
    })

    it('erro 400 ao publicar sem funções aparece no alert', async () => {
      vi.mocked(apiClient.postWithAuth).mockRejectedValueOnce(new Error('É necessário ter pelo menos uma função associada'))
      render(<ConvocacoesView />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /publicar convocação/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('É necessário ter pelo menos uma função associada')
      })
    })

    it('erro 409 aparece como conflito/necessidade de recarregar', async () => {
      const err409 = new apiClient.ApiError(409, 'Conflito', {})
      vi.mocked(apiClient.postWithAuth).mockRejectedValueOnce(err409)
      
      render(<ConvocacoesView />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /publicar convocação/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('A convocação foi alterada concorrentemente')
      })
    })

    it('botões ficam indisponíveis enquanto a request está pendente', async () => {
      let resolvePromise: (v: unknown) => void = () => {}
      vi.mocked(apiClient.postWithAuth).mockImplementationOnce(() => {
        return new Promise((resolve) => { resolvePromise = resolve })
      })
      render(<ConvocacoesView />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /publicar convocação/i })).toBeInTheDocument()
      })
      const btnConfirmar = screen.getByRole('button', { name: 'Confirmar' })
      const btnVoltar = screen.getByRole('button', { name: 'Voltar' })
      fireEvent.click(btnConfirmar)
      await waitFor(() => {
        expect(btnConfirmar).toBeDisabled()
        expect(btnVoltar).toBeDisabled()
        expect(btnConfirmar).toHaveTextContent('Processando...')
      })
      resolvePromise({})
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /publicar convocação/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Acompanhamento RSVP', () => {
    it('só exibe botão Acompanhar RSVP para convocação PUBLICADA', async () => {
      render(<ConvocacoesView />)
      await waitFor(() => {
        expect(screen.getByText('Convocação publicada')).toBeInTheDocument()
      })
      const botoesAcompanhar = screen.queryAllByRole('button', { name: /Acompanhar RSVP/i })
      expect(botoesAcompanhar).toHaveLength(1)
    })

    it('abre modal e carrega dados com page=1 e limit=50', async () => {
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
        if (url.includes('/acompanhamento-rsvp')) {
          return {
            data: [
              { destinatarioId: '1', membroNome: 'João', respostaRsvp: 'PARTICIPAREI', vinculo: { funcaoId: 'f1', funcaoNome: 'Diácono da Casa de Oração', vinculoFuncionalId: 'v1' } },
              { destinatarioId: '2', membroNome: 'Maria', respostaRsvp: 'NAO_PARTICIPAREI' },
              { destinatarioId: '3', membroNome: 'Pedro', respostaRsvp: 'NAO_SEI' },
              { destinatarioId: '4', membroNome: 'Ana', respostaRsvp: 'SEM_RESPOSTA' },
            ],
            meta: { total: 4, page: 1, lastPage: 1 }
          }
        }
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        return []
      })

      render(<ConvocacoesView />)
      await waitFor(() => {
        expect(screen.getByText('Convocação publicada')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Acompanhar RSVP/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Acompanhamento RSVP/i })).toBeInTheDocument()
        expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(
          expect.stringContaining('/acompanhamento-rsvp?page=1&limit=50')
        )
      })

      await waitFor(() => {
        expect(screen.getByText('Total de destinatários: 4')).toBeInTheDocument()
        expect(screen.getByText('João')).toBeInTheDocument()
        expect(screen.getByText('Diácono da Casa de Oração')).toBeInTheDocument()
        expect(screen.getByText('Maria')).toBeInTheDocument()
        expect(screen.getByText('Pedro')).toBeInTheDocument()
        expect(screen.getByText('Ana')).toBeInTheDocument()
        
        expect(screen.getByText('Participarei')).toBeInTheDocument()
        expect(screen.getByText('Não Participarei')).toBeInTheDocument()
        expect(screen.getByText('Não Sei')).toBeInTheDocument()
        expect(screen.getByText('Sem Resposta')).toBeInTheDocument()
      })

      expect(screen.queryByText(/justificativa/i)).not.toBeInTheDocument()
    })

    it('deve exibir empty state', async () => {
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
        if (url.includes('/acompanhamento-rsvp')) {
          return { data: [], meta: { total: 0, page: 1, lastPage: 1 } }
        }
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        return []
      })

      render(<ConvocacoesView />)
      await waitFor(() => screen.getByRole('button', { name: /Acompanhar RSVP/i }))
      fireEvent.click(screen.getByRole('button', { name: /Acompanhar RSVP/i }))

      await waitFor(() => {
        expect(screen.getByText('Nenhum destinatário encontrado.')).toBeInTheDocument()
      })
    })

    it('deve permitir paginação', async () => {
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
        if (url.includes('/acompanhamento-rsvp?page=1')) {
          return {
            data: [{ destinatarioId: '1', membroNome: 'João', respostaRsvp: 'PARTICIPAREI' }],
            meta: { total: 2, page: 1, lastPage: 2 }
          }
        }
        if (url.includes('/acompanhamento-rsvp?page=2')) {
          return {
            data: [{ destinatarioId: '2', membroNome: 'Maria', respostaRsvp: 'PARTICIPAREI' }],
            meta: { total: 2, page: 2, lastPage: 2 }
          }
        }
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        return []
      })

      render(<ConvocacoesView />)
      await waitFor(() => screen.getByRole('button', { name: /Acompanhar RSVP/i }))
      fireEvent.click(screen.getByRole('button', { name: /Acompanhar RSVP/i }))

      await waitFor(() => {
        expect(screen.getByText('João')).toBeInTheDocument()
        expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))

      await waitFor(() => {
        expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(
          expect.stringContaining('/acompanhamento-rsvp?page=2&limit=50')
        )
        expect(screen.getByText('Maria')).toBeInTheDocument()
        expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
      })
    })

    it('deve exibir erro 403 e manter modal aberto', async () => {
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
        if (url.includes('/acompanhamento-rsvp')) {
          throw new apiClient.ApiError(403, 'Acesso negado', {})
        }
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        return []
      })

      render(<ConvocacoesView />)
      await waitFor(() => screen.getByRole('button', { name: /Acompanhar RSVP/i }))
      fireEvent.click(screen.getByRole('button', { name: /Acompanhar RSVP/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Acompanhamento RSVP/i })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Acesso não autorizado para acompanhar RSVP desta convocação')
      })
    })
  })
})
