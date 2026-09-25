import { Hono } from 'hono'
import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { executeAtomic } from '../../db/batch'
import { gerarTokenAleatorio, hashToken } from '../../security/tokens'
import { authMiddleware, Variables } from '../../middleware/auth'
import {
  eMasterSistema,
  obterRegionalDoEscopo,
  regionaisAdministradas,
  regionaisGeridasNaAgenda,
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
  if (!regionalId) return false

  if (regionaisAdministradas(contexto).has(regionalId)) return true

  // Regra da Agenda: somente o GESTOR_AGENDA em escopo REGIONAL pode
  // conceder/revogar permissões GESTOR_AGENDA dentro da própria Regional.
  if (perfilCodigo === 'GESTOR_AGENDA') {
    return regionaisGeridasNaAgenda(contexto).has(regionalId)
  }

  return false
}

async function regionalDoMembro(db: any, membroId: string): Promise<string | null> {
  const item = await db
    .select({ regionalId: schema.administracoes.regionalId })
    .from(schema.membros)
    .innerJoin(schema.casas, eq(schema.membros.casaId, schema.casas.id))
    .innerJoin(schema.setores, eq(schema.casas.setorId, schema.setores.id))
    .innerJoin(schema.administracoes, eq(schema.setores.administracaoId, schema.administracoes.id))
    .where(eq(schema.membros.id, membroId))
    .get()

  return item?.regionalId ?? null
}

async function membroPossuiMasterAtivo(db: any, membroId: string): Promise<boolean> {
  const acesso = await db
    .select({ id: schema.acessosConta.id })
    .from(schema.acessosConta)
    .innerJoin(schema.contasAcesso, eq(schema.acessosConta.contaAcessoId, schema.contasAcesso.id))
    .where(
      and(
        eq(schema.contasAcesso.membroId, membroId),
        eq(schema.acessosConta.perfilCodigo, 'MASTER_SISTEMA'),
        eq(schema.acessosConta.ativo, true)
      )
    )
    .get()

  return Boolean(acesso)
}

async function podeAdministrarMembro(
  db: any,
  contexto: ContextoPermissoes,
  membroId: string
): Promise<boolean> {
  if (eMasterSistema(contexto)) return true
  if (await membroPossuiMasterAtivo(db, membroId)) return false

  const regionalId = await regionalDoMembro(db, membroId)
  return Boolean(regionalId && regionaisAdministradas(contexto).has(regionalId))
}

async function regionalDaConta(db: any, contaAcessoId: string): Promise<string | null> {
  const conta = await db
    .select({ membroId: schema.contasAcesso.membroId })
    .from(schema.contasAcesso)
    .where(eq(schema.contasAcesso.id, contaAcessoId))
    .get()

  return conta ? regionalDoMembro(db, conta.membroId) : null
}

async function eUltimoMasterOperacional(db: any, contaAcessoId: string): Promise<boolean> {
  const acessoMaster = await db
    .select({ id: schema.acessosConta.id })
    .from(schema.acessosConta)
    .where(
      and(
        eq(schema.acessosConta.contaAcessoId, contaAcessoId),
        eq(schema.acessosConta.perfilCodigo, 'MASTER_SISTEMA'),
        eq(schema.acessosConta.ativo, true)
      )
    )
    .get()

  if (!acessoMaster) return false

  const mestres = await db
    .select({ contaAcessoId: schema.acessosConta.contaAcessoId })
    .from(schema.acessosConta)
    .innerJoin(schema.contasAcesso, eq(schema.acessosConta.contaAcessoId, schema.contasAcesso.id))
    .where(
      and(
        eq(schema.acessosConta.perfilCodigo, 'MASTER_SISTEMA'),
        eq(schema.acessosConta.ativo, true),
        eq(schema.contasAcesso.status, 'ATIVA')
      )
    )
    .all()

  return mestres.length <= 1
}

