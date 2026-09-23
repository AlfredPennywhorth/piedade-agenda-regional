import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { solicitarRecuperacaoPinSchema } from '@piedade/shared'
import * as schema from '../../db/schema'

export const recuperacaoPinApp = new Hono<{ Variables: { db: any } }>()

recuperacaoPinApp.post('/', async c => {
  const db = c.get('db')

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
