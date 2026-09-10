import { Hono } from 'hono'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { eventos, convocacoes, convocacaoDestinatarios, rsvp, checkins, membros, casas } from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { eGestorRelatoriosAutorizadoParaEvento, eGestorRelatoriosAutorizadoParaEscopo } from '../security/permissoes'

export const relatoriosRouter = new Hono<{ Variables: Variables }>()

relatoriosRouter.use('*', authMiddleware)

// GET /api/v1/relatorios/eventos/:eventoId
relatoriosRouter.get('/eventos/:eventoId', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível' }, 500)
  }

  const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado' }, 404)
  }

  const autorizado = await eGestorRelatoriosAutorizadoParaEvento(db, membroId, evento)
  if (!autorizado) {
    return c.json({ error: 'Acesso não autorizado para visualizar relatórios deste evento' }, 403)
  }

  // Convocados materializados
  const convocacao = await db.select()
    .from(convocacoes)
    .where(and(eq(convocacoes.eventoId, eventoId), eq(convocacoes.status, 'PUBLICADA'), eq(convocacoes.ativo, true)))
    .get()

  const destinatarios = convocacao
    ? await db.select().from(convocacaoDestinatarios).where(eq(convocacaoDestinatarios.convocacaoId, convocacao.id)).all()
    : []

  const totalConvocados = destinatarios.length
  const destIds = destinatarios.map((d: any) => d.id)

  // RSVP records
  const rsvpList = destIds.length > 0
    ? await db.select().from(rsvp).where(inArray(rsvp.convocacaoDestinatarioId, destIds)).all()
    : []

  const totalConfirmados = rsvpList.filter((r: any) => r.resposta === 'PARTICIPAREI').length
  const totalRecusados = rsvpList.filter((r: any) => r.resposta === 'NAO_PARTICIPAREI').length
  const totalNaoSei = rsvpList.filter((r: any) => r.resposta === 'NAO_SEI').length
  const totalSemResposta = Math.max(0, totalConvocados - rsvpList.length)

  // Checkins records
  const checkinList = await db.select().from(checkins).where(eq(checkins.eventoId, eventoId)).all()
  const totalPresencas = checkinList.length

  // Presenças dos confirmados
  const confirmadosDestIds = new Set(rsvpList.filter((r: any) => r.resposta === 'PARTICIPAREI').map((r: any) => r.convocacaoDestinatarioId))
  const presencasConfirmados = checkinList.filter((c: any) => confirmadosDestIds.has(c.convocacaoDestinatarioId)).length

  const taxaEngajamentoRsvp = totalConvocados > 0 ? parseFloat((((totalConfirmados + totalRecusados + totalNaoSei) / totalConvocados) * 100).toFixed(2)) : 0
  const taxaPresencaConvocados = totalConvocados > 0 ? parseFloat(((totalPresencas / totalConvocados) * 100).toFixed(2)) : 0
  const taxaPresencaConfirmados = totalConfirmados > 0 ? parseFloat(((presencasConfirmados / totalConfirmados) * 100).toFixed(2)) : 0

  return c.json({
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      inicioEm: evento.inicioEm,
      fimEm: evento.fimEm,
      modalidade: evento.modalidade,
      organizadorMembroId: evento.organizadorMembroId,
    },
    totalConvocados,
    totalConfirmados,
    totalRecusados,
    totalNaoSei,
    totalSemResposta,
    totalPresencas,
    presencasConfirmados,
    taxaEngajamentoRsvp,
    taxaPresencaConvocados,
    taxaPresencaConfirmados,
  })
})

// GET /api/v1/relatorios/eventos/:eventoId/presencas
relatoriosRouter.get('/eventos/:eventoId/presencas', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  const statusRsvp = c.req.query('statusRsvp')
  const presenteParam = c.req.query('presente')
  const busca = c.req.query('busca')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível' }, 500)
  }

  const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado' }, 404)
  }

  const autorizado = await eGestorRelatoriosAutorizadoParaEvento(db, membroId, evento)
  if (!autorizado) {
    return c.json({ error: 'Acesso não autorizado para visualizar relatórios deste evento' }, 403)
  }

  const convocacao = await db.select()
    .from(convocacoes)
    .where(and(eq(convocacoes.eventoId, eventoId), eq(convocacoes.status, 'PUBLICADA'), eq(convocacoes.ativo, true)))
    .get()

  if (!convocacao) {
    return c.json([])
  }

  const rows = await db.select({
    destinatarioId: convocacaoDestinatarios.id,
    membroId: membros.id,
    membroNome: membros.nome,
    membroCelular: membros.celular,
    casaNome: casas.nome,
    respostaRsvp: rsvp.resposta,
    periodosParticipacao: rsvp.periodosParticipacao,
    checkinId: checkins.id,
    formaCheckin: checkins.forma,
    dataHoraCheckin: checkins.dataHoraCheckin,
  })
  .from(convocacaoDestinatarios)
  .innerJoin(membros, eq(convocacaoDestinatarios.membroId, membros.id))
  .leftJoin(casas, eq(membros.casaId, casas.id))
  .leftJoin(rsvp, eq(rsvp.convocacaoDestinatarioId, convocacaoDestinatarios.id))
  .leftJoin(checkins, and(eq(checkins.eventoId, eventoId), eq(checkins.membroId, membros.id)))
  .where(eq(convocacaoDestinatarios.convocacaoId, convocacao.id))
  .all()

  let result = rows.map((r: any) => ({
    destinatarioId: r.destinatarioId,
    membroId: r.membroId,
    membroNome: r.membroNome,
    membroCelular: r.membroCelular || null,
    casaNome: r.casaNome || 'N/A',
    respostaRsvp: r.respostaRsvp || 'SEM_RESPOSTA',
    periodosParticipacao: r.periodosParticipacao || [],
    presente: r.checkinId !== null,
    formaCheckin: r.formaCheckin || null,
    dataHoraCheckin: r.dataHoraCheckin || null,
  }))

  if (statusRsvp) {
    result = result.filter((r: any) => r.respostaRsvp === statusRsvp)
  }

  if (presenteParam !== undefined) {
    const isPresente = presenteParam === 'true'
    result = result.filter((r: any) => r.presente === isPresente)
  }

  if (busca && busca.trim().length > 0) {
    const term = busca.trim().toLowerCase()
    result = result.filter((r: any) => r.membroNome.toLowerCase().includes(term))
  }

  return c.json(result)
})