adminAcessosApp.get('/', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const master = eMasterSistema(contexto)
  const regionaisPermitidas = regionaisAdministradas(contexto)

  if (!master && regionaisPermitidas.size === 0) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const regionaisPermitidasIds = Array.from(regionaisPermitidas)
  const filtroRegional = master
    ? undefined
    : inArray(schema.administracoes.regionalId, regionaisPermitidasIds)

  const pessoas = await db
    .select({
      membroId: schema.membros.id,
      nome: schema.membros.nome,
      celular: schema.membros.celular,
      codigoCarteirinha: schema.membros.codigoCarteirinha,
      dataOrdenacao: schema.membros.dataOrdenacao,
      casaId: schema.membros.casaId,
      regionalId: schema.administracoes.regionalId,
      contaAcessoId: schema.contasAcesso.id,
      status: schema.contasAcesso.status,
      ativadoEm: schema.contasAcesso.ativadoEm,
    })
    .from(schema.membros)
    .innerJoin(schema.casas, eq(schema.membros.casaId, schema.casas.id))
    .innerJoin(schema.setores, eq(schema.casas.setorId, schema.setores.id))
    .innerJoin(schema.administracoes, eq(schema.setores.administracaoId, schema.administracoes.id))
    .leftJoin(schema.contasAcesso, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(and(eq(schema.membros.ativo, true), filtroRegional))
    .all()

  const visiveis = pessoas
  const acessos = await db
    .select({
      id: schema.acessosConta.id,
      contaAcessoId: schema.acessosConta.contaAcessoId,
      perfilCodigo: schema.acessosConta.perfilCodigo,
      escopoTipo: schema.acessosConta.escopoTipo,
      escopoId: schema.acessosConta.escopoId,
      regionalId: schema.administracoes.regionalId,
    })
    .from(schema.acessosConta)
    .innerJoin(schema.contasAcesso, eq(schema.acessosConta.contaAcessoId, schema.contasAcesso.id))
    .innerJoin(schema.membros, eq(schema.contasAcesso.membroId, schema.membros.id))
    .innerJoin(schema.casas, eq(schema.membros.casaId, schema.casas.id))
    .innerJoin(schema.setores, eq(schema.casas.setorId, schema.setores.id))
    .innerJoin(schema.administracoes, eq(schema.setores.administracaoId, schema.administracoes.id))
    .where(
      and(
        eq(schema.acessosConta.ativo, true),
        eq(schema.membros.ativo, true),
        filtroRegional
      )
    )
    .all()

  const acessosVisiveis = acessos

  const recuperacoes = await db
    .select({
      membroId: schema.tentativasAcesso.membroId,
      tipo: schema.tentativasAcesso.tipo,
      createdAt: schema.tentativasAcesso.createdAt,
    })
    .from(schema.tentativasAcesso)
    .innerJoin(schema.membros, eq(schema.tentativasAcesso.membroId, schema.membros.id))
    .innerJoin(schema.casas, eq(schema.membros.casaId, schema.casas.id))
    .innerJoin(schema.setores, eq(schema.casas.setorId, schema.setores.id))
    .innerJoin(schema.administracoes, eq(schema.setores.administracaoId, schema.administracoes.id))
    .where(
      and(
        eq(schema.membros.ativo, true),
        inArray(schema.tentativasAcesso.tipo, [
          'RECUPERACAO_PIN_SOLICITADA',
          'RECUPERACAO_ADMIN',
        ]),
        filtroRegional
      )
    )
    .all()

  const recuperacaoPorMembro = new Map<
    string,
    { solicitadaEm: string | null; tratadaEm: string | null }
  >()
  for (const item of recuperacoes) {
    if (!item.membroId) continue
    const atual = recuperacaoPorMembro.get(item.membroId) ?? {
      solicitadaEm: null,
      tratadaEm: null,
    }
    if (
      item.tipo === 'RECUPERACAO_PIN_SOLICITADA' &&
      (!atual.solicitadaEm || item.createdAt > atual.solicitadaEm)
    ) {
      atual.solicitadaEm = item.createdAt
    }
    if (
      item.tipo === 'RECUPERACAO_ADMIN' &&
      (!atual.tratadaEm || item.createdAt > atual.tratadaEm)
    ) {
      atual.tratadaEm = item.createdAt
    }
    recuperacaoPorMembro.set(item.membroId, atual)
  }

  const acessosPorConta = new Map<string, typeof acessosVisiveis>()
  for (const acesso of acessosVisiveis) {
    const atuais = acessosPorConta.get(acesso.contaAcessoId) ?? []
    atuais.push(acesso)
    acessosPorConta.set(acesso.contaAcessoId, atuais)
  }

  return c.json(
    visiveis.map((pessoa: any) => {
      const recuperacao = recuperacaoPorMembro.get(pessoa.membroId)
      const recuperacaoPinPendente = Boolean(
        recuperacao?.solicitadaEm &&
        (!recuperacao.tratadaEm || recuperacao.solicitadaEm > recuperacao.tratadaEm)
      )

      return {
        ...pessoa,
        acessos: pessoa.contaAcessoId
          ? acessosPorConta.get(pessoa.contaAcessoId) ?? []
          : [],
        recuperacaoPinPendente,
        recuperacaoPinSolicitadaEm: recuperacaoPinPendente
          ? recuperacao?.solicitadaEm ?? null
          : null,
      }
    }),
    200
  )
})

