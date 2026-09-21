import { Hono } from 'hono'
import { and, count, eq, isNull } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { executeAtomic } from '../../db/batch'
import { authMiddleware, Variables } from '../../middleware/auth'
import type { AcessoTecnico, ContextoPermissoes } from '../../security/permissoes'

const PERFIS = new Set([
  'MASTER_SISTEMA',
  'ADMINISTRADOR_SISTEMA',
  'GESTOR_AGENDA',
  'OPERADOR_PORTARIA_PERMANENTE',
  'GESTOR_RELATORIOS',
  'AUDITOR',
  'USUARIO_COMUM',
])

const ESCOPOS = new Set([
  'GLOBAL',
  'REGIONAL',
  'ADMINISTRACAO',
  'SETOR',
  'CASA',
  'GRUPO_TRABALHO',
])

type EscopoTipo = AcessoTecnico['escopoTipo']

export const adminAcessosApp = new Hono<{ Variables: Variables }>()

adminAcessosApp.use('*', authMiddleware)

function eMaster(contexto: ContextoPermissoes): boolean {
  return contexto.acessosAtivos.some(
    acesso =>
      acesso.perfilCodigo === 'MASTER_SISTEMA' &&
      acesso.escopoTipo === 'GLOBAL' &&
      acesso.escopoId === null
  )
}

function regionaisAdministradas(contexto: ContextoPermissoes): Set<string> {
  return new Set(
    contexto.acessosAtivos
      .filter(
        acesso =>
          acesso.perfilCodigo === 'ADMINISTRADOR_SISTEMA' &&
          acesso.escopoTipo === 'REGIONAL' &&
          acesso.escopoId
      )
      .map(acesso => acesso.escopoId as string)
  )
}

async function regionalDoEscopo(
  db: any,
  escopoTipo: EscopoTipo,
  escopoId: string | null
): Promise<string | null> {
  if (escopoTipo === 'GLOBAL') return null
  if (!escopoId) return null
  if (escopoTipo === 'REGIONAL') {
    const regional = await db
      .select({ id: schema.regionais.id })
      .from(schema.regionais)
      .where(eq(schema.regionais.id, escopoId))
      .get()
    return regional?.id ?? null
  }
  if (escopoTipo === 'ADMINISTRACAO') {
    const item = await db
      .select({ regionalId: schema.administracoes.regionalId })
      .from(schema.administracoes)
      .where(eq(schema.administracoes.id, escopoId))
      .get()
    return item?.regionalId ?? null
  }
  if (escopoTipo === 'SETOR') {
    const item = await db
      .select({ regionalId: schema.administracoes.regionalId })
      .from(schema.setores)
      .innerJoin(
        schema.administracoes,
        eq(schema.setores.administracaoId, schema.administracoes.id)
      )
      .where(eq(schema.setores.id, escopoId))
      .get()
    return item?.regionalId ?? null
  }
  if (escopoTipo === 'CASA') {
    const item = await db
      .select({ regionalId: schema.administracoes.regionalId })
      .from(schema.casas)
      .innerJoin(schema.setores, eq(schema.casas.setorId, schema.setores.id))
      .innerJoin(
        schema.administracoes,
        eq(schema.setores.administracaoId, schema.administracoes.id)
      )
      .where(eq(schema.casas.id, escopoId))
      .get()
    return item?.regionalId ?? null
  }

  const gt = await db
    .select({
      regionalId: schema.gruposTrabalho.regionalId,
      regionalDaAdministracao: schema.administracoes.regionalId,
    })
    .from(schema.gruposTrabalho)
    .leftJoin(
      schema.administracoes,
      eq(schema.gruposTrabalho.administracaoId, schema.administracoes.id)
    )
    .where(eq(schema.gruposTrabalho.id, escopoId))
    .get()

  if (gt?.regionalId) return gt.regionalId
  if (gt?.regionalDaAdministracao) return gt.regionalDaAdministracao

  const gtSetor = await db
    .select({ regionalId: schema.administracoes.regionalId })
    .from(schema.gruposTrabalho)
    .innerJoin(schema.setores, eq(schema.gruposTrabalho.setorId, schema.setores.id))
    .innerJoin(
      schema.administracoes,
      eq(schema.setores.administracaoId, schema.administracoes.id)
    )
    .where(eq(schema.gruposTrabalho.id, escopoId))
    .get()

  return gtSetor?.regionalId ?? null
}

async function podeAdministrarAcesso(
  db: any,
  contexto: ContextoPermissoes,
  perfilCodigo: string,
  escopoTipo: EscopoTipo,
  escopoId: string | null
): Promise<boolean> {
  if (eMaster(contexto)) return true
  if (perfilCodigo === 'MASTER_SISTEMA' || escopoTipo === 'GLOBAL') return false

  const regionalId = await regionalDoEscopo(db, escopoTipo, escopoId)
  return Boolean(regionalId && regionaisAdministradas(contexto).has(regionalId))
}

