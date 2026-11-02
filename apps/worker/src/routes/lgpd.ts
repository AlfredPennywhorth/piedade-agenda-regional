import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import * as schema from '../db/schema'
import { authMiddleware, type Variables } from '../middleware/auth'
import { LGPD_VERSAO, LGPD_TITULO, LGPD_PARAGRAFOS } from '../security/lgpd-termos'

export const lgpdApp = new Hono<{ Variables: Variables }>()
lgpdApp.use('*', authMiddleware)

async function hashTermos(): Promise<string> {
  const texto = [LGPD_VERSAO, LGPD_TITULO, ...LGPD_PARAGRAFOS].join('\n')
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

lgpdApp.get('/', async c => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const registro = await db.select({ registradoEm: schema.cienciasPrivacidade.registradoEm })
    .from(schema.cienciasPrivacidade)
    .where(and(eq(schema.cienciasPrivacidade.membroId, membroId),
      eq(schema.cienciasPrivacidade.versao, LGPD_VERSAO))).get()
  return c.json({
    versao: LGPD_VERSAO,
    titulo: LGPD_TITULO,
    paragrafos: LGPD_PARAGRAFOS,
    hash: await hashTermos(),
    ciente: Boolean(registro),
    registradoEm: registro?.registradoEm ?? null,
  })
})

lgpdApp.post('/ciencia', async c => {
  let body: { versao?: unknown; hash?: unknown; leituraConfirmada?: unknown; tratamentoNecessarioCiente?: unknown }
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }
  const hash = await hashTermos()
  if (body.versao !== LGPD_VERSAO || body.hash !== hash ||
      body.leituraConfirmada !== true || body.tratamentoNecessarioCiente !== true) {
    return c.json({ error: 'É necessário ler e confirmar ciência do aviso vigente.', code: 'VALIDATION_ERROR' }, 400)
  }
  const db = c.get('db')
  const membroId = c.get('membroId')
  const contaAcessoId = c.get('contaAcessoId')
  const agora = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.insert(schema.cienciasPrivacidade).values({
    id, membroId, contaAcessoId, versao: LGPD_VERSAO, textoHash: hash,
    leituraConfirmada: true, tratamentoNecessarioCiente: true, registradoEm: agora,
  }).onConflictDoNothing().run()
  const existente = await db.select({ id: schema.cienciasPrivacidade.id, registradoEm: schema.cienciasPrivacidade.registradoEm })
    .from(schema.cienciasPrivacidade)
    .where(and(eq(schema.cienciasPrivacidade.membroId, membroId),
      eq(schema.cienciasPrivacidade.versao, LGPD_VERSAO))).get()
  if (!existente) return c.json({ error: 'Registro não confirmado', code: 'INTERNAL_ERROR' }, 500)
  // Registro mínimo, uma ciência por titular e por versão. Respostas subsequentes são idempotentes.
  return c.json({ ciente: true, versao: LGPD_VERSAO, registradoEm: existente.registradoEm }, 200)
})
