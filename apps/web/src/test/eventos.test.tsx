import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventosView } from '../components/eventos/EventosView'
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
const LOCAL_ID = '11111111-1111-1111-1111-111111111111'
const REGIONAL_ID = '22222222-2222-2222-2222-222222222222'
const ESPACO_INATIVO_ID = '66666666-6666-4666-8666-666666666666'
const ESPACO_ATIVO_ID = '77777777-7777-4777-8777-777777777777'

const mockEventos = [
  {
    id: EVENTO_ID,
    titulo: 'Reunião Presencial',
    descricao: 'Descrição do evento',
    pauta: 'Pauta do evento',
    modalidade: 'PRESENCIAL',
    inicioEm: '2026-10-10T10:00:00.000Z',
    fimEm: '2026-10-10T12:00:00.000Z',
    localId: LOCAL_ID,
    urlOnline: null,
    organizadorMembroId: null,
    regionalId: REGIONAL_ID,
    administracaoId: null,
    setorId: null,
    casaId: null,
    grupoTrabalhoId: null,
    observacoes: null,
    ativo: true,
  }
]

const SERIE_ID = '44444444-4444-4444-4444-444444444444'
const mockEventoRecorrente = {
  ...mockEventos[0],
  id: '55555555-5555-5555-5555-555555555555',
  titulo: 'Reunião Recorrente',
  serieRecorrenciaId: SERIE_ID,
  recorrenciaExcecao: false
}

