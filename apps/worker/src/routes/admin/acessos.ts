import { Hono } from 'hono'
import { and, count, eq, isNull } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { executeAtomic } from '../../db/batch'
import { authMiddleware, Variables } from '../../middleware/auth'
import {
  eMasterSistema,
  obterRegionalDoEscopo,
  regionaisAdministradas,
  type AcessoTecnico,
  type ContextoPermissoes,
} from '../../security/permissoes'

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

async function podeAdministrarAcesso(
  db: any,
  contexto: ContextoPermissoes,
  perfilCodigo: string,
  escopoTipo: EscopoTipo,
  escopoId: string | null
): Promise<boolean> {
  if (eMasterSistema(contexto)) return true
  if (perfilCodigo === 'MASTER_SISTEMA' || escopoTipo === 'GLOBAL' || !escopoId) return false

  const regionalId = await obterRegionalDoEscopo(
    db,
    escopoTipo as Exclude<EscopoTipo, 'GLOBAL'>,
    escopoId
  )

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
  const regionalId =
    body.escopoTipo === 'GLOBAL' || !escopoId
      ? null
      : await obterRegionalDoEscopo(
          db,
          body.escopoTipo as Exclude<EscopoTipo, 'GLOBAL'>,
          escopoId
        )
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