adminAcessosApp.post('/', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const atorContaAcessoId = c.get('contaAcessoId')
  const atorMembroId = c.get('membroId')

  let body: {
    contaAcessoId?: string
    perfilCodigo?: string
    escopoTipo?: EscopoTipo
    escopoId?: string | null
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  if (
    !body.contaAcessoId ||
    !body.perfilCodigo ||
    !PERFIS.has(body.perfilCodigo) ||
    !body.escopoTipo ||
    !ESCOPOS.has(body.escopoTipo)
  ) {
    return c.json({ error: 'Perfil ou escopo inválido', code: 'VALIDATION_ERROR' }, 400)
  }

  const escopoId = body.escopoTipo === 'GLOBAL' ? null : body.escopoId ?? null
  const regionalId = await regionalDoEscopo(db, body.escopoTipo, escopoId)
  if (body.escopoTipo !== 'GLOBAL' && !regionalId) {
    return c.json({ error: 'Escopo institucional não encontrado', code: 'ESCOPO_INVALIDO' }, 400)
  }

  if (
    !(await podeAdministrarAcesso(
      db,
      contexto,
      body.perfilCodigo,
      body.escopoTipo,
      escopoId
    ))
  ) {
    return c.json({ error: 'Acesso não autorizado para o escopo', code: 'FORBIDDEN' }, 403)
  }

  const conta = await db
    .select({ id: schema.contasAcesso.id, status: schema.contasAcesso.status })
    .from(schema.contasAcesso)
    .where(eq(schema.contasAcesso.id, body.contaAcessoId))
    .get()

  if (!conta || conta.status === 'DESATIVADA') {
    return c.json({ error: 'Conta de acesso indisponível', code: 'CONTA_INDISPONIVEL' }, 409)
  }

  const existente = await db
    .select({ id: schema.acessosConta.id })
    .from(schema.acessosConta)
    .where(
      and(
        eq(schema.acessosConta.contaAcessoId, conta.id),
        eq(schema.acessosConta.perfilCodigo, body.perfilCodigo),
        eq(schema.acessosConta.escopoTipo, body.escopoTipo),
        escopoId === null
          ? isNull(schema.acessosConta.escopoId)
          : eq(schema.acessosConta.escopoId, escopoId),
        eq(schema.acessosConta.ativo, true)
      )
    )
    .get()

  if (existente) {
    return c.json({ error: 'Acesso já atribuído', code: 'ACESSO_DUPLICADO' }, 409)
  }

  const acessoId = crypto.randomUUID()
  const agora = new Date().toISOString()

  try {
    await executeAtomic(db, tx => [
      tx.insert(schema.acessosConta).values({
        id: acessoId,
        contaAcessoId: conta.id,
        perfilCodigo: body.perfilCodigo,
        escopoTipo: body.escopoTipo,
        escopoId,
        concedidoPorContaId: atorContaAcessoId,
        createdAt: agora,
        updatedAt: agora,
      }),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'ACESSO_CONCEDIDO',
        atorMembroId,
        atorContaAcessoId,
        recursoTipo: 'ACESSO_CONTA',
        recursoId: acessoId,
        escopoTipo: body.escopoTipo,
        escopoId,
        contexto: JSON.stringify({
          contaAcessoId: conta.id,
          perfilCodigo: body.perfilCodigo,
        }),
        criadoEm: agora,
      }),
    ])
  } catch {
    return c.json({ error: 'Acesso incompatível ou duplicado', code: 'ACESSO_INVALIDO' }, 409)
  }

  return c.json(
    {
      id: acessoId,
      contaAcessoId: conta.id,
      perfilCodigo: body.perfilCodigo,
      escopoTipo: body.escopoTipo,
      escopoId,
      ativo: true,
    },
    201
  )
})

adminAcessosApp.delete('/:id', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const atorContaAcessoId = c.get('contaAcessoId')
  const atorMembroId = c.get('membroId')
  const acessoId = c.req.param('id')

  const acesso = await db
    .select()
    .from(schema.acessosConta)
    .where(
      and(
        eq(schema.acessosConta.id, acessoId),
        eq(schema.acessosConta.ativo, true)
      )
    )
    .get()

  if (!acesso) {
    return c.json({ error: 'Acesso não encontrado', code: 'NOT_FOUND' }, 404)
  }

  if (
    !(await podeAdministrarAcesso(
      db,
      contexto,
      acesso.perfilCodigo,
      acesso.escopoTipo as EscopoTipo,
      acesso.escopoId
    ))
  ) {
    return c.json({ error: 'Acesso não autorizado para o escopo', code: 'FORBIDDEN' }, 403)
  }

  if (acesso.perfilCodigo === 'MASTER_SISTEMA') {
    const total = await db
      .select({ total: count() })
      .from(schema.acessosConta)
      .where(
        and(
          eq(schema.acessosConta.perfilCodigo, 'MASTER_SISTEMA'),
          eq(schema.acessosConta.ativo, true)
        )
      )
      .get()

    if (!total || total.total <= 1) {
      return c.json({ error: 'O último Master ativo não pode ser revogado', code: 'ULTIMO_MASTER' }, 409)
    }
  }

  const agora = new Date().toISOString()
  await executeAtomic(db, tx => [
    tx
      .update(schema.acessosConta)
      .set({
        ativo: false,
        revogadoEm: agora,
        revogadoPorContaId: atorContaAcessoId,
        updatedAt: agora,
      })
      .where(eq(schema.acessosConta.id, acesso.id)),
    tx.insert(schema.auditoriaLogs).values({
      id: crypto.randomUUID(),
      acao: 'ACESSO_REVOGADO',
      atorMembroId,
      atorContaAcessoId,
      recursoTipo: 'ACESSO_CONTA',
      recursoId: acesso.id,
      escopoTipo: acesso.escopoTipo,
      escopoId: acesso.escopoId,
      contexto: JSON.stringify({
        contaAcessoId: acesso.contaAcessoId,
        perfilCodigo: acesso.perfilCodigo,
      }),
      criadoEm: agora,
    }),
  ])

  return c.json({ message: 'Acesso revogado', id: acesso.id }, 200)
})