describe('EventosView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(apiClient.fetchWithAuth).mockReset()
    vi.mocked(apiClient.postWithAuth).mockReset()
    vi.mocked(apiClient.patchWithAuth).mockReset()
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return mockEventos
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
  })

  it('deve listar eventos corretamente', async () => {
    render(<EventosView />)
    expect(screen.getByText('Gestão de Eventos')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
      expect(screen.getByText('PRESENCIAL')).toBeInTheDocument()
    })
  })

  it('deve cancelar evento e removê-lo da lista operacional', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(apiClient.postWithAuth).mockResolvedValueOnce({
      success: true,
      eventoId: EVENTO_ID,
      convocacaoId: null,
      convocacaoCancelada: false,
    })

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /cancelar evento/i }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith(`/eventos/${EVENTO_ID}/cancelar`, {})
      expect(screen.queryByText('Reunião Presencial')).not.toBeInTheDocument()
    })
  })

  it('deve continuar o fluxo para convocação após criar evento', async () => {
    const onEventoCriado = vi.fn()
    const novoEvento = {
      ...mockEventos[0],
      id: '88888888-8888-4888-8888-888888888888',
      titulo: 'Evento do fluxo',
      modalidade: 'ONLINE',
      localId: null,
      urlOnline: 'https://meet.google.com/fluxo',
    }
    vi.mocked(apiClient.postWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return novoEvento
      return {}
    })

    render(<EventosView onEventoCriado={onEventoCriado} />)
    await screen.findByText('Reunião Presencial')

    fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))
    const dialog = await screen.findByRole('dialog', { name: /novo evento/i })

    fireEvent.change(within(dialog).getByLabelText(/título/i), { target: { value: 'Evento do fluxo' } })
    fireEvent.change(within(dialog).getByLabelText(/início/i), { target: { value: '2026-10-10T10:00' } })
    fireEvent.change(within(dialog).getByLabelText(/fim/i), { target: { value: '2026-10-10T12:00' } })
    fireEvent.change(within(dialog).getByLabelText(/modalidade/i), { target: { value: 'ONLINE' } })
    fireEvent.change(within(dialog).getByLabelText(/url online/i), { target: { value: 'https://meet.google.com/fluxo' } })
    fireEvent.change(within(dialog).getByLabelText(/tipo de escopo/i), { target: { value: 'regional' } })
    fireEvent.change(within(dialog).getByLabelText(/regional \*/i), { target: { value: REGIONAL_ID } })
    fireEvent.click(within(dialog).getByRole('button', { name: /salvar evento/i }))

    await waitFor(() => {
      expect(onEventoCriado).toHaveBeenCalledWith(novoEvento.id)
    })
  })

  it('deve criar Local e Espaço sem sair do formulário e selecioná-los', async () => {
    const novoLocalId = '99999999-9999-4999-8999-999999999999'
    const novoEspacoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    vi.mocked(apiClient.postWithAuth).mockImplementation(async (url) => {
      if (url === '/locais') return { id: novoLocalId, nome: 'Local Rápido' }
      if (url === '/espacos-locais') return { id: novoEspacoId, localId: novoLocalId, nome: 'Sala Rápida', ativo: true }
      return {}
    })

    render(<EventosView />)
    await screen.findByText('Reunião Presencial')
    fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))

    const eventoDialog = await screen.findByRole('dialog', { name: /novo evento/i })
    fireEvent.click(within(eventoDialog).getByRole('button', { name: /criar local sem sair/i }))

    const localDialog = await screen.findByRole('dialog', { name: /criar local/i })
    fireEvent.change(within(localDialog).getByLabelText('Nome do novo local'), { target: { value: 'Local Rápido' } })
    fireEvent.change(within(localDialog).getByLabelText('Endereço do novo local'), { target: { value: 'Rua Teste' } })
    fireEvent.change(within(localDialog).getByLabelText('Número do novo local'), { target: { value: '10' } })
    fireEvent.click(within(localDialog).getByRole('button', { name: /criar e selecionar/i }))

    await waitFor(() => {
      expect(within(eventoDialog).getByLabelText(/local \*/i)).toHaveValue(novoLocalId)
    })

    fireEvent.click(within(eventoDialog).getByRole('button', { name: /criar espaço sem sair/i }))
    const espacoDialog = await screen.findByRole('dialog', { name: /criar espaço/i })
    fireEvent.change(within(espacoDialog).getByLabelText('Nome do novo espaço'), { target: { value: 'Sala Rápida' } })
    fireEvent.click(within(espacoDialog).getByRole('button', { name: /criar e selecionar/i }))

    await waitFor(() => {
      expect(within(eventoDialog).getByLabelText(/espaço/i)).toHaveValue(novoEspacoId)
    })
  })

  it('deve consultar CEP no cadastro rápido de Local do evento', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cep: '03127-001',
        logradouro: 'Rua Ibitirama',
        bairro: 'Vila Prudente',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      render(<EventosView />)
      await screen.findByText('Reunião Presencial')
      fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))

      const eventoDialog = await screen.findByRole('dialog', { name: /novo evento/i })
      fireEvent.click(within(eventoDialog).getByRole('button', { name: /criar local sem sair/i }))

      const localDialog = await screen.findByRole('dialog', { name: /criar local/i })
      fireEvent.change(within(localDialog).getByLabelText('CEP do novo local'), {
        target: { value: '03127001' },
      })

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          'https://viacep.com.br/ws/03127001/json/',
          expect.objectContaining({ signal: expect.anything() })
        )
        expect(within(localDialog).getByLabelText('Endereço do novo local')).toHaveValue('Rua Ibitirama')
        expect(within(localDialog).getByLabelText('Bairro do novo local')).toHaveValue('Vila Prudente')
        expect(within(localDialog).getByLabelText('Cidade do novo local')).toHaveValue('São Paulo')
        expect(within(localDialog).getByLabelText('UF do novo local')).toHaveValue('SP')
      })

      expect(within(localDialog).getByText('Endereço preenchido automaticamente pelo CEP.')).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('deve permitir cancelar consulta de CEP e preservar preenchimento manual', async () => {
    let resolver: ((value: any) => void) | undefined
    const pendente = new Promise<any>(resolve => {
      resolver = resolve
    })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendente))

    try {
      render(<EventosView />)
      await screen.findByText('Reunião Presencial')
      fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))

      const eventoDialog = await screen.findByRole('dialog', { name: /novo evento/i })
      fireEvent.click(within(eventoDialog).getByRole('button', { name: /criar local sem sair/i }))

      const localDialog = await screen.findByRole('dialog', { name: /criar local/i })
      fireEvent.change(within(localDialog).getByLabelText('CEP do novo local'), {
        target: { value: '03127001' },
      })

      const usarManual = await within(localDialog).findByRole('button', { name: /usar endereço manualmente/i })
      fireEvent.click(usarManual)

      const endereco = within(localDialog).getByLabelText('Endereço do novo local')
      fireEvent.change(endereco, { target: { value: 'Rua Digitada Manualmente' } })
      expect(endereco).toHaveValue('Rua Digitada Manualmente')
      expect(within(localDialog).getByText('Consulta de CEP cancelada. Preencha o endereço manualmente.')).toBeInTheDocument()

      await act(async () => {
        resolver?.({
          ok: true,
          json: async () => ({
            cep: '03127-001',
            logradouro: 'Rua ViaCEP',
            bairro: 'Vila Prudente',
            localidade: 'São Paulo',
            uf: 'SP',
          }),
        })
        await pendente
      })

      expect(endereco).toHaveValue('Rua Digitada Manualmente')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('deve conter o foco no modal rápido de Local e restaurá-lo ao fechar', async () => {
    render(<EventosView />)
    await screen.findByText('Reunião Presencial')
    fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))

    const eventoDialog = await screen.findByRole('dialog', { name: /novo evento/i })
    const abrir = within(eventoDialog).getByRole('button', { name: /criar local sem sair/i })
    abrir.focus()
    fireEvent.click(abrir)

    const localDialog = await screen.findByRole('dialog', { name: /criar local/i })
    const primeiro = within(localDialog).getByLabelText('CEP do novo local')
    await waitFor(() => expect(primeiro).toHaveFocus())

    const ultimo = within(localDialog).getByRole('button', { name: /criar e selecionar/i })
    ultimo.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(primeiro).toHaveFocus()

    fireEvent.click(within(localDialog).getByRole('button', { name: /voltar ao evento/i }))
    await waitFor(() => expect(abrir).toHaveFocus())
  })

  it('deve exibir empty state quando não houver eventos', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return []
      return []
    })

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Nenhum evento cadastrado.')).toBeInTheDocument()
    })
  })

  it('deve exibir detalhes de um evento em diálogo acessível', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/eventos/${EVENTO_ID}`)) return mockEventos[0]
      if (url === '/eventos') return mockEventos
      return []
    })

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /ver/i }))

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /detalhes do evento/i })
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      
      const { getByText } = within(dialog)
      expect(getByText('Descrição do evento')).toBeInTheDocument()
    })
  })

  it('deve validar regra temporal: fim anterior ao início', async () => {
    vi.mocked(apiClient.postWithAuth).mockResolvedValueOnce({})
    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))

    const dialog = await screen.findByRole('dialog', { name: /novo evento/i })
    const { getByLabelText, getByRole, findByRole } = within(dialog)

    fireEvent.change(getByLabelText(/título/i), { target: { value: 'Novo Evento' } })
    // Fim anterior ao início
    fireEvent.change(getByLabelText(/início/i), { target: { value: '2026-10-10T12:00' } })
    fireEvent.change(getByLabelText(/fim/i), { target: { value: '2026-10-10T10:00' } })
    
    // modalidade presencial
    fireEvent.change(getByLabelText(/modalidade/i), { target: { value: 'PRESENCIAL' } })
    fireEvent.change(getByLabelText(/local/i), { target: { value: LOCAL_ID } })

    // escopo
    fireEvent.change(getByLabelText(/tipo de escopo/i), { target: { value: 'regional' } })
    fireEvent.change(getByLabelText(/regional \*/i), { target: { value: REGIONAL_ID } })

    fireEvent.click(getByRole('button', { name: /salvar/i }))

    const alert = await findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('deve limpar urlOnline ao trocar para PRESENCIAL e vice-versa', async () => {
    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))

    const dialog = await screen.findByRole('dialog', { name: /novo evento/i })
    const { getByLabelText, queryByLabelText } = within(dialog)

    // Online
    fireEvent.change(getByLabelText(/modalidade/i), { target: { value: 'ONLINE' } })
    expect(getByLabelText(/url online/i)).toBeInTheDocument()
    expect(queryByLabelText(/local \*/i)).not.toBeInTheDocument()

    // Hibrido
    fireEvent.change(getByLabelText(/modalidade/i), { target: { value: 'HIBRIDO' } })
    expect(getByLabelText(/url online/i)).toBeInTheDocument()
    expect(getByLabelText(/local \*/i)).toBeInTheDocument()

    // Presencial
    fireEvent.change(getByLabelText(/modalidade/i), { target: { value: 'PRESENCIAL' } })
    expect(queryByLabelText(/url online/i)).not.toBeInTheDocument()
    expect(getByLabelText(/local \*/i)).toBeInTheDocument()
  })

  it('deve editar um evento existente via PATCH e limpar scopes cruzados', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/eventos/${EVENTO_ID}`)) return mockEventos[0]
      if (url === '/eventos') return mockEventos
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialog = await screen.findByRole('dialog', { name: /editar evento/i })
    const { getByLabelText, getByRole } = within(dialog)

    await waitFor(() => {
      expect(getByLabelText(/título/i)).toHaveValue('Reunião Presencial')
    })

    fireEvent.change(getByLabelText(/título/i), { target: { value: 'Reunião Presencial Editada' } })
    fireEvent.click(getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/eventos/${EVENTO_ID}`, expect.objectContaining({
        titulo: 'Reunião Presencial Editada',
        regionalId: REGIONAL_ID,
        administracaoId: null,
      }))
    })
  })

  it('deve disponibilizar criação rápida de Local e Espaço durante a edição do evento', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return mockEventos
      if (url === `/eventos/${EVENTO_ID}`) return mockEventos[0]
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })

    render(<EventosView />)
    await screen.findByText('Reunião Presencial')
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const eventoDialog = await screen.findByRole('dialog', { name: /editar evento/i })

    await waitFor(() => {
      expect(eventoDialog.querySelector<HTMLSelectElement>('#localId')).toHaveValue(LOCAL_ID)
    })

    expect(within(eventoDialog).getByRole('button', { name: /criar local sem sair/i })).toBeInTheDocument()
    expect(within(eventoDialog).getByRole('button', { name: /criar espaço sem sair/i })).toBeInTheDocument()
  })

  it('deve preservar espaço inativo já vinculado ao editar sem oferecê-lo em novo evento', async () => {
    const eventoComEspacoInativo = {
      ...mockEventos[0],
      espacoId: ESPACO_INATIVO_ID,
    }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return [eventoComEspacoInativo]
      if (url === `/eventos/${EVENTO_ID}`) return eventoComEspacoInativo
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/espacos-locais?ativo=true') {
        return [{ id: ESPACO_ATIVO_ID, localId: LOCAL_ID, nome: 'Sala Ativa', ativo: true }]
      }
      if (url === `/espacos-locais?localId=${LOCAL_ID}`) {
        return [
          { id: ESPACO_ATIVO_ID, localId: LOCAL_ID, nome: 'Sala Ativa', ativo: true },
          { id: ESPACO_INATIVO_ID, localId: LOCAL_ID, nome: 'Sala Histórica', ativo: false },
        ]
      }
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialogEdicao = await screen.findByRole('dialog', { name: /editar evento/i })
    const seletorEspaco = within(dialogEdicao).getByLabelText(/espaço/i)

    await waitFor(() => {
      expect(seletorEspaco).toHaveValue(ESPACO_INATIVO_ID)
      expect(within(dialogEdicao).getByRole('option', { name: 'Sala Histórica (inativo)' })).toBeInTheDocument()
    })

    fireEvent.click(within(dialogEdicao).getByRole('button', { name: /cancelar/i }))

    fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))
    const dialogNovo = await screen.findByRole('dialog', { name: /novo evento/i })
    fireEvent.change(within(dialogNovo).getByLabelText(/local \*/i), { target: { value: LOCAL_ID } })

    expect(within(dialogNovo).queryByRole('option', { name: /Sala Histórica/ })).not.toBeInTheDocument()
    expect(within(dialogNovo).getByRole('option', { name: 'Sala Ativa' })).toBeInTheDocument()
  })

  it('deve ignorar lookup histórico atrasado após fechar edição e abrir novo evento', async () => {
    const eventoComEspacoInativo = {
      ...mockEventos[0],
      espacoId: ESPACO_INATIVO_ID,
    }

    let resolverEspacosHistoricos: ((value: any[]) => void) | undefined
    const espacosHistoricosPendentes = new Promise<any[]>(resolve => {
      resolverEspacosHistoricos = resolve
    })

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return [eventoComEspacoInativo]
      if (url === `/eventos/${EVENTO_ID}`) return eventoComEspacoInativo
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/espacos-locais?ativo=true') {
        return [{ id: ESPACO_ATIVO_ID, localId: LOCAL_ID, nome: 'Sala Ativa', ativo: true }]
      }
      if (url === `/espacos-locais?localId=${LOCAL_ID}`) {
        return espacosHistoricosPendentes as any
      }
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialogEdicao = await screen.findByRole('dialog', { name: /editar evento/i })
    fireEvent.click(within(dialogEdicao).getByRole('button', { name: '✕' }))

    fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))
    const dialogNovo = await screen.findByRole('dialog', { name: /novo evento/i })
    expect(within(dialogNovo).getByLabelText(/título/i)).toHaveValue('')

    await act(async () => {
      resolverEspacosHistoricos?.([
        { id: ESPACO_INATIVO_ID, localId: LOCAL_ID, nome: 'Sala Histórica', ativo: false },
      ])
      await espacosHistoricosPendentes
    })

    expect(screen.getByRole('dialog', { name: /novo evento/i })).toBeInTheDocument()
    expect(within(dialogNovo).getByLabelText(/título/i)).toHaveValue('')
    expect(within(dialogNovo).getByLabelText(/modalidade/i)).toHaveValue('PRESENCIAL')
  })

  it('deve abrir escolha ao editar evento recorrente, cancelar não envia PATCH', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return [mockEventoRecorrente]
      return []
    })

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    expect(dialogEscolha).toBeInTheDocument()

    // Clicar em cancelar
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /cancelar/i }))
    expect(dialogEscolha).not.toBeInTheDocument()
    expect(apiClient.patchWithAuth).not.toHaveBeenCalled()
  })

  it('deve enviar updateMode THIS e fromEventId ao editar apenas a ocorrência', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/eventos/${mockEventoRecorrente.id}`)) return mockEventoRecorrente
      if (url === '/eventos') return [mockEventoRecorrente]
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /apenas este evento/i }))

    const formDialog = await screen.findByRole('dialog', { name: /editar evento/i })
    const { getByLabelText, getByRole } = within(formDialog)

    await waitFor(() => {
      expect(getByLabelText(/título/i)).toHaveValue('Reunião Recorrente')
    })

    fireEvent.change(getByLabelText(/título/i), { target: { value: 'Reunião Recorrente Editada' } })
    fireEvent.click(getByRole('button', { name: /salvar/i }))

    // Confirmação de THIS
    const confirmDialog = await screen.findByRole('dialog', { name: /confirmar exceção/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /confirmar e salvar/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/series-recorrencia/${SERIE_ID}`, expect.objectContaining({
        updateMode: 'THIS',
        fromEventId: mockEventoRecorrente.id,
        changes: expect.objectContaining({
          titulo: 'Reunião Recorrente Editada'
        })
      }))
    })
    
    // Assegurar que os campos de série NÃO estão presentes em changes (verificado por ser o objeto vindo do form)
    const patchCall = vi.mocked(apiClient.patchWithAuth).mock.calls[0][1]
    expect(patchCall.changes).not.toHaveProperty('frequencia')
    expect(patchCall.changes).not.toHaveProperty('intervalo')
  })

  it('deve exibir erro da API se falhar no PATCH THIS', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/eventos/${mockEventoRecorrente.id}`)) return mockEventoRecorrente
      if (url === '/eventos') return [mockEventoRecorrente]
      return []
    })
    
    vi.mocked(apiClient.patchWithAuth).mockRejectedValueOnce(
      new apiClient.ApiError(409, 'Conflito de horários', { error: 'Conflito de horários' })
    )

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])
    
    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /apenas este evento/i }))

    const formDialog = await screen.findByRole('dialog', { name: /editar evento/i })
    const { getByRole } = within(formDialog)

    await waitFor(() => {
      expect(within(formDialog).getByLabelText(/título/i)).toHaveValue('Reunião Recorrente')
    })

    fireEvent.click(getByRole('button', { name: /salvar/i }))

    const confirmDialog = await screen.findByRole('dialog', { name: /confirmar exceção/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /confirmar e salvar/i }))

    const erroDiv = await screen.findByText('Conflito de horários')
    expect(erroDiv).toBeInTheDocument()
  })
  it('deve enviar updateMode THIS_AND_FUTURE e fromEventId ao editar este e os próximos', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/series-recorrencia/${SERIE_ID}`)) return { ...mockEventoRecorrente, frequencia: 'DIARIA', intervalo: 1, dataInicio: '2026-10-10', dataFim: '2026-10-20', horarioInicio: '10:00', horarioFim: '12:00' }
      if (url === '/eventos') return [mockEventoRecorrente]
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /este e os próximos eventos/i }))

    const formDialog = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    const { getByLabelText, getByRole } = within(formDialog)

    await waitFor(() => {
      expect(getByLabelText(/título/i)).toHaveValue('Reunião Recorrente')
    })

    fireEvent.change(getByLabelText(/título/i), { target: { value: 'Série Editada' } })
    fireEvent.click(getByRole('button', { name: /salvar série/i }))

    // Confirmação de THIS_AND_FUTURE
    const confirmDialog = await screen.findByRole('dialog', { name: /confirmar edição/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /confirmar e salvar/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/series-recorrencia/${SERIE_ID}`, expect.objectContaining({
        updateMode: 'THIS_AND_FUTURE',
        fromEventId: mockEventoRecorrente.id,
        changes: { titulo: 'Série Editada' }
      }))
    })
  })

  it('deve exibir erro da API se falhar no PATCH THIS_AND_FUTURE', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/series-recorrencia/${SERIE_ID}`)) return { ...mockEventoRecorrente, frequencia: 'DIARIA', intervalo: 1, dataInicio: '2026-10-10', dataFim: '2026-10-20', horarioInicio: '10:00', horarioFim: '12:00' }
      if (url === '/eventos') return [mockEventoRecorrente]
      return []
    })
    
    vi.mocked(apiClient.patchWithAuth).mockRejectedValueOnce(
      new apiClient.ApiError(409, 'Erro na série futura', { error: 'Erro na série futura' })
    )

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])
    
    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /este e os próximos eventos/i }))

    const formDialog = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    const { getByRole } = within(formDialog)

    await waitFor(() => {
      expect(within(formDialog).getByLabelText(/título/i)).toHaveValue('Reunião Recorrente')
    })

    fireEvent.change(within(formDialog).getByLabelText(/título/i), {
      target: { value: 'Reunião Recorrente com erro' }
    })
    fireEvent.click(getByRole('button', { name: /salvar série/i }))

    const confirmDialog = await screen.findByRole('dialog', { name: /confirmar edição/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /confirmar e salvar/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /confirmar edição/i })).not.toBeInTheDocument()
    })

    expect(screen.getByRole('dialog', { name: /editar evento recorrente/i })).toBeInTheDocument()

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some(alert => alert.textContent === 'Erro na série futura')).toBe(true)
  })

  it('deve exibir Local e Espaço no detalhe do evento presencial', async () => {
    const eventoComEspaco = {
      ...mockEventos[0],
      espacoId: ESPACO_ATIVO_ID,
    }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return [eventoComEspaco]
      if (url === `/eventos/${EVENTO_ID}`) return eventoComEspaco
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/espacos-locais?ativo=true') {
        return [{ id: ESPACO_ATIVO_ID, localId: LOCAL_ID, nome: 'Sala Principal', ativo: true }]
      }
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })

    render(<EventosView />)
    await screen.findByText('Reunião Presencial')

    fireEvent.click(screen.getByRole('button', { name: /ver/i }))
    const detalhe = await screen.findByRole('dialog', { name: /detalhes do evento/i })

    expect(within(detalhe).getByText('Sede')).toBeInTheDocument()
    expect(within(detalhe).getByText('Sala Principal')).toBeInTheDocument()
  })




  it('deve carregar Espaço inativo vinculado ao abrir detalhe histórico', async () => {
    const eventoHistorico = {
      ...mockEventos[0],
      espacoId: ESPACO_INATIVO_ID,
    }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return [eventoHistorico]
      if (url === `/eventos/${EVENTO_ID}`) return eventoHistorico
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/espacos-locais?ativo=true') {
        return [{ id: ESPACO_ATIVO_ID, localId: LOCAL_ID, nome: 'Sala Ativa', ativo: true }]
      }
      if (url === `/espacos-locais?localId=${LOCAL_ID}`) {
        return [
          { id: ESPACO_ATIVO_ID, localId: LOCAL_ID, nome: 'Sala Ativa', ativo: true },
          { id: ESPACO_INATIVO_ID, localId: LOCAL_ID, nome: 'Sala Histórica', ativo: false },
        ]
      }
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })

    render(<EventosView />)
    await screen.findByText('Reunião Presencial')

    fireEvent.click(screen.getByRole('button', { name: /ver/i }))
    const detalhe = await screen.findByRole('dialog', { name: /detalhes do evento/i })

    await waitFor(() => {
      expect(within(detalhe).getByText('Sala Histórica')).toBeInTheDocument()
    })
    expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(`/espacos-locais?localId=${LOCAL_ID}`)
  })


  it('deve oferecer cancelamento também no detalhe do evento', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return mockEventos
      if (url === `/eventos/${EVENTO_ID}`) return mockEventos[0]
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
    vi.mocked(apiClient.postWithAuth).mockResolvedValueOnce({ success: true })

    render(<EventosView />)
    await screen.findByText('Reunião Presencial')

    fireEvent.click(screen.getByRole('button', { name: /ver/i }))
    const detalhe = await screen.findByRole('dialog', { name: /detalhes do evento/i })
    fireEvent.click(within(detalhe).getByRole('button', { name: /cancelar evento/i }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith(`/eventos/${EVENTO_ID}/cancelar`, {})
    })
  })

  it('deve enviar somente espacoId em série legada ao alterar Espaço', async () => {
    const novoEspacoId = '99999999-9999-4999-8999-999999999998'
    const serieLegada = {
      ...mockEventoRecorrente,
      frequencia: 'DIARIA',
      intervalo: 2,
      dataInicio: '2026-10-10',
      dataFim: '2026-10-20',
      horarioInicio: '10:00',
      horarioFim: '12:00',
      espacoId: null,
    }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/series-recorrencia/${SERIE_ID}`)) return serieLegada
      if (url === '/eventos') return [mockEventoRecorrente]
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/espacos-locais?ativo=true') {
        return [{ id: novoEspacoId, localId: LOCAL_ID, nome: 'Templo', ativo: true }]
      }
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})

    render(<EventosView />)
    await screen.findByText('Reunião Recorrente')

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])
    const escolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    fireEvent.click(within(escolha).getByRole('button', { name: /este e os próximos eventos/i }))

    const form = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    await waitFor(() => {
      expect(within(form).getByLabelText(/título/i)).toHaveValue('Reunião Recorrente')
    })

    fireEvent.change(within(form).getByLabelText(/espaço/i), { target: { value: novoEspacoId } })
    fireEvent.click(within(form).getByRole('button', { name: /salvar série/i }))

    const confirmacao = await screen.findByRole('dialog', { name: /confirmar edição/i })
    fireEvent.click(within(confirmacao).getByRole('button', { name: /confirmar e salvar/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(
        `/series-recorrencia/${SERIE_ID}`,
        expect.objectContaining({
          updateMode: 'THIS_AND_FUTURE',
          fromEventId: mockEventoRecorrente.id,
          changes: { espacoId: novoEspacoId },
        })
      )
    })

    const patchCall = vi.mocked(apiClient.patchWithAuth).mock.calls[0][1]
    expect(patchCall.changes).not.toHaveProperty('intervalo')
    expect(patchCall.changes).not.toHaveProperty('titulo')
    expect(patchCall.changes).not.toHaveProperty('dataInicio')
  })


  it('deve fechar o detalhe e exibir erro global quando o cancelamento falhar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return mockEventos
      if (url === `/eventos/${EVENTO_ID}`) return mockEventos[0]
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
    vi.mocked(apiClient.postWithAuth).mockRejectedValueOnce(
      new apiClient.ApiError(409, 'Evento passado', { error: 'Ocorrências já encerradas não podem ser canceladas.' })
    )

    render(<EventosView />)
    await screen.findByText('Reunião Presencial')

    fireEvent.click(screen.getByRole('button', { name: /ver/i }))
    const detalhe = await screen.findByRole('dialog', { name: /detalhes do evento/i })
    fireEvent.click(within(detalhe).getByRole('button', { name: /cancelar evento/i }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith(`/eventos/${EVENTO_ID}/cancelar`, {})
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /detalhes do evento/i })).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Ocorrências já encerradas não podem ser canceladas.')).toBeInTheDocument()
  })

})
