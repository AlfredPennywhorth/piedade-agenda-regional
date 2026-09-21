import { Hono } from 'hono'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { eventos, convocacoes, convocacaoDestinatarios, rsvp, checkins, membros, casas, portariaFechamentos, portariaFechamentoItens } from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { eGestorRelatoriosAutorizadoParaEvento, eGestorRelatoriosAutorizadoParaEscopo } from '../security/permissoes'
import { montarSnapshotFechamentoPortaria } from '../services/portaria-fechamento'

export const relatoriosRouter = new Hono<{ Variables: Variables }>()

relatoriosRouter.use('*', authMiddleware)

// GET /api/v1/relatorios/presencas/eventos/:eventoId/final
// Fonte histórica preferencial: snapshot materializado no fechamento.
// Para evento ainda aberto, retorna uma prévia operacional sem persistir histórico.
relatoriosRouter.get('/presencas/eventos/:eventoId/final', async c => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível' }, 500)
  }

  const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado', code: 'NOT_FOUND' }, 404)
  }

  const autorizado = await eGestorRelatoriosAutorizadoParaEvento(db, membroId, evento)
  if (!autorizado) {
    return c.json({ error: 'Acesso não autorizado para visualizar este relatório', code: 'FORBIDDEN' }, 403)
  }

  const fechamento = await db
    .select()
    .from(portariaFechamentos)
    .where(eq(portariaFechamentos.eventoId, eventoId))
    .get()

  if (fechamento) {
    const itens = await db
      .select()
      .from(portariaFechamentoItens)
      .where(eq(portariaFechamentoItens.fechamentoId, fechamento.id))
      .all()

    return c.json({
      fonte: 'SNAPSHOT_FECHAMENTO',
      evento: {
        id: evento.id,
        titulo: evento.titulo,
        inicioEm: evento.inicioEm,
        fimEm: evento.fimEm,
      },
      fechamento: {
        id: fechamento.id,
        fechadoEm: fechamento.fechadoEm,
        fechadoPorMembroId: fechamento.fechadoPorMembroId,
      },
      resumo: {
        totalConvocados: fechamento.totalConvocados,
        totalConvocadosPresentes: fechamento.totalConvocadosPresentes,
        totalConvocadosAusentes: fechamento.totalConvocadosAusentes,
        totalConvidadosValidados: fechamento.totalConvidadosValidados,
        totalConvidadosPendentes: fechamento.totalConvidadosPendentes,
        totalPresentes: fechamento.totalPresentes,
      },
      itens: itens.map((item: typeof itens[number]) => ({
        tipoPessoa: item.tipoPessoa,
        origemId: item.origemId,
        nome: item.nome,
        localidade: item.localidade,
        situacao: item.situacao,
        respostaRsvp: item.respostaRsvp,
        formaPresenca: item.formaPresenca,
        registradoEm: item.registradoEm,
      })),
    })
  }

  const previa = await montarSnapshotFechamentoPortaria(db, eventoId)
  return c.json({
    fonte: 'PREVIA_OPERACIONAL',
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      inicioEm: evento.inicioEm,
      fimEm: evento.fimEm,
    },
    fechamento: null,
    resumo: previa.resumo,
    itens: previa.itens,
  })
})

// GET /api/v1/relatorios/presencas/membros/:membroAlvoId
// Histórico de participação do membro em reuniões fechadas, limitado aos eventos
// para os quais o solicitante possui autorização de relatório.
relatoriosRouter.get('/presencas/membros/:membroAlvoId', async c => {
  const db = c.get('db')
  const solicitanteId = c.get('membroId')
  const membroAlvoId = c.req.param('membroAlvoId')
  const dataInicio = c.req.query('dataInicio')
  const dataFim = c.req.query('dataFim')

  if (!db || !solicitanteId) {
    return c.json({ error: 'Sessão ou banco indisponível' }, 500)
  }

  const alvo = await db.select({ id: membros.id, nome: membros.nome })
    .from(membros)
    .where(eq(membros.id, membroAlvoId))
    .get()

  if (!alvo) {
    return c.json({ error: 'Membro não encontrado', code: 'NOT_FOUND' }, 404)
  }

  const itens = await db
    .select({
      item: portariaFechamentoItens,
      fechamento: portariaFechamentos,
      evento: eventos,
    })
    .from(portariaFechamentoItens)
    .innerJoin(
      portariaFechamentos,
      eq(portariaFechamentoItens.fechamentoId, portariaFechamentos.id)
    )
    .innerJoin(eventos, eq(portariaFechamentos.eventoId, eventos.id))
    .where(
      and(
        eq(portariaFechamentoItens.tipoPessoa, 'MEMBRO'),
        eq(portariaFechamentoItens.origemId, membroAlvoId)
      )
    )
    .all()

  const resultado = []
  for (const registro of itens) {
    if (dataInicio && registro.evento.inicioEm < dataInicio) continue
    if (dataFim && registro.evento.inicioEm > dataFim) continue

    const autorizado = await eGestorRelatoriosAutorizadoParaEvento(
      db,
      solicitanteId,
      registro.evento
    )
    if (!autorizado) continue

    resultado.push({
      eventoId: registro.evento.id,
      eventoTitulo: registro.evento.titulo,
      inicioEm: registro.evento.inicioEm,
      fimEm: registro.evento.fimEm,
      fechadoEm: registro.fechamento.fechadoEm,
      situacao: registro.item.situacao,
      respostaRsvp: registro.item.respostaRsvp,
      formaPresenca: registro.item.formaPresenca,
      registradoEm: registro.item.registradoEm,
      localidade: registro.item.localidade,
    })
  }

  resultado.sort((a, b) => b.inicioEm.localeCompare(a.inicioEm))

  const totalReunioes = resultado.length
  const totalPresentes = resultado.filter(item => item.situacao === 'PRESENTE').length
  const totalAusentes = resultado.filter(item => item.situacao === 'AUSENTE').length

  return c.json({
    membro: alvo,
    periodo: {
      dataInicio: dataInicio || null,
      dataFim: dataFim || null,
    },
    resumo: {
      totalReunioes,
      totalPresentes,
      totalAusentes,
      taxaPresenca:
        totalReunioes > 0
          ? Number(((totalPresentes / totalReunioes) * 100).toFixed(2))
          : 0,
    },
    reunioes: resultado,
  })
})