// GET /api/v1/relatorios/agregado
relatoriosRouter.get('/agregado', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')

  const escopoTipo = c.req.query('escopoTipo') as any
  const escopoId = c.req.query('escopoId')
  const dataInicio = c.req.query('dataInicio')
  const dataFim = c.req.query('dataFim')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível' }, 500)
  }

  if (!escopoTipo || !escopoId) {
    return c.json({ error: 'Parâmetros escopoTipo e escopoId são obrigatórios' }, 400)
  }

  const autorizado = await eGestorRelatoriosAutorizadoParaEscopo(db, membroId, escopoTipo, escopoId)
  if (!autorizado) {
    return c.json({ error: 'Acesso não autorizado para visualizar relatório agregado do escopo informado' }, 403)
  }

  const conditions = [eq(eventos.ativo, true)]

  switch (escopoTipo) {
    case 'REGIONAL': conditions.push(eq(eventos.regionalId, escopoId)); break
    case 'ADMINISTRACAO': conditions.push(eq(eventos.administracaoId, escopoId)); break
    case 'SETOR': conditions.push(eq(eventos.setorId, escopoId)); break
    case 'CASA': conditions.push(eq(eventos.casaId, escopoId)); break
    case 'GRUPO_TRABALHO': conditions.push(eq(eventos.grupoTrabalhoId, escopoId)); break
    default: return c.json({ error: 'escopoTipo inválido' }, 400)
  }

  if (dataInicio) {
    conditions.push(gte(eventos.inicioEm, dataInicio))
  }
  if (dataFim) {
    conditions.push(lte(eventos.inicioEm, dataFim))
  }

  const listaEventos = await db.select().from(eventos).where(and(...conditions)).all()

  let totalConvocados = 0
  let totalConfirmados = 0
  let totalPresencas = 0
  let totalConvocacoesMaterializadas = 0

  const eventosResumo = []

  for (const ev of listaEventos) {
    const convocacao = await db.select()
      .from(convocacoes)
      .where(and(eq(convocacoes.eventoId, ev.id), eq(convocacoes.status, 'PUBLICADA'), eq(convocacoes.ativo, true)))
      .get()

    let evConvocados = 0
    let evConfirmados = 0

    if (convocacao) {
      totalConvocacoesMaterializadas++
      const dests = await db.select().from(convocacaoDestinatarios).where(eq(convocacaoDestinatarios.convocacaoId, convocacao.id)).all()
      evConvocados = dests.length
      const destIds = dests.map((d: any) => d.id)

      if (destIds.length > 0) {
        const rsvps = await db.select().from(rsvp).where(inArray(rsvp.convocacaoDestinatarioId, destIds)).all()
        evConfirmados = rsvps.filter((r: any) => r.resposta === 'PARTICIPAREI').length
      }
    }

    const evCheckins = await db.select().from(checkins).where(eq(checkins.eventoId, ev.id)).all()
    const evPresencas = evCheckins.length

    totalConvocados += evConvocados
    totalConfirmados += evConfirmados
    totalPresencas += evPresencas

    eventosResumo.push({
      id: ev.id,
      titulo: ev.titulo,
      inicioEm: ev.inicioEm,
      modalidade: ev.modalidade,
      totalConvocados: evConvocados,
      totalConfirmados: evConfirmados,
      totalPresencas: evPresencas,
      taxaPresenca: evConvocados > 0 ? parseFloat(((evPresencas / evConvocados) * 100).toFixed(2)) : 0
    })
  }

  const totalEventos = listaEventos.length
  const mediaPresencaPorEvento = totalEventos > 0 ? parseFloat((totalPresencas / totalEventos).toFixed(2)) : 0
  const taxaPresencaGeral = totalConvocados > 0 ? parseFloat(((totalPresencas / totalConvocados) * 100).toFixed(2)) : 0

  return c.json({
    escopo: { escopoTipo, escopoId },
    totalEventos,
    totalConvocacoesMaterializadas,
    totalConvocados,
    totalConfirmados,
    totalPresencas,
    mediaPresencaPorEvento,
    taxaPresencaGeral,
    eventos: eventosResumo
  })
})
