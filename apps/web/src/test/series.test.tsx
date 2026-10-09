import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { SeriesView } from '../components/series/SeriesView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  postWithAuth: vi.fn(),
  patchWithAuth: vi.fn(),
  deleteWithAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    body: any
    constructor(status: number, message: string, body: any) {
      super(message)
      this.status = status
      this.body = body
    }
  }
}))

const MOCK_SERIES = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    titulo: 'Reunião Semanal',
    descricao: null,
    pauta: null,
    modalidade: 'ONLINE',
    frequencia: 'SEMANAL',
    intervalo: 1,
    dataInicio: '2025-01-01',
    dataFim: '2099-12-31',
    horarioInicio: '20:00',
    horarioFim: '21:00',
    diaSemana: 1, // Segunda
    diaMes: null,
    posicaoSemanaMes: null,
    localId: null,
    espacoId: null,
    urlOnline: 'https://meet.google.com/abc',
    observacoes: null,
    organizadorMembroId: '2b4c13a0-7f2e-4b9d-a8e5-3d5f9c8b7a6d',
    regionalId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    administracaoId: null,
    setorId: null,
    casaId: null,
    grupoTrabalhoId: null,
    ativo: true,
  }
]

const MOCK_LOOKUPS = {
  locais: [{ id: '9f8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4', nome: 'Sede Regional' }],
  membros: [{ id: '2b4c13a0-7f2e-4b9d-a8e5-3d5f9c8b7a6d', nome: 'João' }],
  regionais: [{ id: 'd290f1ee-6c54-4b01-90e6-d701748f0851', nome: 'SP' }],
  administracoes: [],
  setores: [],
  casas: [],
  gruposTrabalho: []
}

