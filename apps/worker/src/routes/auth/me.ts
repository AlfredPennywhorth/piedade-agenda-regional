import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { authMiddleware, Variables } from '../../middleware/auth'
import { obterCapacidadesMembro } from '../../security/permissoes'

export const meApp = new Hono<{ Variables: Variables }>()

meApp.use('*', authMiddleware)

meApp.get('/', async c => {
  const membroId = c.get('membroId')
  const contaAcessoId = c.get('contaAcessoId')
  const db = c.get('db')

  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const [identidade] = await db
    .select({
      membro: schema.membros,
      conta: schema.contasAcesso,
    })
    .from(schema.membros)
    .innerJoin(schema.contasAcesso, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(eq(schema.contasAcesso.id, contaAcessoId))
    .limit(1)

  if (!identidade || identidade.membro.id !== membroId) {
    return c.json({ error: 'Membro não encontrado' }, 404)
  }

  const { membro, conta } = identidade
  const capacidades = await obterCapacidadesMembro(db, membroId)

  return c.json(
    {
      id: membro.id,
      nome: membro.nome,
      casaId: membro.casaId,
      ativo: membro.ativo,
      autenticacaoAtiva: conta.status === 'ATIVA',
      ativadoEm: conta.ativadoEm,
      conta: {
        id: conta.id,
        status: conta.status,
      },
      capacidades,
    },
    200
  )
})

meApp.get('/vinculos', async c => {
  const contextoPermissoes = c.get('contextoPermissoes')
  return c.json(contextoPermissoes, 200)
})
