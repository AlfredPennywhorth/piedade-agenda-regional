import { Hono } from 'hono'
import { eq, and, like, gt, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { CheckinManualSchema, CheckinQrSchema } from '@piedade/shared'
import { emitirCredencial, hashToken } from '../services/checkin-token'

export const checkinsRouter = new Hono<{ Variables: Variables }>()

checkinsRouter.use('*', authMiddleware)

// Helper para checar autorização de organizador
async function checkOrganizador(db: any, eventoId: string, membroId: string): Promise<boolean> {
  const evento = await db.select({ organizador: schema.eventos.organizadorMembroId })
    .from(schema.eventos)
    .where(eq(schema.eventos.id, eventoId))
    .get()
  return evento?.organizador === membroId
}

checkinsRouter.post('/:eventoId/credencial-checkin', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !membroId) return c.json({ error: 'Erro interno' }, 500)

  // Verifica se o membro tem acesso (destinatário da convocação)
  const evento = await db.select({ id: schema.eventos.id })
    .from(schema.eventos)
    .where(eq(schema.eventos.id, eventoId))
    .get()

  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404)

  const destinatario = await db.select()
    .from(schema.convocacaoDestinatarios)
    .innerJoin(schema.convocacoes, eq(schema.convocacaoDestinatarios.convocacaoId, schema.convocacoes.id))
    .where(and(
      eq(schema.convocacoes.eventoId, eventoId),
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

  const isOrg = await checkOrganizador(db, eventoId, membroId)
  if (!isOrg) return c.json({ error: 'Apenas organizador pode acessar a portaria' }, 403)

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

  const ids = result.map((r: any) => r.membroId)
  
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

  const checkinsSet = new Set(checkinsList.map((c: any) => c.membroId))
  const convsSet = new Set(convs.map((c: any) => c.membroId))

  const formatted = result.map((r: any) => ({
    membroId: r.membroId,
    nome: r.nome,
    convocado: convsSet.has(r.membroId),
    checkinAtivo: checkinsSet.has(r.membroId)
  }))

  return c.json(formatted)
})

async function registrarCheckin(
  db: any,
  eventoId: string,
  alvoMembroId: string,
  operadorMembroId: string,
  modo: 'QR' | 'MANUAL'
) {
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
  } catch (err: any) {
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

  const isOrg = await checkOrganizador(db, eventoId, operadorId)
  if (!isOrg) return c.json({ error: 'Apenas organizador' }, 403)

  try {
    const body = await c.req.json()
    const parsed = CheckinManualSchema.parse(body)

    const membro = await db.select({ id: schema.membros.id }).from(schema.membros)
      .where(and(eq(schema.membros.id, parsed.membroId), eq(schema.membros.ativo, true))).get()
    
    if (!membro) return c.json({ error: 'Membro inválido ou inativo' }, 404)

    const result = await registrarCheckin(db, eventoId, parsed.membroId, operadorId, 'MANUAL')
    return c.json(result.json, result.status as any)
  } catch (err: any) {
    return c.json({ error: 'Payload inválido' }, 400)
  }
})

checkinsRouter.post('/:eventoId/checkins/qr', async (c) => {
  const db = c.get('db')
  const operadorId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !operadorId) return c.json({ error: 'Erro interno' }, 500)

  const isOrg = await checkOrganizador(db, eventoId, operadorId)
  if (!isOrg) return c.json({ error: 'Apenas organizador' }, 403)

  try {
    const body = await c.req.json()
    const parsed = CheckinQrSchema.parse(body)

    const hashed = await hashToken(parsed.token)
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
    return c.json(result.json, result.status as any)
  } catch (err: any) {
    return c.json({ error: 'Payload inválido' }, 400)
  }
})

checkinsRouter.patch('/:eventoId/checkins/:checkinId/inativar', async (c) => {
  const db = c.get('db')
  const operadorId = c.get('membroId')
  const eventoId = c.req.param('eventoId')
  const checkinId = c.req.param('checkinId')

  if (!db || !operadorId) return c.json({ error: 'Erro interno' }, 500)

  const isOrg = await checkOrganizador(db, eventoId, operadorId)
  if (!isOrg) return c.json({ error: 'Apenas organizador' }, 403)

  const agora = new Date().toISOString()

  const record = await db.select().from(schema.checkins)
    .where(and(eq(schema.checkins.id, checkinId), eq(schema.checkins.eventoId, eventoId))).get()

  if (!record) return c.json({ error: 'Registro não encontrado no evento' }, 404)

  await db.update(schema.checkins)
    .set({ ativo: false, updatedAt: agora })
    .where(eq(schema.checkins.id, checkinId))
    .execute()

  return c.json({ success: true, checkinId, status: 'INATIVADO' }, 200)
})
