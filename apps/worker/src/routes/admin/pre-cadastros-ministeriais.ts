import { Hono } from 'hono'
import { and, eq, inArray, like } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { authMiddleware, Variables } from '../../middleware/auth'
import {
  eMasterSistema,
  regionaisAdministradas,
} from '../../security/permissoes'

export const adminPreCadastrosMinisteriaisApp = new Hono<{ Variables: Variables }>()

adminPreCadastrosMinisteriaisApp.use('*', authMiddleware)

adminPreCadastrosMinisteriaisApp.get('/', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const busca = (c.req.query('busca') ?? '').trim()
  const regionalIdSolicitada = c.req.query('regionalId')?.trim() || null
  const limitRaw = Number.parseInt(c.req.query('limit') ?? '20', 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20

  if (!db || !contexto) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  if (busca.length < 2) {
    return c.json(
      { error: 'Informe pelo menos 2 caracteres para pesquisar', code: 'VALIDATION_ERROR' },
      400
    )
  }

  const master = eMasterSistema(contexto)
  const regionaisDoAdmin = regionaisAdministradas(contexto)

  if (!master && regionaisDoAdmin.size === 0) {
    return c.json(
      { error: 'Acesso não autorizado ao pré-cadastro ministerial', code: 'FORBIDDEN' },
      403
    )
  }

  if (
    !master &&
    regionalIdSolicitada &&
    !regionaisDoAdmin.has(regionalIdSolicitada)
  ) {
    return c.json(
      { error: 'Acesso não autorizado para a Regional informada', code: 'FORBIDDEN' },
      403
    )
  }

  const conditions = [
    eq(schema.preCadastrosMinisteriais.ativo, true),
    like(schema.preCadastrosMinisteriais.nome, `%${busca}%`),
  ]

  if (master) {
    if (regionalIdSolicitada) {
      conditions.push(eq(schema.preCadastrosMinisteriais.regionalId, regionalIdSolicitada))
    }
  } else {
    const regionaisIds = regionalIdSolicitada
      ? [regionalIdSolicitada]
      : Array.from(regionaisDoAdmin)

    conditions.push(inArray(schema.preCadastrosMinisteriais.regionalId, regionaisIds))
  }

  const registros = await db
    .select({
      id: schema.preCadastrosMinisteriais.id,
      nome: schema.preCadastrosMinisteriais.nome,
      ministerio: schema.preCadastrosMinisteriais.ministerio,
      rrm: schema.preCadastrosMinisteriais.rrm,
      regionalId: schema.preCadastrosMinisteriais.regionalId,
      administracaoOrigem: schema.preCadastrosMinisteriais.administracaoOrigem,
      localidadeOrigem: schema.preCadastrosMinisteriais.localidadeOrigem,
      codigoCasaReferencia: schema.preCadastrosMinisteriais.codigoCasaReferencia,
      casaId: schema.preCadastrosMinisteriais.casaId,
      dataOrdenacao: schema.preCadastrosMinisteriais.dataOrdenacao,
      statusOrigem: schema.preCadastrosMinisteriais.statusOrigem,
      membroId: schema.preCadastrosMinisteriais.membroId,
    })
    .from(schema.preCadastrosMinisteriais)
    .where(and(...conditions))
    .orderBy(schema.preCadastrosMinisteriais.nome)
    .limit(limit)
    .all()

  return c.json({
    data: registros.map((registro: typeof registros[number]) => ({
      ...registro,
      vinculado: registro.membroId !== null,
    })),
    meta: {
      busca,
      limit,
      totalRetornado: registros.length,
    },
  })
})
