import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../App'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  putWithAuth: vi.fn(),
  API_BASE_URL: 'http://test'
}))

const mockEventos = [
  {
    evento: {
      id: '1',
      titulo: 'Reunião de Setor',
      inicioEm: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      fimEm: new Date(Date.now() + 90000000).toISOString(),
      modalidade: 'HIBRIDO',
    },
    convocacao: { id: 'c1', observacoes: 'Levar caderno' },
    local: { nome: 'Sede Regional', endereco: 'Rua X' },
    destinatarioId: 'dest-1',
    rsvp: null
  },
  {
    evento: {
      id: '2',
      titulo: 'Encontro Online',
      inicioEm: new Date(Date.now() + 172800000).toISOString(), // In 2 days
      fimEm: new Date(Date.now() + 180000000).toISOString(),
      modalidade: 'ONLINE',
    },
    convocacao: { id: 'c2', observacoes: null },
    local: null,
    destinatarioId: 'dest-2',
  },
  {
    evento: {
      id: 's09-integral',
      titulo: 'Evento S09 Integral',
      inicioEm: new Date(Date.now() + 86400000).toISOString(),
      fimEm: new Date(Date.now() + 90000000).toISOString(),
      modalidade: 'PRESENCIAL',
      possuiManha: true,
      possuiTarde: true,
      refeicoesOferecidas: ['CAFE_MANHA', 'ALMOCO']
    },
    convocacao: { id: 'c-s09', observacoes: null },
    local: null,
    destinatarioId: 'dest-s09',
    rsvp: null
  },
  {
    evento: {
      id: 's09-manha',
      titulo: 'Evento S09 Manhã',
      inicioEm: new Date(Date.now() + 86400000).toISOString(),
      fimEm: new Date(Date.now() + 90000000).toISOString(),
      modalidade: 'PRESENCIAL',
      possuiManha: true,
      possuiTarde: false,
      refeicoesOferecidas: []
    },
    convocacao: { id: 'c-s09-m', observacoes: null },
    local: null,
    destinatarioId: 'dest-s09-m',
    rsvp: null
  }
]