describe('SeriesView', () => {
  beforeEach(() => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/series-recorrencia') return MOCK_SERIES
      if (url === '/locais') return MOCK_LOOKUPS.locais
      if (url === '/membros') return MOCK_LOOKUPS.membros
      if (url === '/regionais') return MOCK_LOOKUPS.regionais
      if (url === '/administracoes') return MOCK_LOOKUPS.administracoes
      if (url === '/setores') return MOCK_LOOKUPS.setores
      if (url === '/casas') return MOCK_LOOKUPS.casas
      if (url === '/grupos-trabalho') return MOCK_LOOKUPS.gruposTrabalho
      return []
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllGlobals()
  })

  it('deve listar as séries e permitir visualizar os detalhes num diálogo acessível', async () => {
    render(<SeriesView />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Reunião Semanal')).toBeInTheDocument()
    })

    expect(screen.getByText('01/01/2025')).toBeInTheDocument()

    // Abre detalhes
    const btns = screen.getAllByText('Ver')
    fireEvent.click(btns[0])

    // Verifica acessibilidade do diálogo de detalhe
    const dialog = screen.getByRole('dialog', { name: 'Detalhes da Série' })
    expect(dialog).toBeInTheDocument()
    const view = within(dialog)
    expect(view.getByText('Semanal')).toBeInTheDocument()
    expect(view.getByText(/01\/01\/2025\s*20:00/)).toBeInTheDocument()

    // Fecha o modal
    fireEvent.click(screen.getByText('✕'))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Detalhes da Série' })).not.toBeInTheDocument()
    })
  })

  it('deve alternar campos condicionais de modalidade e limpar incompatíveis', async () => {
    render(<SeriesView />)

    await waitFor(() => screen.getByText('+ Nova Série'))
    fireEvent.click(screen.getByText('+ Nova Série'))

    // Seleciona modalidade HIBRIDO
    const modalidadeSelect = screen.getByLabelText(/Modalidade \*/i)
    fireEvent.change(modalidadeSelect, { target: { value: 'HIBRIDO' } })

    expect(screen.getByLabelText(/Local \*/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/URL Online \*/i)).toBeInTheDocument()

    // Preenche ambos
    fireEvent.change(screen.getByLabelText(/Local \*/i), { target: { value: '9f8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4' } })
    fireEvent.change(screen.getByLabelText(/URL Online \*/i), { target: { value: 'https://zoom.us' } })

    // Altera para PRESENCIAL (deve esconder URL Online)
    fireEvent.change(modalidadeSelect, { target: { value: 'PRESENCIAL' } })
    expect(screen.queryByLabelText(/URL Online \*/i)).not.toBeInTheDocument()

    // Submete e verifica o payload para confirmar que urlOnline foi limpo
    fireEvent.change(screen.getByLabelText(/Título \*/i), { target: { value: 'Teste' } })
    fireEvent.change(screen.getByLabelText(/Data Início \*/i), { target: { value: '2025-01-01' } })
    fireEvent.change(screen.getByLabelText(/Data Fim \*/i), { target: { value: '2025-01-31' } })
    fireEvent.change(screen.getByLabelText(/Horário Início \*/i), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText(/Horário Fim \*/i), { target: { value: '11:00' } })
    
    // Escopo
    fireEvent.change(screen.getByLabelText(/Tipo de Escopo/i), { target: { value: 'regional' } })
    fireEvent.change(screen.getByLabelText(/Regional \*/i), { target: { value: 'd290f1ee-6c54-4b01-90e6-d701748f0851' } })

    vi.mocked(apiClient.postWithAuth).mockResolvedValueOnce({})
    fireEvent.click(screen.getByText('Salvar Série'))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalled()
    })
    
    const payload = vi.mocked(apiClient.postWithAuth).mock.calls[0][1] as any
    expect(payload.modalidade).toBe('PRESENCIAL')
    expect(payload.urlOnline).toBeNull()
    expect(payload.localId).toBe('9f8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4')
  })

  it('deve apresentar os campos condicionais corretos para as frequências e validar o formulário (role="alert")', async () => {
    render(<SeriesView />)

    await waitFor(() => screen.getByText('+ Nova Série'))
    fireEvent.click(screen.getByText('+ Nova Série'))

    const form = screen.getByRole('dialog', { name: 'Nova Série de Recorrência' }).querySelector('form')
    expect(form).toHaveAttribute('noValidate')

    // SEMANAL: exibe diaSemana
    const frequenciaSelect = screen.getByLabelText(/Frequência \*/i)
    fireEvent.change(frequenciaSelect, { target: { value: 'SEMANAL' } })
    expect(screen.getByLabelText(/Dia da Semana \*/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Dia do Mês \*/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Posição na Semana \*/i)).not.toBeInTheDocument()

    // MENSAL_DIA_FIXO: exibe diaMes
    fireEvent.change(frequenciaSelect, { target: { value: 'MENSAL_DIA_FIXO' } })
    expect(screen.queryByLabelText(/Dia da Semana \*/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Dia do Mês \*/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Posição na Semana \*/i)).not.toBeInTheDocument()

    // MENSAL_POSICAO_SEMANA: exibe diaSemana e posicaoSemanaMes
    fireEvent.change(frequenciaSelect, { target: { value: 'MENSAL_POSICAO_SEMANA' } })
    expect(screen.getByLabelText(/Dia da Semana \*/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Posição na Semana \*/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Dia do Mês \*/i)).not.toBeInTheDocument()

    // Testa as mensagens de erro acessíveis disparando o submit vazio
    fireEvent.click(screen.getByText('Salvar Série'))

    // Deve aparecer role="alert" do zod
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(alerts.length).toBeGreaterThan(0)
    })
  })

  it('deve permitir criar uma série com strings nativas de data/hora, validando o envio', async () => {
    render(<SeriesView />)

    await waitFor(() => screen.getByText('+ Nova Série'))
    fireEvent.click(screen.getByText('+ Nova Série'))

    fireEvent.change(screen.getByLabelText(/Título \*/i), { target: { value: 'Série Integrada' } })
    fireEvent.change(screen.getByLabelText(/Data Início \*/i), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText(/Data Fim \*/i), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText(/Horário Início \*/i), { target: { value: '08:30' } })
    fireEvent.change(screen.getByLabelText(/Horário Fim \*/i), { target: { value: '12:00' } })

    fireEvent.change(screen.getByLabelText(/Frequência \*/i), { target: { value: 'DIARIA' } })
    // Diaria nao precisa de dias especificos

    fireEvent.change(screen.getByLabelText(/Modalidade \*/i), { target: { value: 'ONLINE' } })
    fireEvent.change(screen.getByLabelText(/URL Online \*/i), { target: { value: 'https://teams.microsoft.com/xyz' } })

    fireEvent.change(screen.getByLabelText(/Tipo de Escopo/i), { target: { value: 'regional' } })
    fireEvent.change(screen.getByLabelText(/Regional \*/i), { target: { value: 'd290f1ee-6c54-4b01-90e6-d701748f0851' } })

    vi.mocked(apiClient.postWithAuth).mockResolvedValueOnce({})
    fireEvent.click(screen.getByText('Salvar Série'))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/series-recorrencia', expect.objectContaining({
        titulo: 'Série Integrada',
        dataInicio: '2026-03-01',
        dataFim: '2026-04-01',
        horarioInicio: '08:30',
        horarioFim: '12:00',
        frequencia: 'DIARIA',
        intervalo: 1,
        modalidade: 'ONLINE',
        urlOnline: 'https://teams.microsoft.com/xyz',
        regionalId: 'd290f1ee-6c54-4b01-90e6-d701748f0851'
      }))
    })
  })
  it('deve abrir edição, exigir confirmação e enviar PATCH com updateMode ALL', async () => {
    render(<SeriesView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Semanal')).toBeInTheDocument()
    })

    const btnEditar = screen.getByText('Editar')
    fireEvent.click(btnEditar)

    // Formulario de edição aberto
    const form = screen.getByRole('dialog', { name: 'Editar Série de Recorrência' })
    expect(form).toBeInTheDocument()

    // Altera titulo
    fireEvent.change(screen.getByLabelText(/Título \*/i), { target: { value: 'Reunião Semanal Editada' } })
    
    // Tenta salvar, deve abrir confirmacao
    fireEvent.click(screen.getByText('Salvar Série'))

    const confirmModal = await screen.findByRole('dialog', { name: 'Confirmar Edição de Série' })
    expect(confirmModal).toBeInTheDocument()

    // Confirmar
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})
    fireEvent.click(screen.getByText('Confirmar alterações'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(
        '/series-recorrencia/f47ac10b-58cc-4372-a567-0e02b2c3d479',
        {
          updateMode: 'ALL',
          changes: { titulo: 'Reunião Semanal Editada' }
        }
      )
    })
  })

  it('deve oferecer cadastro rápido de Local e Espaço ao editar série presencial', async () => {
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

    const localId = MOCK_LOOKUPS.locais[0].id
    const novoEspacoId = '33333333-3333-4333-8333-333333333333'
    const seriePresencial = {
      ...MOCK_SERIES[0],
      modalidade: 'PRESENCIAL',
      localId,
      espacoId: null,
      urlOnline: null,
    }

    vi.mocked(apiClient.postWithAuth).mockImplementation(async (url) => {
      if (url === '/espacos-locais') {
        return { id: novoEspacoId, localId, nome: 'Sala Nova', ativo: true }
      }
      return {}
    })

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/series-recorrencia') return [seriePresencial]
      if (url === '/locais') return MOCK_LOOKUPS.locais
      if (url === '/espacos-locais?ativo=true') return []
      if (url === '/membros') return MOCK_LOOKUPS.membros
      if (url === '/regionais') return MOCK_LOOKUPS.regionais
      if (url === '/administracoes') return MOCK_LOOKUPS.administracoes
      if (url === '/setores') return MOCK_LOOKUPS.setores
      if (url === '/casas') return MOCK_LOOKUPS.casas
      if (url === '/grupos-trabalho') return MOCK_LOOKUPS.gruposTrabalho
      return []
    })

    render(<SeriesView />)
    await screen.findByText('Reunião Semanal')
    fireEvent.click(screen.getByText('Editar'))

    const dialog = await screen.findByRole('dialog', { name: 'Editar Série de Recorrência' })
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/Local \*/i)).toHaveValue(localId)
    })

    const criarLocal = within(dialog).getByRole('button', { name: /criar local sem sair/i })
    const criarEspaco = within(dialog).getByRole('button', { name: /criar espaço sem sair/i })
    expect(criarLocal).toBeInTheDocument()
    expect(criarEspaco).toBeInTheDocument()

    fireEvent.click(criarLocal)
    const localRapido = await screen.findByRole('dialog', { name: /criar local/i })
    fireEvent.change(within(localRapido).getByLabelText('CEP do novo local'), {
      target: { value: '03127001' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://viacep.com.br/ws/03127001/json/',
        expect.objectContaining({ signal: expect.anything() })
      )
      expect(within(localRapido).getByLabelText('Endereço do novo local')).toHaveValue('Rua Ibitirama')
      expect(within(localRapido).getByLabelText('Bairro do novo local')).toHaveValue('Vila Prudente')
      expect(within(localRapido).getByLabelText('Cidade do novo local')).toHaveValue('São Paulo')
      expect(within(localRapido).getByLabelText('UF do novo local')).toHaveValue('SP')
    })

    fireEvent.click(within(localRapido).getByRole('button', { name: /voltar à série/i }))

    fireEvent.click(criarEspaco)
    const espacoRapido = await screen.findByRole('dialog', { name: /criar espaço/i })
    fireEvent.change(within(espacoRapido).getByLabelText('Nome do novo espaço'), {
      target: { value: 'Sala Nova' },
    })
    fireEvent.click(within(espacoRapido).getByRole('button', { name: /criar e selecionar/i }))

    await waitFor(() => {
      expect(within(dialog).getByLabelText('Espaço')).toHaveValue(novoEspacoId)
    })

    fireEvent.click(within(dialog).getByRole('button', { name: /salvar série/i }))

    expect(await screen.findByRole('dialog', { name: 'Confirmar Edição de Série' })).toBeInTheDocument()
  })

  it('deve cancelar ViaCEP e preservar endereço manual no cadastro rápido da série', async () => {
    let resolver: ((value: any) => void) | undefined
    const pendente = new Promise<any>(resolve => {
      resolver = resolve
    })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendente))

    const localId = MOCK_LOOKUPS.locais[0].id
    const seriePresencial = {
      ...MOCK_SERIES[0],
      modalidade: 'PRESENCIAL',
      localId,
      espacoId: null,
      urlOnline: null,
    }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/series-recorrencia') return [seriePresencial]
      if (url === '/locais') return MOCK_LOOKUPS.locais
      if (url === '/espacos-locais?ativo=true') return []
      if (url === '/membros') return MOCK_LOOKUPS.membros
      if (url === '/regionais') return MOCK_LOOKUPS.regionais
      if (url === '/administracoes') return MOCK_LOOKUPS.administracoes
      if (url === '/setores') return MOCK_LOOKUPS.setores
      if (url === '/casas') return MOCK_LOOKUPS.casas
      if (url === '/grupos-trabalho') return MOCK_LOOKUPS.gruposTrabalho
      return []
    })

    render(<SeriesView />)
    await screen.findByText('Reunião Semanal')
    fireEvent.click(screen.getByText('Editar'))

    const dialog = await screen.findByRole('dialog', { name: 'Editar Série de Recorrência' })
    await waitFor(() => expect(within(dialog).getByLabelText(/Local \*/i)).toHaveValue(localId))

    fireEvent.click(within(dialog).getByRole('button', { name: /criar local sem sair/i }))
    const localRapido = await screen.findByRole('dialog', { name: /criar local/i })

    fireEvent.change(within(localRapido).getByLabelText('CEP do novo local'), {
      target: { value: '03127001' },
    })

    const usarManual = await within(localRapido).findByRole('button', { name: /usar endereço manualmente/i })
    fireEvent.click(usarManual)

    const endereco = within(localRapido).getByLabelText('Endereço do novo local')
    fireEvent.change(endereco, { target: { value: 'Rua Digitada Manualmente' } })
    expect(endereco).toHaveValue('Rua Digitada Manualmente')

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
  })

  it('deve conter e restaurar foco nos diálogos rápidos da série', async () => {
    const localId = MOCK_LOOKUPS.locais[0].id
    const seriePresencial = {
      ...MOCK_SERIES[0],
      modalidade: 'PRESENCIAL',
      localId,
      espacoId: null,
      urlOnline: null,
    }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/series-recorrencia') return [seriePresencial]
      if (url === '/locais') return MOCK_LOOKUPS.locais
      if (url === '/espacos-locais?ativo=true') return []
      if (url === '/membros') return MOCK_LOOKUPS.membros
      if (url === '/regionais') return MOCK_LOOKUPS.regionais
      if (url === '/administracoes') return MOCK_LOOKUPS.administracoes
      if (url === '/setores') return MOCK_LOOKUPS.setores
      if (url === '/casas') return MOCK_LOOKUPS.casas
      if (url === '/grupos-trabalho') return MOCK_LOOKUPS.gruposTrabalho
      return []
    })

    render(<SeriesView />)
    await screen.findByText('Reunião Semanal')
    fireEvent.click(screen.getByText('Editar'))

    const dialog = await screen.findByRole('dialog', { name: 'Editar Série de Recorrência' })
    await waitFor(() => expect(within(dialog).getByLabelText(/Local \*/i)).toHaveValue(localId))

    const abrirLocal = within(dialog).getByRole('button', { name: /criar local sem sair/i })
    abrirLocal.focus()
    fireEvent.click(abrirLocal)

    const localRapido = await screen.findByRole('dialog', { name: /criar local/i })
    const primeiroLocal = within(localRapido).getByLabelText('CEP do novo local')
    await waitFor(() => expect(primeiroLocal).toHaveFocus())

    const ultimoLocal = within(localRapido).getByRole('button', { name: /criar e selecionar/i })
    ultimoLocal.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(primeiroLocal).toHaveFocus()

    fireEvent.click(within(localRapido).getByRole('button', { name: /voltar à série/i }))
    await waitFor(() => expect(abrirLocal).toHaveFocus())

    const abrirEspaco = within(dialog).getByRole('button', { name: /criar espaço sem sair/i })
    abrirEspaco.focus()
    fireEvent.click(abrirEspaco)

    const espacoRapido = await screen.findByRole('dialog', { name: /criar espaço/i })
    const primeiroEspaco = within(espacoRapido).getByLabelText('Nome do novo espaço')
    await waitFor(() => expect(primeiroEspaco).toHaveFocus())

    const ultimoEspaco = within(espacoRapido).getByRole('button', { name: /criar e selecionar/i })
    ultimoEspaco.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(primeiroEspaco).toHaveFocus()

    fireEvent.click(within(espacoRapido).getByRole('button', { name: /voltar à série/i }))
    await waitFor(() => expect(abrirEspaco).toHaveFocus())
  })

  it('deve mostrar espaço histórico inativo e exigir substituição antes de editar a série', async () => {
    const localId = MOCK_LOOKUPS.locais[0].id
    const espacoInativoId = '11111111-1111-4111-8111-111111111111'
    const espacoAtivoId = '22222222-2222-4222-8222-222222222222'
    const serieComEspacoInativo = {
      ...MOCK_SERIES[0],
      modalidade: 'PRESENCIAL',
      localId,
      espacoId: espacoInativoId,
      urlOnline: null,
    }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/series-recorrencia') return [serieComEspacoInativo]
      if (url === '/locais') return MOCK_LOOKUPS.locais
      if (url === '/espacos-locais?ativo=true') {
        return [{ id: espacoAtivoId, localId, nome: 'Sala Ativa', ativo: true }]
      }
      if (url === `/espacos-locais?localId=${localId}`) {
        return [
          { id: espacoAtivoId, localId, nome: 'Sala Ativa', ativo: true },
          { id: espacoInativoId, localId, nome: 'Sala Histórica', ativo: false },
        ]
      }
      if (url === '/membros') return MOCK_LOOKUPS.membros
      if (url === '/regionais') return MOCK_LOOKUPS.regionais
      if (url === '/administracoes') return MOCK_LOOKUPS.administracoes
      if (url === '/setores') return MOCK_LOOKUPS.setores
      if (url === '/casas') return MOCK_LOOKUPS.casas
      if (url === '/grupos-trabalho') return MOCK_LOOKUPS.gruposTrabalho
      return []
    })

    render(<SeriesView />)
    await waitFor(() => expect(screen.getByText('Reunião Semanal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Editar'))

    const dialog = await screen.findByRole('dialog', { name: 'Editar Série de Recorrência' })

    await waitFor(() => {
      expect(within(dialog).getByLabelText(/Local \*/i)).toHaveValue(localId)
    })

    const seletorEspaco = within(dialog).getByLabelText('Espaço')

    await waitFor(() => {
      expect(seletorEspaco).toHaveValue(espacoInativoId)
      expect(within(dialog).getByRole('option', { name: /Sala Histórica.*inativo/i })).toBeInTheDocument()
    })

    fireEvent.change(within(dialog).getByLabelText(/Título \*/i), {
      target: { value: 'Reunião Semanal Editada' },
    })
    fireEvent.click(within(dialog).getByText('Salvar Série'))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'O espaço atual está inativo'
    )
    expect(screen.queryByRole('dialog', { name: 'Confirmar Edição de Série' })).not.toBeInTheDocument()

    fireEvent.change(seletorEspaco, { target: { value: espacoAtivoId } })
    fireEvent.click(within(dialog).getByText('Salvar Série'))

    expect(await screen.findByRole('dialog', { name: 'Confirmar Edição de Série' })).toBeInTheDocument()
  })

  it('deve ignorar lookup histórico atrasado ao abrir Nova Série', async () => {
    const localId = MOCK_LOOKUPS.locais[0].id
    const espacoInativoId = '33333333-3333-4333-8333-333333333333'
    const serieComEspacoInativo = {
      ...MOCK_SERIES[0],
      modalidade: 'PRESENCIAL',
      localId,
      espacoId: espacoInativoId,
      urlOnline: null,
    }

    let resolverEspacosHistoricos: ((value: any[]) => void) | undefined
    const espacosHistoricosPendentes = new Promise<any[]>(resolve => {
      resolverEspacosHistoricos = resolve
    })

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/series-recorrencia') return [serieComEspacoInativo]
      if (url === '/locais') return MOCK_LOOKUPS.locais
      if (url === '/espacos-locais?ativo=true') return []
      if (url === `/espacos-locais?localId=${localId}`) {
        return espacosHistoricosPendentes as any
      }
      if (url === '/membros') return MOCK_LOOKUPS.membros
      if (url === '/regionais') return MOCK_LOOKUPS.regionais
      if (url === '/administracoes') return MOCK_LOOKUPS.administracoes
      if (url === '/setores') return MOCK_LOOKUPS.setores
      if (url === '/casas') return MOCK_LOOKUPS.casas
      if (url === '/grupos-trabalho') return MOCK_LOOKUPS.gruposTrabalho
      return []
    })

    render(<SeriesView />)
    await waitFor(() => expect(screen.getByText('Reunião Semanal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Editar'))
    fireEvent.click(screen.getByText('+ Nova Série'))

    const dialogNovo = await screen.findByRole('dialog', { name: 'Nova Série de Recorrência' })
    expect(within(dialogNovo).getByLabelText(/Título \*/i)).toHaveValue('')

    resolverEspacosHistoricos?.([
      { id: espacoInativoId, localId, nome: 'Sala Histórica', ativo: false },
    ])
    await espacosHistoricosPendentes

    expect(screen.getByRole('dialog', { name: 'Nova Série de Recorrência' })).toBeInTheDocument()
    expect(within(dialogNovo).getByLabelText(/Título \*/i)).toHaveValue('')
  })

  it('deve cancelar edição pendente ao abrir detalhes da série', async () => {
    const localId = MOCK_LOOKUPS.locais[0].id
    const espacoInativoId = '44444444-4444-4444-8444-444444444444'
    const serieComEspacoInativo = {
      ...MOCK_SERIES[0],
      modalidade: 'PRESENCIAL',
      localId,
      espacoId: espacoInativoId,
      urlOnline: null,
    }

    let resolverEspacosHistoricos: ((value: any[]) => void) | undefined
    const espacosHistoricosPendentes = new Promise<any[]>(resolve => {
      resolverEspacosHistoricos = resolve
    })

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/series-recorrencia') return [serieComEspacoInativo]
      if (url === '/locais') return MOCK_LOOKUPS.locais
      if (url === '/espacos-locais?ativo=true') return []
      if (url === `/espacos-locais?localId=${localId}`) return espacosHistoricosPendentes as any
      if (url === '/membros') return MOCK_LOOKUPS.membros
      if (url === '/regionais') return MOCK_LOOKUPS.regionais
      if (url === '/administracoes') return MOCK_LOOKUPS.administracoes
      if (url === '/setores') return MOCK_LOOKUPS.setores
      if (url === '/casas') return MOCK_LOOKUPS.casas
      if (url === '/grupos-trabalho') return MOCK_LOOKUPS.gruposTrabalho
      return []
    })

    render(<SeriesView />)
    await waitFor(() => expect(screen.getByText('Reunião Semanal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Editar'))
    fireEvent.click(screen.getByText('Ver'))

    const detalhes = await screen.findByRole('dialog', { name: 'Detalhes da Série' })
    expect(detalhes).toBeInTheDocument()

    resolverEspacosHistoricos?.([
      { id: espacoInativoId, localId, nome: 'Sala Histórica', ativo: false },
    ])
    await espacosHistoricosPendentes

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Detalhes da Série' })).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: 'Editar Série de Recorrência' })).not.toBeInTheDocument()
    })
  })

  it('deve cancelar edição pendente ao inativar a série', async () => {
    const localId = MOCK_LOOKUPS.locais[0].id
    const espacoInativoId = '55555555-5555-4555-8555-555555555555'
    const serieComEspacoInativo = {
      ...MOCK_SERIES[0],
      modalidade: 'PRESENCIAL',
      localId,
      espacoId: espacoInativoId,
      urlOnline: null,
    }

    let resolverEspacosHistoricos: ((value: any[]) => void) | undefined
    const espacosHistoricosPendentes = new Promise<any[]>(resolve => {
      resolverEspacosHistoricos = resolve
    })

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/series-recorrencia') return [serieComEspacoInativo]
      if (url === '/locais') return MOCK_LOOKUPS.locais
      if (url === '/espacos-locais?ativo=true') return []
      if (url === `/espacos-locais?localId=${localId}`) return espacosHistoricosPendentes as any
      if (url === '/membros') return MOCK_LOOKUPS.membros
      if (url === '/regionais') return MOCK_LOOKUPS.regionais
      if (url === '/administracoes') return MOCK_LOOKUPS.administracoes
      if (url === '/setores') return MOCK_LOOKUPS.setores
      if (url === '/casas') return MOCK_LOOKUPS.casas
      if (url === '/grupos-trabalho') return MOCK_LOOKUPS.gruposTrabalho
      return []
    })

    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})

    render(<SeriesView />)
    await waitFor(() => expect(screen.getByText('Reunião Semanal')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Editar'))
    fireEvent.click(screen.getByText('Inativar'))

    const confirmacao = await screen.findByRole('dialog', { name: 'Inativar Série' })
    fireEvent.click(within(confirmacao).getByText('Sim, Inativar Futuros'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(
        '/series-recorrencia/f47ac10b-58cc-4372-a567-0e02b2c3d479',
        { updateMode: 'ALL', changes: { ativo: false } }
      )
    })

    resolverEspacosHistoricos?.([
      { id: espacoInativoId, localId, nome: 'Sala Histórica', ativo: false },
    ])
    await espacosHistoricosPendentes

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Editar Série de Recorrência' })).not.toBeInTheDocument()
    })
    expect(apiClient.patchWithAuth).toHaveBeenCalledTimes(1)
  })

  it('deve abrir inativação, exigir confirmação e enviar PATCH com updateMode ALL e ativo falso', async () => {
    render(<SeriesView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Semanal')).toBeInTheDocument()
    })

    const btnInativar = screen.getByText('Inativar')
    fireEvent.click(btnInativar)

    const confirmModal = await screen.findByRole('dialog', { name: 'Inativar Série' })
    expect(confirmModal).toBeInTheDocument()

    // Confirmar
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})
    fireEvent.click(screen.getByText('Sim, Inativar Futuros'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith('/series-recorrencia/f47ac10b-58cc-4372-a567-0e02b2c3d479', {
        updateMode: 'ALL',
        changes: { ativo: false }
      })
    })
  })

  it('deve cancelar confirmação de edição e inativação sem enviar PATCH', async () => {
    render(<SeriesView />)
    await waitFor(() => screen.getByText('Reunião Semanal'))

    // Inativação
    fireEvent.click(screen.getByText('Inativar'))
    const confirmInativar = await screen.findByRole('dialog', { name: 'Inativar Série' })
    
    // Cancela
    fireEvent.click(within(confirmInativar).getByText('Cancelar'))
    
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Inativar Série' })).not.toBeInTheDocument()
    })
    expect(apiClient.patchWithAuth).not.toHaveBeenCalled()
  })

  it('deve tratar erro de API no PATCH de edição', async () => {
    render(<SeriesView />)
    await waitFor(() => screen.getByText('Reunião Semanal'))

    fireEvent.click(screen.getByText('Editar'))
    await screen.findByRole('dialog', { name: 'Editar Série de Recorrência' })

    fireEvent.change(screen.getByLabelText(/Título \*/i), {
      target: { value: 'Reunião com erro no PATCH' }
    })
    fireEvent.click(screen.getByText('Salvar Série'))
    await screen.findByRole('dialog', { name: 'Confirmar Edição de Série' })

    vi.mocked(apiClient.patchWithAuth).mockRejectedValueOnce(new apiClient.ApiError(400, 'Erro teste', { error: 'Mensagem de erro de API' }))
    fireEvent.click(screen.getByText('Confirmar alterações'))

    // Dialog fecha e mostra erro na tela principal ou volta pro form
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Confirmar Edição de Série' })).not.toBeInTheDocument()
      expect(screen.getByText('Mensagem de erro de API')).toBeInTheDocument()
    })
  })
})
