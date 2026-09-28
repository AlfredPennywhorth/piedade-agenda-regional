import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import {
  checkins,
  convocacoes,
  convocacaoDestinatarios,
  membros,
  casas,
  rsvp,
  convidadosEvento,
  presencasConvidadoEvento,
  credenciaisCadastroPortariaEvento,
  portariaSolicitacoesFechamento,
} from '../db/schema'
import { CheckinManualSchema, CheckinQrSchema, getSaoPauloEndOfDayIso } from '@piedade/shared'
import { gerarTokenAleatorio, hashToken } from '../security/tokens'
import { executarOperacaoComAudit, extrairEscopoDoEvento } from '../services/auditoria'
import { validarCredencialOperadorPortaria } from '../services/portaria-operador-temporario'

export const portariaOperadorPublicaRouter = new Hono<any>()

function tokenOperador(c: any): string {
  const auth = c.req.header('Authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return ''
}

async function contextoOperador(c: any) {
  const db = c.get('db')
  const validacao = await validarCredencialOperadorPortaria(db, tokenOperador(c))
  if (!validacao.ok) {
    return { response: c.json({ error: validacao.error, code: validacao.code }, validacao.status) }
  }
  return { db, ...validacao.credencial }
}

portariaOperadorPublicaRouter.get('/sessao', async c => {
  const ctx = await contextoOperador(c)
  if ('response' in ctx) return ctx.response

  return c.json({
    credencialId: ctx.id,
    expiraEm: ctx.expiraEm,
    evento: {
      id: ctx.evento.id,
      titulo: ctx.evento.titulo,
      inicioEm: ctx.evento.inicioEm,
      fimEm: ctx.evento.fimEm,
      modalidade: ctx.evento.modalidade,
    },
  }, 200)
})

portariaOperadorPublicaRouter.get('/participantes', async c => {
  const ctx = await contextoOperador(c)
  if ('response' in ctx) return ctx.response

  const registros = await ctx.db
    .select({
      destinatario: convocacaoDestinatarios,
      convocacao: convocacoes,
      membro: membros,
      casa: casas,
      rsvp,
      checkin: checkins,
    })
    .from(convocacaoDestinatarios)
    .innerJoin(convocacoes, eq(convocacaoDestinatarios.convocacaoId, convocacoes.id))
    .innerJoin(membros, eq(convocacaoDestinatarios.membroId, membros.id))
    .leftJoin(casas, eq(membros.casaId, casas.id))
    .leftJoin(rsvp, eq(convocacaoDestinatarios.id, rsvp.convocacaoDestinatarioId))
    .leftJoin(
      checkins,
      and(
        eq(checkins.eventoId, ctx.eventoId),
        eq(checkins.membroId, membros.id),
        eq(checkins.status, 'ATIVO')
      )
    )
    .where(
      and(
        eq(convocacoes.eventoId, ctx.eventoId),
        eq(convocacoes.status, 'PUBLICADA'),
        eq(convocacoes.ativo, true)
      )
    )
    .all()

  const mapa = new Map<string, any>()
  for (const reg of registros) {
    if (mapa.has(reg.membro.id)) continue
    mapa.set(reg.membro.id, {
      convocacaoDestinatarioId: reg.destinatario.id,
      membro: {
        id: reg.membro.id,
        nome: reg.membro.nome,
        casaNome: reg.casa?.nome ?? null,
      },
      rsvpResposta: reg.rsvp?.resposta ?? null,
      checkin: reg.checkin
        ? {
            id: reg.checkin.id,
            dataHoraCheckin: reg.checkin.dataHoraCheckin,
            forma: reg.checkin.forma,
          }
        : null,
    })
  }

  return c.json({
    evento: {
      id: ctx.evento.id,
      titulo: ctx.evento.titulo,
      inicioEm: ctx.evento.inicioEm,
      fimEm: ctx.evento.fimEm,
    },
    participantes: Array.from(mapa.values()),
  }, 200)
})

async function registrarCheckin(c: any, forma: 'QR' | 'MANUAL') {
  const ctx = await contextoOperador(c)
  if ('response' in ctx) return ctx.response

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  let destinatarioId: string
  if (forma === 'QR') {
    const parsed = CheckinQrSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Payload inválido', details: parsed.error.issues }, 400)
    }
    destinatarioId = parsed.data.qrToken.trim()
  } else {
    const parsed = CheckinManualSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Payload inválido', details: parsed.error.issues }, 400)
    }
    destinatarioId = parsed.data.convocacaoDestinatarioId
  }

  const dest = await ctx.db
    .select({
      destinatario: convocacaoDestinatarios,
      convocacao: convocacoes,
    })
    .from(convocacaoDestinatarios)
    .innerJoin(convocacoes, eq(convocacaoDestinatarios.convocacaoId, convocacoes.id))
    .where(eq(convocacaoDestinatarios.id, destinatarioId))
    .get()

  if (!dest || dest.convocacao.eventoId !== ctx.eventoId) {
    return c.json({ error: 'Participante não pertence a esta reunião', code: 'FORBIDDEN' }, 403)
  }
  if (dest.convocacao.status !== 'PUBLICADA' || !dest.convocacao.ativo) {
    return c.json({ error: 'Convocação não está publicada', code: 'BAD_REQUEST' }, 400)
  }

  const existente = await ctx.db
    .select()
    .from(checkins)
    .where(and(
      eq(checkins.eventoId, ctx.eventoId),
      eq(checkins.membroId, dest.destinatario.membroId),
      eq(checkins.status, 'ATIVO')
    ))
    .get()

  if (existente) {
    return c.json({ message: 'Presença já registrada previamente', jaRegistrado: true, checkin: existente }, 409)
  }

  const agora = new Date().toISOString()
  const id = crypto.randomUUID()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(ctx.evento)

  await executarOperacaoComAudit(
    ctx.db,
    qdb => [qdb.insert(checkins).values({
      id,
      convocacaoDestinatarioId: dest.destinatario.id,
      eventoId: ctx.eventoId,
      membroId: dest.destinatario.membroId,
      forma,
      status: 'ATIVO',
      operadorMembroId: null,
      dataHoraCheckin: agora,
      createdAt: agora,
      updatedAt: agora,
    })],
    {
      acao: forma === 'QR' ? 'CHECKIN_QR' : 'CHECKIN_MANUAL',
      atorMembroId: null,
      recursoTipo: 'CHECKIN',
      recursoId: id,
      escopoTipo,
      escopoId,
      contexto: {
        eventoId: ctx.eventoId,
        forma,
        operadorCredencialId: ctx.id,
      },
    }
  )

  return c.json({
    id,
    eventoId: ctx.eventoId,
    membroId: dest.destinatario.membroId,
    forma,
    status: 'ATIVO',
    dataHoraCheckin: agora,
  }, 201)
}

