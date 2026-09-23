import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
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
  const existente = await db
    .select()
    .from(schema.rateLimitsAutenticacao)
    .where(eq(schema.rateLimitsAutenticacao.chaveHash, chaveHash))
    .get()

  if (existente && new Date(existente.expiraEm) > agora) {
    if (existente.falhasConsecutivas >= LIMITE_RECUPERACOES_POR_JANELA) {
      const retryAfter = Math.max(
        1,
        Math.ceil((new Date(existente.expiraEm).getTime() - agora.getTime()) / 1000)
      )
      c.header('Retry-After', String(retryAfter))
      return false
    }

    await db
      .update(schema.rateLimitsAutenticacao)
      .set({
        falhasConsecutivas: existente.falhasConsecutivas + 1,
        updatedAt: agora.toISOString(),
      })
      .where(eq(schema.rateLimitsAutenticacao.chaveHash, chaveHash))
      .execute()
    return true
  }

  if (existente) {
    await db
      .delete(schema.rateLimitsAutenticacao)
      .where(eq(schema.rateLimitsAutenticacao.chaveHash, chaveHash))
      .execute()
  }

  await db.insert(schema.rateLimitsAutenticacao).values({
    chaveHash,
    falhasConsecutivas: 1,
    bloqueadoAte: null,
    expiraEm: new Date(agora.getTime() + JANELA_RECUPERACAO_MS).toISOString(),
    createdAt: agora.toISOString(),
    updatedAt: agora.toISOString(),
  })

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
