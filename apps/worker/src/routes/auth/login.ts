import { Context, Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { loginSchema } from '@piedade/shared'
import * as schema from '../../db/schema'
import { verifyPin } from '../../security/pin'
import { hashToken, gerarTokenAleatorio } from '../../security/tokens'
import { executeAtomic } from '../../db/batch'

import { Env } from '../../index'
export const loginApp = new Hono<{ Bindings: Env; Variables: { db: any } }>()

const RETENCAO_RATE_LIMIT_MS = 24 * 60 * 60 * 1000
const BLOQUEIOS_PROGRESSIVOS_MS: Record<number, number> = {
  5: 30 * 1000,
  6: 60 * 1000,
  7: 2 * 60 * 1000,
  8: 5 * 60 * 1000,
  9: 10 * 60 * 1000,
}
const BLOQUEIO_MAXIMO_MS = 15 * 60 * 1000

function obterDuracaoBloqueio(falhas: number) {
  return BLOQUEIOS_PROGRESSIVOS_MS[falhas] ?? (falhas >= 10 ? BLOQUEIO_MAXIMO_MS : 0)
}

function respostaBloqueada(c: Context, bloqueadoAte: Date, agora: Date) {
  const retryAfter = Math.max(1, Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 1000))
  c.header('Retry-After', String(retryAfter))
  return c.json({ error: 'Credenciais inválidas' }, 429)
}

async function registrarFalha(
  db: any,
  rateLimit: typeof schema.rateLimitsAutenticacao.$inferSelect | undefined,
  chaveHash: string,
  membroId: string | undefined,
  agora: Date
) {
  const falhasAnteriores =
    rateLimit && new Date(rateLimit.expiraEm) > agora ? rateLimit.falhasConsecutivas : 0
  const falhasConsecutivas = falhasAnteriores + 1
  const duracaoBloqueio = obterDuracaoBloqueio(falhasConsecutivas)
  const bloqueadoAte = duracaoBloqueio
    ? new Date(agora.getTime() + duracaoBloqueio).toISOString()
    : null
  const expiraEm = new Date(agora.getTime() + RETENCAO_RATE_LIMIT_MS).toISOString()

  await executeAtomic(db, tx => {
    const queries = [
      tx.insert(schema.tentativasAcesso).values({
        id: crypto.randomUUID(),
        membroId: membroId ?? null,
        tipo: 'LOGIN_PIN',
        sucesso: false,
        motivo: 'Credenciais inválidas',
      }),
    ]
    if (membroId) {
      queries.push(
        tx
          .update(schema.membros)
          .set({
            tentativasPin: falhasConsecutivas,
            bloqueadoAte,
            updatedAt: agora.toISOString(),
          })
          .where(eq(schema.membros.id, membroId))
      )
    }
    if (rateLimit && new Date(rateLimit.expiraEm) > agora) {
      queries.push(
        tx
          .update(schema.rateLimitsAutenticacao)
          .set({
            falhasConsecutivas,
            bloqueadoAte,
            expiraEm,
            updatedAt: agora.toISOString(),
          })
          .where(eq(schema.rateLimitsAutenticacao.chaveHash, chaveHash))
      )
    } else {
      queries.push(
        tx.insert(schema.rateLimitsAutenticacao).values({
          chaveHash,
          falhasConsecutivas,
          bloqueadoAte,
          expiraEm,
          createdAt: agora.toISOString(),
          updatedAt: agora.toISOString(),
        })
      )
    }
    return queries
  })

  return { bloqueadoAte, falhasConsecutivas }
}

loginApp.post('/', async c => {
  const body = await c.req.json()
  const result = loginSchema.safeParse(body)

  if (!result.success) {
    return c.json({ error: 'Credenciais inválidas' }, 400)
  }

  const { identificador, pin } = result.data

  const db = c.get('db')
  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const agora = new Date()
  const chaveHash = await hashToken(identificador)

  const [rateLimit] = await db
    .select()
    .from(schema.rateLimitsAutenticacao)
    .where(eq(schema.rateLimitsAutenticacao.chaveHash, chaveHash))
    .limit(1)

  if (rateLimit && new Date(rateLimit.expiraEm) <= agora) {
    await db
      .delete(schema.rateLimitsAutenticacao)
      .where(eq(schema.rateLimitsAutenticacao.chaveHash, chaveHash))
      .execute()
  } else if (rateLimit?.bloqueadoAte) {
    const bloqueadoAte = new Date(rateLimit.bloqueadoAte)
    if (agora < bloqueadoAte) {
      return respostaBloqueada(c, bloqueadoAte, agora)
    }
  }

  const [membro] = await db
    .select()
    .from(schema.membros)
    .where(eq(schema.membros.celular, identificador))
    .limit(1)

  // Mensagem genérica para não enumerar usuários
  const errorMsg = 'Credenciais inválidas'

  if (!membro || !membro.ativo || !membro.autenticacaoAtiva) {
    const falha = await registrarFalha(db, rateLimit, chaveHash, membro?.id, agora)
    if (falha.bloqueadoAte) {
      return respostaBloqueada(c, new Date(falha.bloqueadoAte), agora)
    }
    return c.json({ error: errorMsg }, 401)
  }

  // Verificar PIN
  const pepper = c.env?.PIN_PEPPER || 'test-pepper'
  const pinValido = await verifyPin(pin, pepper, membro.pinHash!)

  if (!pinValido) {
    const falha = await registrarFalha(db, rateLimit, chaveHash, membro.id, agora)
    if (falha.bloqueadoAte) {
      return respostaBloqueada(c, new Date(falha.bloqueadoAte), agora)
    }
    return c.json({ error: errorMsg }, 401)
  }

  const sessionToken = gerarTokenAleatorio()
  const hashedSessionToken = await hashToken(sessionToken)
  const expiraEm = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await executeAtomic(db, tx => [
    tx
      .update(schema.membros)
      .set({ tentativasPin: 0, bloqueadoAte: null, updatedAt: agora.toISOString() })
      .where(eq(schema.membros.id, membro.id)),
    tx
      .delete(schema.rateLimitsAutenticacao)
      .where(eq(schema.rateLimitsAutenticacao.chaveHash, chaveHash)),
    tx.insert(schema.sessoes).values({
      id: crypto.randomUUID(),
      membroId: membro.id,
      tokenHash: hashedSessionToken,
      expiraEm,
      userAgent: c.req.header('User-Agent') || null,
    }),
    tx.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      membroId: membro.id,
      tipo: 'LOGIN_PIN',
      sucesso: true,
    }),
  ])

  return c.json({ sessionToken }, 200)
})