portariaOperadorPublicaRouter.post('/checkin/qr', c => registrarCheckin(c, 'QR'))
portariaOperadorPublicaRouter.post('/checkin/manual', c => registrarCheckin(c, 'MANUAL'))

portariaOperadorPublicaRouter.get('/convidados', async c => {
  const ctx = await contextoOperador(c)
  if ('response' in ctx) return ctx.response

  const data = await ctx.db
    .select({
      id: convidadosEvento.id,
      nome: convidadosEvento.nome,
      localidade: convidadosEvento.localidade,
      referencia: convidadosEvento.referencia,
      observacoes: convidadosEvento.observacoes,
      status: convidadosEvento.status,
      validadoEm: convidadosEvento.validadoEm,
      presencaId: presencasConvidadoEvento.id,
      registradoEm: presencasConvidadoEvento.registradoEm,
      forma: presencasConvidadoEvento.forma,
    })
    .from(convidadosEvento)
    .leftJoin(
      presencasConvidadoEvento,
      and(
        eq(presencasConvidadoEvento.convidadoId, convidadosEvento.id),
        eq(presencasConvidadoEvento.eventoId, ctx.eventoId)
      )
    )
    .where(and(
      eq(convidadosEvento.eventoId, ctx.eventoId),
      eq(convidadosEvento.ativo, true)
    ))
    .all()

  return c.json({ data }, 200)
})

portariaOperadorPublicaRouter.post('/convidados/:convidadoId/validar', async c => {
  const ctx = await contextoOperador(c)
  if ('response' in ctx) return ctx.response
  const convidadoId = c.req.param('convidadoId')

  const convidado = await ctx.db.select().from(convidadosEvento)
    .where(and(
      eq(convidadosEvento.id, convidadoId),
      eq(convidadosEvento.eventoId, ctx.eventoId),
      eq(convidadosEvento.ativo, true)
    )).get()

  if (!convidado) return c.json({ error: 'Convidado não encontrado', code: 'NOT_FOUND' }, 404)
  if (convidado.status === 'VALIDADO') {
    return c.json({ error: 'Convidado já validado', code: 'PRESENCA_DUPLICADA' }, 409)
  }

  const agora = new Date().toISOString()
  const presencaId = crypto.randomUUID()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(ctx.evento)

  await executarOperacaoComAudit(
    ctx.db,
    qdb => [
      qdb.update(convidadosEvento).set({
        status: 'VALIDADO',
        validadoPorMembroId: null,
        validadoEm: agora,
        updatedAt: agora,
      }).where(eq(convidadosEvento.id, convidadoId)),
      qdb.insert(presencasConvidadoEvento).values({
        id: presencaId,
        convidadoId,
        eventoId: ctx.eventoId,
        forma: 'VALIDACAO_PORTEIRO',
        registradoPorMembroId: null,
        registradoEm: agora,
        createdAt: agora,
        updatedAt: agora,
      }),
    ],
    {
      acao: 'PORTARIA_CONVIDADO_VALIDADO',
      atorMembroId: null,
      recursoTipo: 'PRESENCA_CONVIDADO_EVENTO',
      recursoId: presencaId,
      escopoTipo,
      escopoId,
      contexto: {
        eventoId: ctx.eventoId,
        convidadoId,
        operadorCredencialId: ctx.id,
      },
    }
  )

  return c.json({ convidadoId, eventoId: ctx.eventoId, status: 'VALIDADO', registradoEm: agora }, 201)
})

