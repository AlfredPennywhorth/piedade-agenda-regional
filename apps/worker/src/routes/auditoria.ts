import { Hono } from 'hono'
import { eq, and, gte, lte, desc, count, inArray, or } from 'drizzle-orm'
import { auditoriaLogs, membros } from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { obterEscoposAutorizadosDoAuditor } from '../security/permissoes'

export const auditoriaRouter = new Hono<{ Variables: Variables }>()

auditoriaRouter.use('*', authMiddleware)

// GET /api/v1/auditoria
auditoriaRouter.get('/', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível' }, 500)
  }

  const escoposAutorizados = await obterEscoposAutorizadosDoAuditor(db, membroId)
  if (!escoposAutorizados) {
    return c.json({ error: 'Acesso não autorizado para consultar a trilha de auditoria' }, 403)
  }

  const autorizacaoConditions = []
  if (escoposAutorizados.regionaisIds.length > 0) {
    autorizacaoConditions.push(and(eq(auditoriaLogs.escopoTipo, 'REGIONAL'), inArray(auditoriaLogs.escopoId, escoposAutorizados.regionaisIds)))
  }
  if (escoposAutorizados.administracoesIds.length > 0) {
    autorizacaoConditions.push(and(eq(auditoriaLogs.escopoTipo, 'ADMINISTRACAO'), inArray(auditoriaLogs.escopoId, escoposAutorizados.administracoesIds)))
  }
  if (escoposAutorizados.setoresIds.length > 0) {
    autorizacaoConditions.push(and(eq(auditoriaLogs.escopoTipo, 'SETOR'), inArray(auditoriaLogs.escopoId, escoposAutorizados.setoresIds)))
  }
  if (escoposAutorizados.casasIds.length > 0) {
    autorizacaoConditions.push(and(eq(auditoriaLogs.escopoTipo, 'CASA'), inArray(auditoriaLogs.escopoId, escoposAutorizados.casasIds)))
  }
  if (escoposAutorizados.gtsIds.length > 0) {
    autorizacaoConditions.push(and(eq(auditoriaLogs.escopoTipo, 'GRUPO_TRABALHO'), inArray(auditoriaLogs.escopoId, escoposAutorizados.gtsIds)))
  }

  if (!escoposAutorizados.global && autorizacaoConditions.length === 0) {
    return c.json({ error: 'Acesso não autorizado para consultar a trilha de auditoria' }, 403)
  }

  const acao = c.req.query('acao')
  const atorMembroId = c.req.query('atorMembroId')
  const recursoTipo = c.req.query('recursoTipo')
  const recursoId = c.req.query('recursoId')
  const escopoTipo = c.req.query('escopoTipo')
  const escopoId = c.req.query('escopoId')
  const dataInicio = c.req.query('dataInicio')
  const dataFim = c.req.query('dataFim')

  if (escopoTipo && escopoId) {
    let escopoPermitido = escoposAutorizados.global
    switch (escopoTipo) {
      case 'GLOBAL': escopoPermitido = escoposAutorizados.global; break
      case 'REGIONAL': escopoPermitido = escoposAutorizados.regionaisIds.includes(escopoId); break
      case 'ADMINISTRACAO': escopoPermitido = escoposAutorizados.administracoesIds.includes(escopoId); break
      case 'SETOR': escopoPermitido = escoposAutorizados.setoresIds.includes(escopoId); break
      case 'CASA': escopoPermitido = escoposAutorizados.casasIds.includes(escopoId); break
      case 'GRUPO_TRABALHO': escopoPermitido = escoposAutorizados.gtsIds.includes(escopoId); break
    }
    if (!escopoPermitido) {
      return c.json({ error: 'Acesso negado para o escopo solicitado' }, 403)
    }
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)))
  const offset = (page - 1) * limit

  const conditions = escoposAutorizados.global ? [] : [or(...autorizacaoConditions)!]

  if (acao) conditions.push(eq(auditoriaLogs.acao, acao))
  if (atorMembroId) conditions.push(eq(auditoriaLogs.atorMembroId, atorMembroId))
  if (recursoTipo) conditions.push(eq(auditoriaLogs.recursoTipo, recursoTipo))
  if (recursoId) conditions.push(eq(auditoriaLogs.recursoId, recursoId))
  if (escopoTipo) conditions.push(eq(auditoriaLogs.escopoTipo, escopoTipo))
  if (escopoId) conditions.push(eq(auditoriaLogs.escopoId, escopoId))
  if (dataInicio) conditions.push(gte(auditoriaLogs.criadoEm, dataInicio))
  if (dataFim) conditions.push(lte(auditoriaLogs.criadoEm, dataFim))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const totalResult = await db.select({ count: count() })
    .from(auditoriaLogs)
    .where(whereClause)
    .get()

  const total = totalResult ? totalResult.count : 0

  const items = await db.select({
    id: auditoriaLogs.id,
    acao: auditoriaLogs.acao,
    atorMembroId: auditoriaLogs.atorMembroId,
    atorNome: membros.nome,
    recursoTipo: auditoriaLogs.recursoTipo,
    recursoId: auditoriaLogs.recursoId,
    escopoTipo: auditoriaLogs.escopoTipo,
    escopoId: auditoriaLogs.escopoId,
    contexto: auditoriaLogs.contexto,
    criadoEm: auditoriaLogs.criadoEm,
  })
  .from(auditoriaLogs)
  .leftJoin(membros, eq(auditoriaLogs.atorMembroId, membros.id))
  .where(whereClause)
  .orderBy(desc(auditoriaLogs.criadoEm))
  .limit(limit)
  .offset(offset)
  .all()

  const pages = Math.ceil(total / limit)

  return c.json({
    items,
    pagination: {
      total,
      page,
      limit,
      pages,
    }
  })
})
