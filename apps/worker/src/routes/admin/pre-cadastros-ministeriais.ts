import { Hono } from 'hono'
import { and, eq, inArray, like, sql } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { CreateMembroSchema } from '@piedade/shared'
import { executeAtomic } from '../../db/batch'
import { authMiddleware, Variables } from '../../middleware/auth'
import {
  eMasterSistema,
  regionaisAdministradas,
  obterRegionalDoEscopo,
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


adminPreCadastrosMinisteriaisApp.post('/:id/finalizar', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const atorMembroId = c.get('membroId')
  const atorContaAcessoId = c.get('contaAcessoId')
  const preCadastroId = c.req.param('id')

  if (!db || !contexto) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const master = eMasterSistema(contexto)
  const regionaisDoAdmin = regionaisAdministradas(contexto)
  if (!master && regionaisDoAdmin.size === 0) {
    return c.json(
      { error: 'Acesso não autorizado ao pré-cadastro ministerial', code: 'FORBIDDEN' },
      403
    )
  }

  const preCadastro = await db
    .select()
    .from(schema.preCadastrosMinisteriais)
    .where(
      and(
        eq(schema.preCadastrosMinisteriais.id, preCadastroId),
        eq(schema.preCadastrosMinisteriais.ativo, true)
      )
    )
    .get()

  if (!preCadastro) {
    return c.json({ error: 'Pré-cadastro não encontrado', code: 'NOT_FOUND' }, 404)
  }

  if (!preCadastro.regionalId) {
    return c.json(
      { error: 'Pré-cadastro sem Regional conciliada', code: 'PRE_CADASTRO_INCOMPLETO' },
      409
    )
  }

  if (!master && !regionaisDoAdmin.has(preCadastro.regionalId)) {
    return c.json(
      { error: 'Acesso não autorizado para a Regional do pré-cadastro', code: 'FORBIDDEN' },
      403
    )
  }

  if (preCadastro.membroId) {
    return c.json(
      { error: 'Pré-cadastro já vinculado a um membro', code: 'PRE_CADASTRO_JA_VINCULADO' },
      409
    )
  }

  let body: {
    codigoCarteirinha?: string
    celular?: string | null
    casaId?: string
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  if (!body.celular?.trim()) {
    return c.json(
      { error: 'Celular é obrigatório para finalizar o cadastro', code: 'VALIDATION_ERROR' },
      400
    )
  }

  const casaId = body.casaId?.trim() || preCadastro.casaId
  if (!casaId) {
    return c.json(
      { error: 'Casa de Oração precisa ser confirmada', code: 'CASA_NAO_CONCILIADA' },
      409
    )
  }

  if (!preCadastro.dataOrdenacao) {
    return c.json(
      { error: 'Data de ordenação ausente no pré-cadastro', code: 'PRE_CADASTRO_INCOMPLETO' },
      409
    )
  }

  const regionalDaCasa = await obterRegionalDoEscopo(db, 'CASA', casaId)
  if (!regionalDaCasa) {
    return c.json({ error: 'Casa de Oração não encontrada', code: 'CASA_INVALIDA' }, 400)
  }
  if (regionalDaCasa !== preCadastro.regionalId) {
    return c.json(
      { error: 'Casa de Oração pertence a outra Regional', code: 'REGIONAL_DIVERGENTE' },
      409
    )
  }

  const parsed = CreateMembroSchema.safeParse({
    nome: preCadastro.nome,
    dataOrdenacao: preCadastro.dataOrdenacao,
    codigoCarteirinha: body.codigoCarteirinha,
    celular: body.celular,
    casaId,
    ativo: true,
  })

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues, code: 'VALIDATION_ERROR' }, 400)
  }

  const conflitoCarteirinha = await db
    .select({ id: schema.membros.id })
    .from(schema.membros)
    .where(eq(schema.membros.codigoCarteirinha, parsed.data.codigoCarteirinha))
    .get()

  if (conflitoCarteirinha) {
    return c.json(
      { error: 'Código da carteirinha já vinculado', code: 'CARTEIRINHA_JA_VINCULADA' },
      409
    )
  }

  if (parsed.data.celular) {
    const conflitoCelular = await db
      .select({ id: schema.membros.id })
      .from(schema.membros)
      .where(eq(schema.membros.celular, parsed.data.celular))
      .get()

    if (conflitoCelular) {
      return c.json(
        { error: 'Celular já vinculado a outro membro', code: 'CELULAR_JA_VINCULADO' },
        409
      )
    }
  }

  const membroId = crypto.randomUUID()
  const agora = new Date().toISOString()

  try {
    await executeAtomic(db, tx => [
      tx.insert(schema.membros).values({
        id: membroId,
        ...parsed.data,
        createdAt: agora,
        updatedAt: agora,
      }),
      tx
        .update(schema.preCadastrosMinisteriais)
        .set({
          membroId: sql`CASE
            WHEN ${schema.preCadastrosMinisteriais.membroId} IS NULL
            THEN ${membroId}
            ELSE 'PRE_CADASTRO_CONCORRENCIA_ABORT'
          END` as any,
          updatedAt: agora,
        })
        .where(
          and(
            eq(schema.preCadastrosMinisteriais.id, preCadastro.id),
            eq(schema.preCadastrosMinisteriais.ativo, true)
          )
        ),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'PRE_CADASTRO_MINISTERIAL_FINALIZADO',
        atorMembroId,
        atorContaAcessoId,
        recursoTipo: 'MEMBRO',
        recursoId: membroId,
        escopoTipo: 'REGIONAL',
        escopoId: preCadastro.regionalId,
        contexto: JSON.stringify({
          preCadastroMinisterialId: preCadastro.id,
          casaId,
        }),
        criadoEm: agora,
      }),
    ])
  } catch {
    return c.json(
      { error: 'Não foi possível finalizar o pré-cadastro', code: 'FINALIZACAO_FALHOU' },
      409
    )
  }

  return c.json(
    {
      id: membroId,
      nome: parsed.data.nome,
      dataOrdenacao: parsed.data.dataOrdenacao,
      codigoCarteirinha: parsed.data.codigoCarteirinha,
      celular: parsed.data.celular,
      casaId: parsed.data.casaId,
      ativo: true,
      preCadastroMinisterialId: preCadastro.id,
      contaCriada: false,
    },
    201
  )
})