const VALIDADE_LINK_MS = 7 * 24 * 60 * 60 * 1000

adminAcessosApp.post('/membros/:id/link-ativacao', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const atorContaAcessoId = c.get('contaAcessoId')
  const atorMembroId = c.get('membroId')
  const membroId = c.req.param('id')

  if (!(await podeAdministrarMembro(db, contexto, membroId))) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const membro = await db
    .select({
      id: schema.membros.id,
      ativo: schema.membros.ativo,
      casaId: schema.membros.casaId,
    })
    .from(schema.membros)
    .where(eq(schema.membros.id, membroId))
    .get()
  if (!membro || !membro.ativo) {
    return c.json({ error: 'Membro não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  const contaExistente = await db
    .select()
    .from(schema.contasAcesso)
    .where(eq(schema.contasAcesso.membroId, membroId))
    .get()
  if (contaExistente?.status === 'BLOQUEADA' || contaExistente?.status === 'DESATIVADA') {
    return c.json({ error: 'Conta indisponível para ativação', code: 'CONTA_INDISPONIVEL' }, 409)
  }

  const acessoComumExistente = contaExistente
    ? await db
        .select({ id: schema.acessosConta.id })
        .from(schema.acessosConta)
        .where(
          and(
            eq(schema.acessosConta.contaAcessoId, contaExistente.id),
            eq(schema.acessosConta.perfilCodigo, 'USUARIO_COMUM'),
            eq(schema.acessosConta.ativo, true)
          )
        )
        .get()
    : null

  const agora = new Date()
  const agoraIso = agora.toISOString()
  const contaAcessoId = contaExistente?.id ?? crypto.randomUUID()
  const token = gerarTokenAleatorio()
  const tokenHash = await hashToken(token)
  const expiraEm = new Date(agora.getTime() + VALIDADE_LINK_MS).toISOString()
  const linkId = crypto.randomUUID()
  const regionalId = await regionalDoMembro(db, membroId)

  await executeAtomic(db, tx => {
    const queries = []
    if (!contaExistente) {
      queries.push(tx.insert(schema.contasAcesso).values({
        id: contaAcessoId,
        membroId,
        status: 'PENDENTE_ATIVACAO',
        createdAt: agoraIso,
        updatedAt: agoraIso,
      }))
    }
    if (!acessoComumExistente) {
      queries.push(tx.insert(schema.acessosConta).values({
        id: crypto.randomUUID(),
        contaAcessoId,
        perfilCodigo: 'USUARIO_COMUM',
        escopoTipo: 'CASA',
        escopoId: membro.casaId,
        concedidoPorContaId: atorContaAcessoId,
        createdAt: agoraIso,
        updatedAt: agoraIso,
      }))
    }
    queries.push(
      tx.update(schema.linksAtivacao).set({ revogadoEm: agoraIso, updatedAt: agoraIso }).where(
        and(
          eq(schema.linksAtivacao.contaAcessoId, contaAcessoId),
          isNull(schema.linksAtivacao.utilizadoEm),
          isNull(schema.linksAtivacao.revogadoEm)
        )
      ),
      tx.insert(schema.linksAtivacao).values({
        id: linkId,
        contaAcessoId,
        membroId,
        tokenHash,
        expiraEm,
        createdAt: agoraIso,
        updatedAt: agoraIso,
      }),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'LINK_ATIVACAO_GERADO',
        atorMembroId,
        atorContaAcessoId,
        recursoTipo: 'CONTA_ACESSO',
        recursoId: contaAcessoId,
        escopoTipo: 'REGIONAL',
        escopoId: regionalId,
        contexto: JSON.stringify({ membroId, linkId, expiraEm }),
        criadoEm: agoraIso,
      })
    )
    return queries
  })

  return c.json({ token, expiraEm, membroId }, 201)
})

