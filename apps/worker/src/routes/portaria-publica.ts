import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { executarOperacaoComAudit, extrairEscopoDoEvento } from '../services/auditoria'

export const portariaPublicaRouter = new Hono<any>()

portariaPublicaRouter.post('/convidados/:token/presenca', async c => {
  const db = c.get('db')
  const token = c.req.param('token')

  if (!db || !token) {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  const tokenHash = await hashToken(token)
  const credencial = await db
    .select({
      credencial: schema.credenciaisConvidadoEvento,
      convidado: schema.convidadosEvento,
      evento: schema.eventos,
      portaria: schema.portariasEvento,
    })
    .from(schema.credenciaisConvidadoEvento)
    .innerJoin(
      schema.convidadosEvento,
      eq(schema.credenciaisConvidadoEvento.convidadoId, schema.convidadosEvento.id)
    )
    .innerJoin(schema.eventos, eq(schema.convidadosEvento.eventoId, schema.eventos.id))
    .leftJoin(schema.portariasEvento, eq(schema.eventos.id, schema.portariasEvento.eventoId))
    .where(eq(schema.credenciaisConvidadoEvento.tokenHash, tokenHash))
    .get()

  if (!credencial) {
    return c.json({ error: 'Credencial inválida', code: 'NOT_FOUND' }, 404)
  }

  if (
    credencial.credencial.revogadoEm ||
    credencial.credencial.utilizadoEm ||
    !credencial.convidado.ativo ||
    !credencial.evento.ativo
  ) {
    return c.json({ error: 'Credencial indisponível', code: 'CREDENCIAL_INDISPONIVEL' }, 409)
  }

  if (Date.parse(credencial.credencial.expiraEm) <= Date.now()) {
    return c.json({ error: 'Credencial expirada', code: 'CREDENCIAL_EXPIRADA' }, 410)
  }

  if (credencial.portaria?.status === 'FECHADA') {
    return c.json({ error: 'Portaria fechada', code: 'PORTARIA_FECHADA' }, 409)
  }

  const existente = await db
    .select({ id: schema.presencasConvidadoEvento.id })
    .from(schema.presencasConvidadoEvento)
    .where(
      and(
        eq(schema.presencasConvidadoEvento.eventoId, credencial.evento.id),
        eq(schema.presencasConvidadoEvento.convidadoId, credencial.convidado.id)
      )
    )
    .get()

  if (existente) {
    return c.json({ error: 'Presença já registrada', code: 'PRESENCA_DUPLICADA' }, 409)
  }

  const agora = new Date().toISOString()
  const presencaId = crypto.randomUUID()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(credencial.evento)

  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb.insert(schema.presencasConvidadoEvento).values({
        id: presencaId,
        convidadoId: credencial.convidado.id,
        eventoId: credencial.evento.id,
        forma: 'LINK',
        registradoPorMembroId: null,
        registradoEm: agora,
        createdAt: agora,
        updatedAt: agora,
      }),
      qdb
        .update(schema.credenciaisConvidadoEvento)
        .set({ utilizadoEm: agora, updatedAt: agora })
        .where(eq(schema.credenciaisConvidadoEvento.id, credencial.credencial.id)),
    ],
    {
      acao: 'PORTARIA_PRESENCA_CONVIDADO_LINK',
      atorMembroId: null,
      recursoTipo: 'PRESENCA_CONVIDADO_EVENTO',
      recursoId: presencaId,
      escopoTipo,
      escopoId,
      contexto: {
        eventoId: credencial.evento.id,
        convidadoId: credencial.convidado.id,
        forma: 'LINK',
      },
    }
  )

  return c.json(
    {
      registrado: true,
      evento: {
        id: credencial.evento.id,
        titulo: credencial.evento.titulo,
      },
      convidado: {
        id: credencial.convidado.id,
        nome: credencial.convidado.nome,
      },
      registradoEm: agora,
    },
    201
  )
})
