import { Context, Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { loginSchema } from '@piedade/shared'
import * as schema from '../../db/schema'
import { verifyPin } from '../../security/pin'
import { hashToken, gerarTokenAleatorio } from '../../security/tokens'
import { executeAtomic } from '../../db/batch'
import { obterPinPepper } from '../../security/pin-pepper'

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
  chaveHash: string,
  contaAcessoId: string | undefined,
  membroId: string | undefined,
  agora: Date
) {
  const agoraIso = agora.toISOString()
  const expiraEm = new Date(agora.getTime() + RETENCAO_RATE_LIMIT_MS).toISOString()
  const bloqueio5 = new Date(agora.getTime() + 30 * 1000).toISOString()
  const bloqueio6 = new Date(agora.getTime() + 60 * 1000).toISOString()
  const bloqueio7 = new Date(agora.getTime() + 2 * 60 * 1000).toISOString()
  const bloqueio8 = new Date(agora.getTime() + 5 * 60 * 1000).toISOString()
  const bloqueio9 = new Date(agora.getTime() + 10 * 60 * 1000).toISOString()
  const bloqueioMaximo = new Date(agora.getTime() + BLOQUEIO_MAXIMO_MS).toISOString()

  const rateAtualizado = await db
    .insert(schema.rateLimitsAutenticacao)
    .values({
      chaveHash,
      falhasConsecutivas: 1,
      bloqueadoAte: null,
      expiraEm,
      createdAt: agoraIso,
      updatedAt: agoraIso,
    })
    .onConflictDoUpdate({
      target: schema.rateLimitsAutenticacao.chaveHash,
      set: {
        falhasConsecutivas: sql`CASE
          WHEN ${schema.rateLimitsAutenticacao.expiraEm} <= ${agoraIso}
          THEN 1
          ELSE ${schema.rateLimitsAutenticacao.falhasConsecutivas} + 1
        END`,
        bloqueadoAte: sql`CASE
          WHEN ${schema.rateLimitsAutenticacao.expiraEm} <= ${agoraIso} THEN NULL
          WHEN ${schema.rateLimitsAutenticacao.falhasConsecutivas} + 1 = 5 THEN ${bloqueio5}
          WHEN ${schema.rateLimitsAutenticacao.falhasConsecutivas} + 1 = 6 THEN ${bloqueio6}
          WHEN ${schema.rateLimitsAutenticacao.falhasConsecutivas} + 1 = 7 THEN ${bloqueio7}
          WHEN ${schema.rateLimitsAutenticacao.falhasConsecutivas} + 1 = 8 THEN ${bloqueio8}
          WHEN ${schema.rateLimitsAutenticacao.falhasConsecutivas} + 1 = 9 THEN ${bloqueio9}
          WHEN ${schema.rateLimitsAutenticacao.falhasConsecutivas} + 1 >= 10 THEN ${bloqueioMaximo}
          ELSE NULL
        END`,
        expiraEm,
        updatedAt: agoraIso,
      },
    })
    .returning({
      falhasConsecutivas: schema.rateLimitsAutenticacao.falhasConsecutivas,
      bloqueadoAte: schema.rateLimitsAutenticacao.bloqueadoAte,
    })
    .get()

  if (!rateAtualizado) {
    throw new Error('Falha ao atualizar controle de tentativas de login')
  }

  await executeAtomic(db, tx => {
    const queries = [
      tx.insert(schema.tentativasAcesso).values({
        id: crypto.randomUUID(),
        contaAcessoId: contaAcessoId ?? null,
        membroId: membroId ?? null,
        tipo: 'LOGIN_PIN',
        sucesso: false,
        motivo: 'Credenciais inválidas',
      }),
    ]

    if (contaAcessoId) {
      queries.push(
        tx
          .update(schema.contasAcesso)
          .set({
            tentativasPin: rateAtualizado.falhasConsecutivas,
            bloqueadoAte: rateAtualizado.bloqueadoAte,
            updatedAt: agoraIso,
          })
          .where(eq(schema.contasAcesso.id, contaAcessoId))
      )
    }

    return queries
  })

  return rateAtualizado
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

  if (
    rateLimit &&
    new Date(rateLimit.expiraEm) > agora &&
    rateLimit.bloqueadoAte
  ) {
    const bloqueadoAte = new Date(rateLimit.bloqueadoAte)
    if (agora < bloqueadoAte) {
      return respostaBloqueada(c, bloqueadoAte, agora)
    }
  }

  const [identidade] = await db
    .select({
      membro: schema.membros,
      conta: schema.contasAcesso,
    })
    .from(schema.membros)
    .innerJoin(schema.contasAcesso, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(eq(schema.membros.celular, identificador))
    .limit(1)

  const errorMsg = 'Credenciais inválidas'
  const membro = identidade?.membro
  const conta = identidade?.conta

  if (!membro || !conta || !membro.ativo || conta.status !== 'ATIVA' || !conta.pinHash) {
    const falha = await registrarFalha(
      db,
      chaveHash,
      conta?.id,
      membro?.id,
      agora
    )
    if (falha.bloqueadoAte) {
      return respostaBloqueada(c, new Date(falha.bloqueadoAte), agora)
    }
    return c.json({ error: errorMsg }, 401)
  }

  if (conta.bloqueadoAte && agora < new Date(conta.bloqueadoAte)) {
    return respostaBloqueada(c, new Date(conta.bloqueadoAte), agora)
  }

  const pepper = obterPinPepper(c.env)
  const pinValido = await verifyPin(pin, pepper, conta.pinHash)

  if (!pinValido) {
    const falha = await registrarFalha(db, chaveHash, conta.id, membro.id, agora)
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
      .update(schema.contasAcesso)
      .set({ tentativasPin: 0, bloqueadoAte: null, updatedAt: agora.toISOString() })
      .where(eq(schema.contasAcesso.id, conta.id)),
    tx
      .delete(schema.rateLimitsAutenticacao)
      .where(eq(schema.rateLimitsAutenticacao.chaveHash, chaveHash)),
    tx.insert(schema.sessoes).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId: membro.id,
      tokenHash: hashedSessionToken,
      expiraEm,
      userAgent: c.req.header('User-Agent') || null,
    }),
    tx.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId: membro.id,
      tipo: 'LOGIN_PIN',
      sucesso: true,
    }),
  ])

  return c.json({ sessionToken }, 200)
})