adminAcessosApp.post('/membros/:id/reset-pin', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const atorContaAcessoId = c.get('contaAcessoId')
  const atorMembroId = c.get('membroId')
  const membroId = c.req.param('id')

  if (!(await podeAdministrarMembro(db, contexto, membroId))) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const conta = await db
    .select()
    .from(schema.contasAcesso)
    .where(eq(schema.contasAcesso.membroId, membroId))
    .get()
  if (!conta) {
    return c.json({ error: 'Conta de acesso não encontrada', code: 'NOT_FOUND' }, 404)
  }
  if (conta.status === 'BLOQUEADA' || conta.status === 'DESATIVADA') {
    return c.json({ error: 'Conta indisponível para redefinição', code: 'CONTA_INDISPONIVEL' }, 409)
  }
  if (await eUltimoMasterOperacional(db, conta.id)) {
    return c.json({ error: 'O último Master operacional não pode ter o PIN redefinido', code: 'ULTIMO_MASTER' }, 409)
  }

  const agora = new Date()
  const agoraIso = agora.toISOString()
  const token = gerarTokenAleatorio()
  const tokenHash = await hashToken(token)
  const expiraEm = new Date(agora.getTime() + VALIDADE_LINK_MS).toISOString()
  const linkId = crypto.randomUUID()
  const regionalId = await regionalDoMembro(db, membroId)

  await executeAtomic(db, tx => [
    tx.update(schema.sessoes).set({ revogadoEm: agoraIso }).where(
      and(eq(schema.sessoes.contaAcessoId, conta.id), isNull(schema.sessoes.revogadoEm))
    ),
    tx.update(schema.linksAtivacao).set({ revogadoEm: agoraIso, updatedAt: agoraIso }).where(
      and(
        eq(schema.linksAtivacao.contaAcessoId, conta.id),
        isNull(schema.linksAtivacao.utilizadoEm),
        isNull(schema.linksAtivacao.revogadoEm)
      )
    ),
    tx.update(schema.contasAcesso).set({
      status: 'PENDENTE_ATIVACAO',
      pinHash: null,
      pinSalt: null,
      tentativasPin: 0,
      bloqueadoAte: null,
      updatedAt: agoraIso,
    }).where(eq(schema.contasAcesso.id, conta.id)),
    tx.insert(schema.linksAtivacao).values({
      id: linkId,
      contaAcessoId: conta.id,
      membroId,
      tokenHash,
      expiraEm,
      createdAt: agoraIso,
      updatedAt: agoraIso,
    }),
    tx.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId,
      tipo: 'RECUPERACAO_ADMIN',
      sucesso: true,
    }),
    tx.insert(schema.auditoriaLogs).values({
      id: crypto.randomUUID(),
      acao: 'PIN_REDEFINICAO_SOLICITADA',
      atorMembroId,
      atorContaAcessoId,
      recursoTipo: 'CONTA_ACESSO',
      recursoId: conta.id,
      escopoTipo: 'REGIONAL',
      escopoId: regionalId,
      contexto: JSON.stringify({ membroId, linkId, expiraEm, sessoesRevogadas: true }),
      criadoEm: agoraIso,
    }),
  ])

  return c.json({ token, expiraEm, membroId }, 200)
})