portariaOperadorPublicaRouter.post('/cadastro-convidados/credencial', async c => {
  const ctx = await contextoOperador(c)
  if ('response' in ctx) return ctx.response

  const token = gerarTokenAleatorio(16)
  const tokenHash = await hashToken(token)
  const agora = new Date().toISOString()
  const credencialId = crypto.randomUUID()
  const expiraEm = getSaoPauloEndOfDayIso(ctx.evento.inicioEm)
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(ctx.evento)

  await executarOperacaoComAudit(
    ctx.db,
    qdb => [
      qdb.update(credenciaisCadastroPortariaEvento).set({
        ativo: false,
        revogadoEm: agora,
        updatedAt: agora,
      }).where(and(
        eq(credenciaisCadastroPortariaEvento.eventoId, ctx.eventoId),
        eq(credenciaisCadastroPortariaEvento.ativo, true)
      )),
      qdb.insert(credenciaisCadastroPortariaEvento).values({
        id: credencialId,
        eventoId: ctx.eventoId,
        tokenHash,
        expiraEm,
        criadoPorMembroId: null,
        ativo: true,
        createdAt: agora,
        updatedAt: agora,
      }),
    ],
    {
      acao: 'PORTARIA_CREDENCIAL_AUTOCADASTRO_CRIADA',
      atorMembroId: null,
      recursoTipo: 'CREDENCIAL_CADASTRO_PORTARIA',
      recursoId: credencialId,
      escopoTipo,
      escopoId,
      contexto: {
        eventoId: ctx.eventoId,
        operadorCredencialId: ctx.id,
      },
    }
  )

  return c.json({
    eventoId: ctx.eventoId,
    credencial: {
      token,
      expiraEm,
      caminhoCadastro: `/c?p=${encodeURIComponent(token)}`,
    },
  }, 201)
})

portariaOperadorPublicaRouter.post('/solicitar-fechamento', async c => {
  const ctx = await contextoOperador(c)
  if ('response' in ctx) return ctx.response

  const existente = await ctx.db.select().from(portariaSolicitacoesFechamento)
    .where(eq(portariaSolicitacoesFechamento.eventoId, ctx.eventoId)).get()

  if (existente && !existente.confirmadoEm) {
    return c.json({
      status: 'AGUARDANDO_CONFIRMACAO',
      solicitadoEm: existente.solicitadoEm,
      message: 'Encerramento já solicitado e aguardando confirmação do gestor.',
    }, 200)
  }

  const agora = new Date().toISOString()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(ctx.evento)

  await executarOperacaoComAudit(
    ctx.db,
    qdb => [
      qdb.insert(portariaSolicitacoesFechamento).values({
        eventoId: ctx.eventoId,
        solicitadoPorMembroId: null,
        solicitadoPorCredencialId: ctx.id,
        solicitadoEm: agora,
        confirmadoPorMembroId: null,
        confirmadoEm: null,
        createdAt: agora,
        updatedAt: agora,
      }).onConflictDoUpdate({
        target: portariaSolicitacoesFechamento.eventoId,
        set: {
          solicitadoPorMembroId: null,
          solicitadoPorCredencialId: ctx.id,
          solicitadoEm: agora,
          confirmadoPorMembroId: null,
          confirmadoEm: null,
          updatedAt: agora,
        },
      }),
    ],
    {
      acao: 'PORTARIA_FECHAMENTO_SOLICITADO',
      atorMembroId: null,
      recursoTipo: 'PORTARIA',
      recursoId: ctx.eventoId,
      escopoTipo,
      escopoId,
      contexto: {
        eventoId: ctx.eventoId,
        operadorCredencialId: ctx.id,
      },
    }
  )

  return c.json({
    status: 'AGUARDANDO_CONFIRMACAO',
    solicitadoEm: agora,
    message: 'Solicitação enviada ao gestor da reunião. A Portaria continua aberta até a confirmação.',
  }, 202)
})

portariaOperadorPublicaRouter.post('/fechar', async c => {
  const ctx = await contextoOperador(c)
  if ('response' in ctx) return ctx.response
  return c.json(
    {
      error: 'O porteiro não pode encerrar a Portaria sozinho. Solicite o encerramento para confirmação do gestor.',
      code: 'CONFIRMACAO_GESTOR_NECESSARIA',
    },
    403
  )
})