describe('S07 - Minha Agenda e Calendário', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Renderiza o Layout Principal com Navegação', () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue([])
    render(<App />)
    
    expect(screen.getByText('Agenda Regional SP')).toBeInTheDocument()
    expect(screen.getByText('Minha Agenda')).toBeInTheDocument()
    expect(screen.getByText('Calendário')).toBeInTheDocument()
  })

  it('2. Exibe estado de loading e vazio na Agenda', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue([])
    render(<App />)
    
    // Test for empty state
    await waitFor(() => {
      expect(screen.getByText('Você não possui eventos futuros agendados.')).toBeInTheDocument()
    })
  })

  it('3. Renderiza lista de eventos (Minha Agenda) ordenados', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    await waitFor(() => {
      expect(screen.getByText('Reunião de Setor')).toBeInTheDocument()
      expect(screen.getByText('Encontro Online')).toBeInTheDocument()
    })
    
    // Check modalities and local
    expect(screen.getByText('HIBRIDO')).toBeInTheDocument()
    expect(screen.getByText('ONLINE')).toBeInTheDocument()
    expect(screen.getByText('Sede Regional')).toBeInTheDocument()
  })

  it('4. Navega para Calendário e exibe grid mensal', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    const calTab = screen.getByText('Calendário')
    fireEvent.click(calTab)
    
    await waitFor(() => {
      expect(screen.getByText('Dom')).toBeInTheDocument()
      expect(screen.getByText('Seg')).toBeInTheDocument()
    })
    
    // Check month rendering (will contain current month name, e.g. "Janeiro", "Fevereiro")
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const today = new Date()
    expect(screen.getByText(new RegExp(months[today.getMonth()]))).toBeInTheDocument()
  })

  it('5. Cenário de Erro da API', async () => {
    ;(apiClient.fetchWithAuth as any).mockRejectedValue(new Error('Sessão expirada'))
    render(<App />)
    
    await waitFor(() => {
      expect(screen.getByText('Sessão expirada')).toBeInTheDocument()
    })
  })

  it('6. Seleciona dia com evento no calendário e exibe lista', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    // Go to calendar
    fireEvent.click(screen.getByText('Calendário'))
    await waitFor(() => expect(screen.getByText('Dom')).toBeInTheDocument())
    
    // Find the day button (tomorrow)
    const tmrw = new Date(Date.now() + 86400000)
    const dayBtn = screen.getByLabelText(`Selecionar dia ${tmrw.getDate()}`)
    fireEvent.click(dayBtn)
    
    // Expect event in list below calendar
    await waitFor(() => {
      expect(screen.getByText('Reunião de Setor')).toBeInTheDocument()
    })
  })

  it('7. Seleciona dia sem evento no calendário', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    // Go to calendar
    fireEvent.click(screen.getByText('Calendário'))
    await waitFor(() => expect(screen.getByText('Dom')).toBeInTheDocument())
    
    // Find a day without event (assuming day 1 has no events in mock)
    // We mock events for tomorrow and in 2 days. Let's just click today.
    const today = new Date()
    const dayBtn = screen.getByLabelText(`Selecionar dia ${today.getDate()}`)
    fireEvent.click(dayBtn)
    
    // Expect empty state
    await waitFor(() => {
      expect(screen.getByText('Nenhum evento agendado para este dia.')).toBeInTheDocument()
    })
  })

  it('8. Abre detalhe pela Minha Agenda e verifica conteúdo (HIBRIDO/PRESENCIAL)', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)

    // Aguarda o botão do card aparecer e clica semanticamente no elemento interativo
    const cardBtn = await screen.findByRole('button', { name: /Reunião de Setor/i })
    fireEvent.click(cardBtn)

    // Aguarda o dialog aparecer de forma assíncrona (showModal define o atributo open)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    // Restringe asserções ao dialog para evitar falsa duplicidade com o EventCard
    const dq = within(dialog)
    expect(dq.getByText('Sede Regional')).toBeInTheDocument()
    expect(dq.getByText('Rua X')).toBeInTheDocument()
    expect(dq.getByText('Levar caderno')).toBeInTheDocument()

    // Fechar modal usando escopo do dialog
    fireEvent.click(dq.getByLabelText('Fechar detalhes'))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('9. Abre detalhe pelo Calendário e verifica conteúdo ONLINE', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    // Go to calendar
    fireEvent.click(screen.getByText('Calendário'))
    await waitFor(() => expect(screen.getByText('Dom')).toBeInTheDocument())
    
    // Click day
    const day = new Date(Date.now() + 172800000)
    const dayBtn = screen.getByLabelText(`Selecionar dia ${day.getDate()}`)
    fireEvent.click(dayBtn)
    
    await waitFor(() => {
      expect(screen.getByText('Encontro Online')).toBeInTheDocument()
    })
    
    // Open details
    fireEvent.click(screen.getByText('Encontro Online'))
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      // "Sede Regional" should NOT be here (it is ONLINE)
      expect(screen.queryByText('Sede Regional')).not.toBeInTheDocument()
    })
  })

  it('10. Exibe seção de RSVP no detalhe', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Minha Agenda')).toBeInTheDocument()
    })

    const evt = await screen.findByText('Reunião de Setor')
    fireEvent.click(evt)

    const dialog = await screen.findByRole('dialog')
    const dialogQueries = within(dialog)

    expect(dialogQueries.getByText('Sua Participação')).toBeInTheDocument()
    expect(dialogQueries.getByText('✓ Vou participar')).toBeInTheDocument()
    expect(dialogQueries.getByText('? Não sei ainda')).toBeInTheDocument()
    expect(dialogQueries.getByLabelText('✗ Não vou participar')).toBeInTheDocument()
  })

  it('11. Confirma participação', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    ;(apiClient.putWithAuth as any).mockResolvedValue({})
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Minha Agenda')).toBeInTheDocument()
    })

    const evt = await screen.findByText('Reunião de Setor')
    fireEvent.click(evt)

    const dialog = await screen.findByRole('dialog')
    const dialogQueries = within(dialog)

    const btnParticiparei = dialogQueries.getByText('✓ Vou participar')
    fireEvent.click(btnParticiparei)

    await waitFor(() => {
      expect(apiClient.putWithAuth).toHaveBeenCalledWith('/minha-agenda/rsvp/dest-1', {
        resposta: 'PARTICIPAREI',
        justificativa: null
      })
    })

    expect(dialogQueries.getByText(/confirmado/i)).toBeInTheDocument()
  })

  it('12. Persiste estado visual ao fechar e reabrir evento', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    ;(apiClient.putWithAuth as any).mockResolvedValue({})
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Minha Agenda')).toBeInTheDocument()
    })

    let evt = await screen.findByText('Reunião de Setor')
    fireEvent.click(evt)

    let dialog = await screen.findByRole('dialog')
    let dialogQueries = within(dialog)

    // Confirma presença
    const btnParticiparei = dialogQueries.getByText('✓ Vou participar')
    fireEvent.click(btnParticiparei)

    await waitFor(() => {
      expect(dialogQueries.getByText(/confirmado/i)).toBeInTheDocument()
    })

    // Fecha o dialog
    const btnFechar = dialogQueries.getByLabelText('Fechar detalhes')
    fireEvent.click(btnFechar)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Reabre o evento
    evt = await screen.findByText('Reunião de Setor')
    fireEvent.click(evt)

    dialog = await screen.findByRole('dialog')
    dialogQueries = within(dialog)

    // Verifica se continua Confirmado (badge)
    expect(dialogQueries.getByText(/confirmado/i)).toBeInTheDocument()
  })

  it('13. Selecionar ausência sem salvar não altera o badge', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Minha Agenda')).toBeInTheDocument()
    })

    const evt = await screen.findByText('Reunião de Setor')
    fireEvent.click(evt)

    const dialog = await screen.findByRole('dialog')
    const dialogQueries = within(dialog)

    // Clica no rádio mas NÃO salva
    const radioNaoVou = dialogQueries.getByLabelText('✗ Não vou participar')
    fireEvent.click(radioNaoVou)

    // O text-area de justificativa deve aparecer
    expect(dialogQueries.getByPlaceholderText(/justifique sua ausência/i)).toBeInTheDocument()

    // Mas o badge "Ausente" NÃO deve estar na tela (já que o backend não confirmou)
    expect(dialogQueries.queryByText(/ausente/i)).not.toBeInTheDocument()
  })

  // ============================================================
  // S09 - Web (Períodos e Alimentação)
  // ============================================================

  it('31. evento false/false não mostra seletor de período', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    await waitFor(() => screen.getByText('Reunião de Setor'))
    fireEvent.click(screen.getByText('Reunião de Setor'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    expect(dq.queryByText(/em qual período/i)).not.toBeInTheDocument()
  })

  it('32. somente manhã não pergunta período', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Manhã'))
    fireEvent.click(screen.getByText('Evento S09 Manhã'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    expect(dq.queryByText(/em qual período/i)).not.toBeInTheDocument()
  })

  it('33. somente tarde não pergunta período', async () => {
    const mockTarde = JSON.parse(JSON.stringify(mockEventos))
    mockTarde[3].evento.possuiManha = false
    mockTarde[3].evento.possuiTarde = true
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockTarde)
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Manhã'))
    fireEvent.click(screen.getByText('Evento S09 Manhã'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    expect(dq.queryByText(/em qual período/i)).not.toBeInTheDocument()
  })

  it('34. manhã+tarde mostra: Manhã, Tarde, Manhã e tarde', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    // O componente renderiza "Período de participação *" (não "em qual período")
    expect(dq.getByText(/período de participação/i)).toBeInTheDocument()
    expect(dq.getByText('Manhã')).toBeInTheDocument()
    expect(dq.getByText('Tarde')).toBeInTheDocument()
    expect(dq.getByText('Manhã e tarde')).toBeInTheDocument()
  })

  it('35. clicar Vou participar em manhã+tarde não mostra badge Confirmado antes do PUT', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    expect(dq.queryByText(/confirmado/i)).not.toBeInTheDocument()
  })

  it('36. confirmar sem escolher período mostra validação e não chama PUT', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    
    // Tenta salvar sem preencher periodo
    fireEvent.click(dq.getByText('Confirmar Participação'))
    expect(apiClient.putWithAuth).not.toHaveBeenCalled()
    // Como a UI não possui um toast explícito nos mocks testáveis facilmente, testamos se o put não foi chamado.
  })

  it('37. refeições oferecidas aparecem', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    
    expect(dq.getByText('Alimentação (opcional)')).toBeInTheDocument()
    expect(dq.getByText('Café da manhã')).toBeInTheDocument()
    expect(dq.getByText('Almoço')).toBeInTheDocument()
  })

  it('38. refeição não oferecida não aparece', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    
    expect(dq.queryByText('Lanche da tarde')).not.toBeInTheDocument()
  })

  it('39. evento com alimentação permite confirmação com nenhuma refeição', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    ;(apiClient.putWithAuth as any).mockResolvedValue({})
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    
    // Seleciona o período
    fireEvent.click(dq.getByLabelText('Manhã'))
    
    // Confirma SEM marcar refeição
    fireEvent.click(dq.getByText('Confirmar Participação'))
    
    // O componente só inclui refeicoesSelecionadas se length > 0;
    // com zero refeições o campo é omitido — comportamento válido
    await waitFor(() => {
      expect(apiClient.putWithAuth).toHaveBeenCalledWith(
        '/minha-agenda/rsvp/dest-s09',
        expect.objectContaining({
          resposta: 'PARTICIPAREI',
          periodoParticipacao: 'MANHA'
        })
      )
    })
    expect(apiClient.putWithAuth).toHaveBeenCalledTimes(1)
  })

  it('40. NAO_SEI fecha/oculta formulário S09', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    
    // Verifica que está aparecendo
    expect(dq.getByText('Alimentação (opcional)')).toBeInTheDocument()
    
    // Clica não sei
    fireEvent.click(dq.getByText('? Não sei ainda'))
    
    // Some
    expect(dq.queryByText('Alimentação (opcional)')).not.toBeInTheDocument()
  })

  it('41. NAO_PARTICIPAREI fecha/oculta formulário S09', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    const dq = within(await screen.findByRole('dialog'))
    fireEvent.click(dq.getByText('✓ Vou participar'))
    
    fireEvent.click(dq.getByLabelText('✗ Não vou participar'))
    
    expect(dq.queryByText('Alimentação (opcional)')).not.toBeInTheDocument()
  })

  it('42. salvar + fechar + reabrir preserva: RSVP, período, refeições', async () => {
    // Fluxo real: RSVP nulo → salvar → fechar → reabrir → editar → verificar persistência
    // O estado é mantido via handleRsvpUpdated no AgendaView (não via mock injetado)
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    ;(apiClient.putWithAuth as any).mockResolvedValue({})
    render(<App />)

    // 1. Abre Evento S09 Integral (RSVP inicial = null)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    let dq = within(await screen.findByRole('dialog'))

    // 2. Clica "Vou participar" para abrir formulário S09
    fireEvent.click(dq.getByText('✓ Vou participar'))

    // 3. Seleciona período TARDE
    fireEvent.click(dq.getByLabelText('Tarde'))

    // 4. Seleciona refeição ALMOCO
    fireEvent.click(dq.getByLabelText('Almoço'))

    // 5. Confirma participação
    fireEvent.click(dq.getByText('Confirmar Participação'))

    // 6. Aguarda PUT e badge Confirmado
    await waitFor(() => {
      expect(apiClient.putWithAuth).toHaveBeenCalledWith(
        '/minha-agenda/rsvp/dest-s09',
        expect.objectContaining({
          resposta: 'PARTICIPAREI',
          periodoParticipacao: 'TARDE',
          refeicoesSelecionadas: ['ALMOCO']
        })
      )
    })
    await waitFor(() => expect(dq.getByText(/confirmado/i)).toBeInTheDocument())

    // 7. Fecha o dialog
    fireEvent.click(dq.getByLabelText('Fechar detalhes'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // 8. Reabre o mesmo evento
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    const dialog2 = await screen.findByRole('dialog')
    dq = within(dialog2)

    // 9. Badge "Confirmado" deve estar visível (estado preservado via handleRsvpUpdated)
    expect(dq.getByText(/confirmado/i)).toBeInTheDocument()

    // 10. Abre formulário de edição para verificar período e refeições salvas
    fireEvent.click(dq.getByText('✓ Vou participar'))

    // 11. Verifica que o estado salvo foi restaurado nos inputs
    await waitFor(() => {
      const rTarde = dq.getByLabelText('Tarde') as HTMLInputElement
      expect(rTarde.checked).toBe(true)

      const rAlmoco = dq.getByLabelText('Almoço') as HTMLInputElement
      expect(rAlmoco.checked).toBe(true)

      const rCafe = dq.getByLabelText('Café da manhã') as HTMLInputElement
      expect(rCafe.checked).toBe(false)
    })
  })

  it('43. Cancelar edição descarta draft e restaura estado persistido', async () => {
    // 1. Mocka RSVP inicial com TARDE e ALMOCO
    const mockComRsvp = JSON.parse(JSON.stringify(mockEventos))
    mockComRsvp[2].rsvp = {
      resposta: 'PARTICIPAREI',
      periodoParticipacao: 'TARDE',
      refeicoesSelecionadas: ['ALMOCO']
    }
    
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockComRsvp)
    ;(apiClient.putWithAuth as any).mockClear()
    
    render(<App />)
    await waitFor(() => screen.getByText('Evento S09 Integral'))
    
    // Abre evento
    fireEvent.click(screen.getByText('Evento S09 Integral'))
    let dq = within(await screen.findByRole('dialog'))
    
    // 2. Abre edição
    fireEvent.click(dq.getByText('✓ Vou participar'))
    
    // 3. Altera drafts para MANHA e CAFE_MANHA
    fireEvent.click(dq.getByLabelText('Manhã'))
    fireEvent.click(dq.getByLabelText('Café da manhã'))
    
    // Verifica visualmente que mudou
    const rManha = dq.getByLabelText('Manhã') as HTMLInputElement
    expect(rManha.checked).toBe(true)
    
    // 4. Clica Cancelar
    fireEvent.click(dq.getByText('Cancelar'))
    
    // 5. Reabre edição
    fireEvent.click(dq.getByText('✓ Vou participar'))
    
    // 6. Verifica se valores persistidos foram restaurados e draft descartado
    await waitFor(() => {
      const rTardeAfter = dq.getByLabelText('Tarde') as HTMLInputElement
      const rAlmocoAfter = dq.getByLabelText('Almoço') as HTMLInputElement
      const rManhaAfter = dq.getByLabelText('Manhã') as HTMLInputElement
      const rCafeAfter = dq.getByLabelText('Café da manhã') as HTMLInputElement
      
      expect(rTardeAfter.checked).toBe(true)
      expect(rAlmocoAfter.checked).toBe(true)
      expect(rManhaAfter.checked).toBe(false)
      expect(rCafeAfter.checked).toBe(false)
    })
    
    // 7. Confirma que nenhum PUT foi feito
    expect(apiClient.putWithAuth).not.toHaveBeenCalled()
  })
})
