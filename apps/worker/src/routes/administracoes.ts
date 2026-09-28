import { Hono } from 'hono'
import { and, eq, inArray } from 'drizzle-orm'
import { administracoes, setores, participacoesGruposTrabalho, gruposTrabalho } from '../db/schema'
import { CreateAdministracaoSchema, UpdateAdministracaoSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, obterEscoposTerritoriaisVisiveis, podeAdministrarEscopo, regionaisAdministradas } from '../security/permissoes'
import { executarOperacaoComAudit } from '../services/auditoria'

export const administracoesRouter = new Hono<any>()

administracoesRouter.use('*', authMiddleware)
administracoesRouter.use('*', async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    await next()
    return
  }

  const contexto = c.get('contextoPermissoes')
  if (!contexto || (!eMasterSistema(contexto) && regionaisAdministradas(contexto).size === 0)) {
    return c.json({ error: 'Acesso não autorizado para administrar estrutura', code: 'FORBIDDEN' }, 403)
  }

  await next()
})

administracoesRouter.get('/', async (c) => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)

  if (visiveis.tudo) {
    return c.json(await db.select().from(administracoes).all())
  }

  const ids = Array.from(visiveis.administracoesIds)
  if (ids.length === 0) return c.json([])

  const data = await db.select().from(administracoes).where(inArray(administracoes.id, ids)).all()
  return c.json(data)
})

administracoesRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(administracoes).where(eq(administracoes.id, id)).get()
  
  if (!data) return c.json({ error: 'Administração não encontrada' }, 404)

  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)
  if (!visiveis.tudo && !visiveis.administracoesIds.has(id)) {
    return c.json({ error: 'Acesso não autorizado para este escopo', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

administracoesRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateAdministracaoSchema.parse(body)
    
    if (!(await podeAdministrarEscopo(db, c.get('contextoPermissoes'), 'REGIONAL', parsed.regionalId))) {
      return c.json({ error: 'Acesso não autorizado para administrar esta Regional', code: 'FORBIDDEN' }, 403)
    }

    const id = crypto.randomUUID()
    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(administracoes).values({ id, ...parsed })],
      {
        acao: 'ADMINISTRACAO_CRIADA',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'ADMINISTRACAO',
        recursoId: id,
        escopoTipo: 'ADMINISTRACAO',
        escopoId: id,
        contexto: { campos: ['nome', 'codigo', 'ativo', 'regionalId'] },
      }
    )
    const result = await db.select().from(administracoes).where(eq(administracoes.id, id)).get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Regional vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

administracoesRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateAdministracaoSchema.parse(body)
    
    const existing = await db.select().from(administracoes).where(eq(administracoes.id, id)).get()
    if (!existing) return c.json({ error: 'Administração não encontrada' }, 404)

    const contexto = c.get('contextoPermissoes')
    const regionalFinal = parsed.regionalId ?? existing.regionalId
    const [podeAtual, podeFinal] = await Promise.all([
      podeAdministrarEscopo(db, contexto, 'REGIONAL', existing.regionalId),
      podeAdministrarEscopo(db, contexto, 'REGIONAL', regionalFinal),
    ])
    if (!podeAtual || !podeFinal) {
      return c.json({ error: 'Acesso não autorizado para administrar esta Regional', code: 'FORBIDDEN' }, 403)
    }

    if (parsed.regionalId && parsed.regionalId !== existing.regionalId) {
      const participacoes = await db
        .select({ regionalIdGt: gruposTrabalho.regionalId })
        .from(participacoesGruposTrabalho)
        .innerJoin(setores, eq(setores.id, participacoesGruposTrabalho.setorRepresentadoId))
        .innerJoin(gruposTrabalho, eq(gruposTrabalho.id, participacoesGruposTrabalho.grupoTrabalhoId))
        .where(
          and(
            eq(setores.administracaoId, id),
            eq(participacoesGruposTrabalho.ativo, true)
          )
        )
        .all()

      if (participacoes.some((item: any) => item.regionalIdGt !== parsed.regionalId)) {
        return c.json({
          error: 'Não é possível mover a Administração para outra Regional enquanto houver participação em GT incompatível.',
          code: 'GT_PARTICIPACOES_INCOMPATIVEIS',
        }, 409)
      }
    }

    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(administracoes)
          .set({ ...parsed, updatedAt: new Date().toISOString() })
          .where(eq(administracoes.id, id))
      ],
      {
        acao: 'ADMINISTRACAO_ATUALIZADA',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'ADMINISTRACAO',
        recursoId: id,
        escopoTipo: 'ADMINISTRACAO',
        escopoId: id,
        contexto: { camposAlterados: Object.keys(parsed) },
      }
    )
    const updated = await db.select().from(administracoes).where(eq(administracoes.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Regional vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
