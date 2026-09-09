import { Hono } from 'hono'
import { eq, and, like, gt, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { CheckinManualSchema, CheckinQrSchema } from '@piedade/shared'
import { emitirCredencial, hashToken } from '../services/checkin-token'

export const checkinsRouter = new Hono<{ Variables: Variables }>()

checkinsRouter.use('*', authMiddleware)

type DB = Variables['db']

// Helper para checar autorização de organizador e se o evento existe/ativo
async function verificarEventoOrganizador(db: DB, eventoId: string, membroId: string) {
  const evento = await db.select({
    organizador: schema.eventos.organizadorMembroId,
    ativo: schema.eventos.ativo
  })
    .from(schema.eventos)
    .where(eq(schema.eventos.id, eventoId))
    .get()

  if (!evento) return { existe: false, ativo: false, autorizado: false }
  
  return {
    existe: true,
    ativo: evento.ativo,
    autorizado: evento.organizador === membroId
  }
}

checkinsRouter.post('/:eventoId/credencial-checkin', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !membroId) return c.json({ error: 'Erro interno' }, 500)

  // Verifica se o evento existe e está ativo
  const evento = await db.select({ ativo: schema.eventos.ativo })
    .from(schema.eventos)
    .where(eq(schema.eventos.id, eventoId))
    .get()

  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404)
  if (!evento.ativo) return c.json({ error: 'Evento inativo' }, 403)

  // Verifica acesso via convocacao publicada e ativa
  const destinatario = await db.select({ id: schema.convocacaoDestinatarios.id })
    .from(schema.convocacaoDestinatarios)
    .innerJoin(schema.convocacoes, eq(schema.convocacaoDestinatarios.convocacaoId, schema.convocacoes.id))
    .where(and(
      eq(schema.convocacoes.eventoId, eventoId),
      eq(schema.convocacoes.status, 'PUBLICADA'),
      eq(schema.convocacoes.ativo, true),
      eq(schema.convocacaoDestinatarios.membroId, membroId)
    ))
    .get()

  if (!destinatario) {
    return c.json({ error: 'Membro não possui acesso a este evento via convocação' }, 403)
  }

  const { rawToken, expiraEm } = await emitirCredencial(db, eventoId, membroId)
  return c.json({ token: rawToken, expiraEm })
})

checkinsRouter.get('/:eventoId/portaria/membros', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')
  const query = c.req.query('q')

  if (!db || !membroId) return c.json({ error: 'Erro interno' }, 500)

  const verificacao = await verificarEventoOrganizador(db, eventoId, membroId)
  if (!verificacao.existe) return c.json({ error: 'Evento não encontrado' }, 404)
  if (!verificacao.autorizado) return c.json({ error: 'Apenas organizador pode acessar a portaria' }, 403)

  if (!query || query.length < 2) {
    return c.json({ error: 'Termo de busca muito curto' }, 400)
  }

  const result = await db.select({
    membroId: schema.membros.id,
    nome: schema.membros.nome,
  })
  .from(schema.membros)
  .where(and(
    eq(schema.membros.ativo, true),
    like(schema.membros.nome, `%${query}%`)
  ))
  .limit(20)

  if (result.length === 0) return c.json([])

  const ids = result.map((r: { membroId: string; nome: string }) => r.membroId)
  
  // Verifica checkins e convocações para estes IDs
  const checkinsList = await db.select({ membroId: schema.checkins.membroId })
    .from(schema.checkins)
    .where(and(
      eq(schema.checkins.eventoId, eventoId),
      inArray(schema.checkins.membroId, ids),
      eq(schema.checkins.ativo, true)
    ))

  const convs = await db.select({ membroId: schema.convocacaoDestinatarios.membroId })
    .from(schema.convocacaoDestinatarios)
    .innerJoin(schema.convocacoes, eq(schema.convocacaoDestinatarios.convocacaoId, schema.convocacoes.id))
    .where(and(
      eq(schema.convocacoes.eventoId, eventoId),
      inArray(schema.convocacaoDestinatarios.membroId, ids)
    ))

  const checkinsSet = new Set<string>(checkinsList.map((ch: { membroId: string }) => ch.membroId))
  const convsSet = new Set<string>(convs.map((cv: { membroId: string }) => cv.membroId))

  const formatted = result.map((r: { membroId: string; nome: string }) => ({
    membroId: r.membroId,
    nome: r.nome,
    convocado: convsSet.has(r.membroId),
    checkinAtivo: checkinsSet.has(r.membroId)
  }))

  return c.json(formatted)
})

