import { Hono } from 'hono'
import { and, eq, inArray } from 'drizzle-orm'
import { setores, administracoes, participacoesGruposTrabalho, gruposTrabalho } from '../db/schema'
import { CreateSetorSchema, UpdateSetorSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { exigirMasterParaEscrita } from '../middleware/master-write'
import { obterEscoposTerritoriaisVisiveis } from '../security/permissoes'

export const setoresRouter = new Hono<any>()

setoresRouter.use('*', authMiddleware)
setoresRouter.use('*', exigirMasterParaEscrita)

setoresRouter.get('/', async (c) => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)

  if (visiveis.tudo) {
    return c.json(await db.select().from(setores).all())
  }

  const ids = Array.from(visiveis.setoresIds)
  if (ids.length === 0) return c.json([])

  const data = await db.select().from(setores).where(inArray(setores.id, ids)).all()
  return c.json(data)
})

setoresRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(setores).where(eq(setores.id, id)).get()
  
  if (!data) return c.json({ error: 'Setor não encontrado' }, 404)

  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)
  if (!visiveis.tudo && !visiveis.setoresIds.has(id)) {
    return c.json({ error: 'Acesso não autorizado para este escopo', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

setoresRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateSetorSchema.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(setores).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Administração vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

setoresRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateSetorSchema.parse(body)
    
    const existing = await db.select().from(setores).where(eq(setores.id, id)).get()
    if (!existing) return c.json({ error: 'Setor não encontrado' }, 404)

    if (parsed.administracaoId && parsed.administracaoId !== existing.administracaoId) {
      const destino = await db
        .select({ regionalId: administracoes.regionalId })
        .from(administracoes)
        .where(eq(administracoes.id, parsed.administracaoId))
        .get()

      if (!destino) {
        return c.json({ error: 'Administração vinculada não existe' }, 400)
      }

      const participacoes = await db
        .select({ regionalIdGt: gruposTrabalho.regionalId })
        .from(participacoesGruposTrabalho)
        .innerJoin(gruposTrabalho, eq(gruposTrabalho.id, participacoesGruposTrabalho.grupoTrabalhoId))
        .where(
          and(
            eq(participacoesGruposTrabalho.setorRepresentadoId, id),
            eq(participacoesGruposTrabalho.ativo, true)
          )
        )
        .all()

      if (participacoes.some((item: any) => item.regionalIdGt !== destino.regionalId)) {
        return c.json({
          error: 'Não é possível mover o Setor para outra Regional enquanto houver participação em GT incompatível.',
          code: 'GT_PARTICIPACOES_INCOMPATIVEIS',
        }, 409)
      }
    }

    const updated = await db.update(setores)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(setores.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Administração vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