// GET /api/v1/relatorios/presencas/periodo
// Consolidação de reuniões fechadas em um escopo institucional.
relatoriosRouter.get('/presencas/periodo', async c => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const escopoTipo = c.req.query('escopoTipo') as
    | 'REGIONAL'
    | 'ADMINISTRACAO'
    | 'SETOR'
    | 'CASA'
    | 'GRUPO_TRABALHO'
    | undefined
  const escopoId = c.req.query('escopoId')
  const dataInicio = c.req.query('dataInicio')
  const dataFim = c.req.query('dataFim')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível' }, 500)
  }

  if (!escopoTipo || !escopoId) {
    return c.json({ error: 'escopoTipo e escopoId são obrigatórios' }, 400)
  }

  const autorizado = await eGestorRelatoriosAutorizadoParaEscopo(
    db,
    membroId,
    escopoTipo,
    escopoId
  )
  if (!autorizado) {
    return c.json({ error: 'Acesso não autorizado para o escopo informado', code: 'FORBIDDEN' }, 403)
  }

  const condicoes = [eq(eventos.ativo, true)]

  switch (escopoTipo) {
    case 'REGIONAL':
      condicoes.push(eq(eventos.regionalId, escopoId))
      break
    case 'ADMINISTRACAO':
      condicoes.push(eq(eventos.administracaoId, escopoId))
      break
    case 'SETOR':
      condicoes.push(eq(eventos.setorId, escopoId))
      break
    case 'CASA':
      condicoes.push(eq(eventos.casaId, escopoId))
      break
    case 'GRUPO_TRABALHO':
      condicoes.push(eq(eventos.grupoTrabalhoId, escopoId))
      break
  }

  if (dataInicio) condicoes.push(gte(eventos.inicioEm, dataInicio))
  if (dataFim) condicoes.push(lte(eventos.inicioEm, dataFim))

  const fechamentos = await db
    .select({
      fechamento: portariaFechamentos,
      evento: eventos,
    })
    .from(portariaFechamentos)
    .innerJoin(eventos, eq(portariaFechamentos.eventoId, eventos.id))
    .where(and(...condicoes))
    .all()

  const eventosResumo = fechamentos
    .map((registro: typeof fechamentos[number]) => ({
      eventoId: registro.evento.id,
      titulo: registro.evento.titulo,
      inicioEm: registro.evento.inicioEm,
      fechadoEm: registro.fechamento.fechadoEm,
      totalConvocados: registro.fechamento.totalConvocados,
      totalConvocadosPresentes: registro.fechamento.totalConvocadosPresentes,
      totalConvocadosAusentes: registro.fechamento.totalConvocadosAusentes,
      totalConvidadosValidados: registro.fechamento.totalConvidadosValidados,
      totalConvidadosPendentes: registro.fechamento.totalConvidadosPendentes,
      totalPresentes: registro.fechamento.totalPresentes,
    }))
    .sort((a, b) => a.inicioEm.localeCompare(b.inicioEm))

  const totais = eventosResumo.reduce(
    (acc, item) => {
      acc.totalConvocados += item.totalConvocados
      acc.totalConvocadosPresentes += item.totalConvocadosPresentes
      acc.totalConvocadosAusentes += item.totalConvocadosAusentes
      acc.totalConvidadosValidados += item.totalConvidadosValidados
      acc.totalConvidadosPendentes += item.totalConvidadosPendentes
      acc.totalPresentes += item.totalPresentes
      return acc
    },
    {
      totalEventos: eventosResumo.length,
      totalConvocados: 0,
      totalConvocadosPresentes: 0,
      totalConvocadosAusentes: 0,
      totalConvidadosValidados: 0,
      totalConvidadosPendentes: 0,
      totalPresentes: 0,
    }
  )

  return c.json({
    escopo: { escopoTipo, escopoId },
    periodo: {
      dataInicio: dataInicio || null,
      dataFim: dataFim || null,
    },
    resumo: {
      ...totais,
      taxaPresencaConvocados:
        totais.totalConvocados > 0
          ? Number(((totais.totalConvocadosPresentes / totais.totalConvocados) * 100).toFixed(2))
          : 0,
    },
    eventos: eventosResumo,
  })
})

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
