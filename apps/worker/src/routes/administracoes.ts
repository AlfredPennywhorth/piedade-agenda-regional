import { Hono } from 'hono'
import { and, eq, inArray } from 'drizzle-orm'
import { administracoes, setores, participacoesGruposTrabalho, gruposTrabalho } from '../db/schema'
import { CreateAdministracaoSchema, UpdateAdministracaoSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { exigirMasterParaEscrita } from '../middleware/master-write'
import { obterEscoposTerritoriaisVisiveis } from '../security/permissoes'

export const administracoesRouter = new Hono<any>()

administracoesRouter.use('*', authMiddleware)
administracoesRouter.use('*', exigirMasterParaEscrita)

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
    
    const id = crypto.randomUUID()
    const result = await db.insert(administracoes).values({ id, ...parsed }).returning().get()
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

    const updated = await db.update(administracoes)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(administracoes.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Regional vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