adminAcessosApp.patch('/membros/:id/status', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const atorContaAcessoId = c.get('contaAcessoId')
  const atorMembroId = c.get('membroId')
  const membroId = c.req.param('id')

  let body: { status?: 'ATIVA' | 'BLOQUEADA' }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  if (body.status !== 'ATIVA' && body.status !== 'BLOQUEADA') {
    return c.json({ error: 'Status inválido', code: 'VALIDATION_ERROR' }, 400)
  }
  if (!(await podeAdministrarMembro(db, contexto, membroId))) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const conta = await db
    .select()
    .from(schema.contasAcesso)
    .where(eq(schema.contasAcesso.membroId, membroId))
    .get()
  if (!conta || conta.status === 'DESATIVADA') {
    return c.json({ error: 'Conta de acesso indisponível', code: 'CONTA_INDISPONIVEL' }, 409)
  }
  if (conta.id === atorContaAcessoId && body.status === 'BLOQUEADA') {
    return c.json({ error: 'Não é permitido bloquear a própria conta', code: 'AUTO_BLOQUEIO' }, 409)
  }
  if (body.status === 'BLOQUEADA' && await eUltimoMasterOperacional(db, conta.id)) {
    return c.json({ error: 'O último Master operacional não pode ser bloqueado', code: 'ULTIMO_MASTER' }, 409)
  }
  if (body.status === 'ATIVA' && (!conta.pinHash || !conta.pinSalt)) {
    return c.json({ error: 'Conta precisa ser ativada por link antes do desbloqueio', code: 'ATIVACAO_NECESSARIA' }, 409)
  }

  const agora = new Date().toISOString()
  const regionalId = await regionalDoMembro(db, membroId)
  const consultas = [
    db.update(schema.contasAcesso).set({
      status: body.status,
      tentativasPin: 0,
      bloqueadoAte: null,
      updatedAt: agora,
    }).where(eq(schema.contasAcesso.id, conta.id)),
    db.insert(schema.auditoriaLogs).values({
      id: crypto.randomUUID(),
      acao: body.status === 'BLOQUEADA' ? 'CONTA_BLOQUEADA' : 'CONTA_DESBLOQUEADA',
      atorMembroId,
      atorContaAcessoId,
      recursoTipo: 'CONTA_ACESSO',
      recursoId: conta.id,
      escopoTipo: 'REGIONAL',
      escopoId: regionalId,
      contexto: JSON.stringify({ membroId, statusAnterior: conta.status, statusNovo: body.status }),
      criadoEm: agora,
    }),
  ]

  if (body.status === 'BLOQUEADA') {
    consultas.splice(
      1,
      0,
      db.update(schema.sessoes).set({ revogadoEm: agora }).where(
        and(eq(schema.sessoes.contaAcessoId, conta.id), isNull(schema.sessoes.revogadoEm))
      )
    )
  }

  await executeAtomic(db, () => consultas)
  return c.json({ membroId, contaAcessoId: conta.id, status: body.status }, 200)
})

adminAcessosApp.post('/membros/:id/revogar-sessoes', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const atorContaAcessoId = c.get('contaAcessoId')
  const atorMembroId = c.get('membroId')
  const membroId = c.req.param('id')

  if (!(await podeAdministrarMembro(db, contexto, membroId))) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const conta = await db
    .select({ id: schema.contasAcesso.id })
    .from(schema.contasAcesso)
    .where(eq(schema.contasAcesso.membroId, membroId))
    .get()
  if (!conta) {
    return c.json({ error: 'Conta de acesso não encontrada', code: 'NOT_FOUND' }, 404)
  }

  const agora = new Date().toISOString()
  const regionalId = await regionalDoMembro(db, membroId)
  await executeAtomic(db, tx => [
    tx.update(schema.sessoes).set({ revogadoEm: agora }).where(
      and(eq(schema.sessoes.contaAcessoId, conta.id), isNull(schema.sessoes.revogadoEm))
    ),
    tx.insert(schema.auditoriaLogs).values({
      id: crypto.randomUUID(),
      acao: 'SESSOES_REVOGADAS',
      atorMembroId,
      atorContaAcessoId,
      recursoTipo: 'CONTA_ACESSO',
      recursoId: conta.id,
      escopoTipo: 'REGIONAL',
      escopoId: regionalId,
      contexto: JSON.stringify({ membroId }),
      criadoEm: agora,
    }),
  ])

  return c.json({ message: 'Sessões revogadas', membroId, contaAcessoId: conta.id }, 200)
})

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

  if (!eMasterSistema(contexto)) {
    const regionalAlvo = await regionalDaConta(db, conta.id)
    const administraConta =
      Boolean(regionalAlvo && regionaisAdministradas(contexto).has(regionalAlvo))
    const delegaAgendaNaRegional =
      body.perfilCodigo === 'GESTOR_AGENDA' &&
      Boolean(regionalAlvo && regionaisGeridasNaAgenda(contexto).has(regionalAlvo))

    if (!administraConta && !delegaAgendaNaRegional) {
      return c.json({ error: 'Conta fora do escopo administrativo', code: 'FORBIDDEN' }, 403)
    }
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

  if (acesso.perfilCodigo === 'USUARIO_COMUM') {
    return c.json(
      { error: 'O acesso padrão de Usuário Comum não pode ser revogado', code: 'ACESSO_PADRAO' },
      409
    )
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
