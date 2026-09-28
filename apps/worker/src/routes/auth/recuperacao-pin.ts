import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { solicitarRecuperacaoPinSchema } from '@piedade/shared'
import * as schema from '../../db/schema'
import { hashToken } from '../../security/tokens'

export const recuperacaoPinApp = new Hono<{ Variables: { db: any } }>()

const JANELA_RECUPERACAO_MS = 15 * 60 * 1000
const LIMITE_RECUPERACOES_POR_JANELA = 10

async function aplicarThrottleRecuperacao(c: any, db: any) {
  const origem = c.req.header('CF-Connecting-IP') || 'origem-local'
  const chaveHash = await hashToken(`recuperacao-pin:${origem}`)
  const agora = new Date()
  const agoraIso = agora.toISOString()
  const novaExpiracao = new Date(agora.getTime() + JANELA_RECUPERACAO_MS).toISOString()

  const persistido = await db
    .insert(schema.rateLimitsAutenticacao)
    .values({
      chaveHash,
      falhasConsecutivas: 1,
      bloqueadoAte: null,
      expiraEm: novaExpiracao,
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
        expiraEm: sql`CASE
          WHEN ${schema.rateLimitsAutenticacao.expiraEm} <= ${agoraIso}
          THEN ${novaExpiracao}
          ELSE ${schema.rateLimitsAutenticacao.expiraEm}
        END`,
        bloqueadoAte: null,
        updatedAt: agoraIso,
      },
    })
    .returning({
      falhasConsecutivas: schema.rateLimitsAutenticacao.falhasConsecutivas,
      expiraEm: schema.rateLimitsAutenticacao.expiraEm,
    })
    .get()

  if (!persistido) return false

  if (persistido.falhasConsecutivas > LIMITE_RECUPERACOES_POR_JANELA) {
    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(persistido.expiraEm).getTime() - agora.getTime()) / 1000)
    )
    c.header('Retry-After', String(retryAfter))
    return false
  }

  return true
}

recuperacaoPinApp.post('/', async c => {
  const db = c.get('db')

  if (!(await aplicarThrottleRecuperacao(c, db))) {
    return c.json(
      { message: 'Muitas solicitações. Tente novamente mais tarde.' },
      429
    )
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ message: 'Se os dados estiverem cadastrados, a solicitação será encaminhada.' }, 202)
  }

  const parsed = solicitarRecuperacaoPinSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ message: 'Se os dados estiverem cadastrados, a solicitação será encaminhada.' }, 202)
  }

  const identidade = await db
    .select({
      membroId: schema.membros.id,
      contaAcessoId: schema.contasAcesso.id,
      membroAtivo: schema.membros.ativo,
      contaStatus: schema.contasAcesso.status,
    })
    .from(schema.membros)
    .innerJoin(schema.contasAcesso, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(eq(schema.membros.celular, parsed.data.celular))
    .get()

  if (identidade?.membroAtivo && identidade.contaStatus !== 'DESATIVADA') {
    await db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: identidade.contaAcessoId,
      membroId: identidade.membroId,
      tipo: 'RECUPERACAO_PIN_SOLICITADA',
      sucesso: true,
      motivo: 'Solicitação de redefinição de PIN registrada para tratamento administrativo',
    })
  }

  return c.json(
    {
      message:
        'Se os dados estiverem cadastrados, a solicitação será encaminhada ao responsável pelo acesso.',
    },
    202
  )
})