async function registrarCheckin(
  db: DB,
  eventoId: string,
  alvoMembroId: string,
  operadorMembroId: string,
  modo: 'QR' | 'MANUAL'
): Promise<{ status: 200 | 201; json: { status: 'REGISTRADO' | 'JA_REGISTRADO'; checkinId: string; registradoEm: string } }> {
  const agora = new Date().toISOString()
  
  // Verifica se já tem ativo
  const existente = await db.select().from(schema.checkins)
    .where(and(
      eq(schema.checkins.eventoId, eventoId),
      eq(schema.checkins.membroId, alvoMembroId),
      eq(schema.checkins.ativo, true)
    )).get()

  if (existente) {
    return { status: 200, json: { status: 'JA_REGISTRADO', checkinId: existente.id, registradoEm: existente.registradoEm } }
  }

  // Busca destinatario
  const destinatario = await db.select({ id: schema.convocacaoDestinatarios.id })
    .from(schema.convocacaoDestinatarios)
    .innerJoin(schema.convocacoes, eq(schema.convocacaoDestinatarios.convocacaoId, schema.convocacoes.id))
    .where(and(
      eq(schema.convocacoes.eventoId, eventoId),
      eq(schema.convocacaoDestinatarios.membroId, alvoMembroId)
    ))
    .get()

  const novoId = crypto.randomUUID()
  try {
    await db.insert(schema.checkins).values({
      id: novoId,
      eventoId,
      membroId: alvoMembroId,
      convocacaoDestinatarioId: destinatario?.id || null,
      modo,
      registradoEm: agora,
      registradoPorMembroId: operadorMembroId,
      ativo: true,
      createdAt: agora,
      updatedAt: agora
    })
    return { status: 201, json: { status: 'REGISTRADO', checkinId: novoId, registradoEm: agora } }
  } catch (err: unknown) {
    // Caso de constraint unique caindo no conflito exato (idempotencia hard)
    const concorrente = await db.select().from(schema.checkins)
      .where(and(
        eq(schema.checkins.eventoId, eventoId),
        eq(schema.checkins.membroId, alvoMembroId),
        eq(schema.checkins.ativo, true)
      )).get()
    
    if (concorrente) {
      return { status: 200, json: { status: 'JA_REGISTRADO', checkinId: concorrente.id, registradoEm: concorrente.registradoEm } }
    }
    throw err
  }
}

checkinsRouter.post('/:eventoId/checkins/manual', async (c) => {
  const db = c.get('db')
  const operadorId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !operadorId) return c.json({ error: 'Erro interno' }, 500)

  const verificacao = await verificarEventoOrganizador(db, eventoId, operadorId)
  if (!verificacao.existe) return c.json({ error: 'Evento não encontrado' }, 404)
  if (!verificacao.autorizado) return c.json({ error: 'Apenas organizador' }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const parsed = CheckinManualSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Payload inválido' }, 400)
  }

  try {
    const membro = await db.select({ id: schema.membros.id }).from(schema.membros)
      .where(and(eq(schema.membros.id, parsed.data.membroId), eq(schema.membros.ativo, true))).get()
    
    if (!membro) return c.json({ error: 'Membro inválido ou inativo' }, 404)

    const result = await registrarCheckin(db, eventoId, parsed.data.membroId, operadorId, 'MANUAL')
    return c.json(result.json, result.status)
  } catch (err: unknown) {
    console.error(err)
    return c.json({ error: 'Erro interno do servidor' }, 500)
  }
})

checkinsRouter.post('/:eventoId/checkins/qr', async (c) => {
  const db = c.get('db')
  const operadorId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !operadorId) return c.json({ error: 'Erro interno' }, 500)

  const verificacao = await verificarEventoOrganizador(db, eventoId, operadorId)
  if (!verificacao.existe) return c.json({ error: 'Evento não encontrado' }, 404)
  if (!verificacao.autorizado) return c.json({ error: 'Apenas organizador' }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const parsed = CheckinQrSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Payload inválido' }, 400)
  }

  try {
    const hashed = await hashToken(parsed.data.token)
    const agora = new Date().toISOString()

    const tokenRecord = await db.select().from(schema.checkinTokens)
      .where(and(
        eq(schema.checkinTokens.tokenHash, hashed),
        eq(schema.checkinTokens.ativo, true),
        eq(schema.checkinTokens.eventoId, eventoId),
        gt(schema.checkinTokens.expiraEm, agora)
      )).get()

    if (!tokenRecord) {
      return c.json({ error: 'Token inválido ou expirado' }, 400)
    }

    const membro = await db.select({ id: schema.membros.id }).from(schema.membros)
      .where(and(eq(schema.membros.id, tokenRecord.membroId), eq(schema.membros.ativo, true))).get()
    
    if (!membro) return c.json({ error: 'Membro inválido ou inativo' }, 404)

    const result = await registrarCheckin(db, eventoId, tokenRecord.membroId, operadorId, 'QR')
    return c.json(result.json, result.status)
  } catch (err: unknown) {
    console.error(err)
    return c.json({ error: 'Erro interno do servidor' }, 500)
  }
})

checkinsRouter.patch('/:eventoId/checkins/:checkinId/inativar', async (c) => {
  const db = c.get('db')
  const operadorId = c.get('membroId')
  const eventoId = c.req.param('eventoId')
  const checkinId = c.req.param('checkinId')

  if (!db || !operadorId) return c.json({ error: 'Erro interno' }, 500)

  const verificacao = await verificarEventoOrganizador(db, eventoId, operadorId)
  if (!verificacao.existe) return c.json({ error: 'Evento não encontrado' }, 404)
  if (!verificacao.autorizado) return c.json({ error: 'Apenas organizador' }, 403)

  const agora = new Date().toISOString()

  const record = await db.select().from(schema.checkins)
    .where(and(eq(schema.checkins.id, checkinId), eq(schema.checkins.eventoId, eventoId))).get()

  if (!record) return c.json({ error: 'Registro não encontrado no evento' }, 404)

  if (!record.ativo) {
    return c.json({ success: true, checkinId, status: 'JA_INATIVO' }, 200)
  }

  await db.update(schema.checkins)
    .set({ ativo: false, updatedAt: agora })
    .where(eq(schema.checkins.id, checkinId))
    .execute()

  return c.json({ success: true, checkinId, status: 'INATIVADO' }, 200)
})
