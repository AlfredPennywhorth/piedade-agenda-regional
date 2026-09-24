import { Hono } from 'hono'
import { and, eq, inArray } from 'drizzle-orm'
import { gruposTrabalho, participacoesGruposTrabalho, setores, administracoes } from '../db/schema'
import { CreateGrupoTrabalhoSchema, UpdateGrupoTrabalhoSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { exigirMasterParaEscrita } from '../middleware/master-write'
import { obterEscoposTerritoriaisVisiveis } from '../security/permissoes'

export const gruposTrabalhoRouter = new Hono<any>()

gruposTrabalhoRouter.use('*', authMiddleware)
gruposTrabalhoRouter.use('*', exigirMasterParaEscrita)

gruposTrabalhoRouter.get('/', async (c) => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)

  if (visiveis.tudo) {
    return c.json(await db.select().from(gruposTrabalho).all())
  }

  const ids = Array.from(visiveis.gruposTrabalhoIds)
  if (ids.length === 0) return c.json([])

  const data = await db.select().from(gruposTrabalho).where(inArray(gruposTrabalho.id, ids)).all()
  return c.json(data)
})

gruposTrabalhoRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(gruposTrabalho).where(eq(gruposTrabalho.id, id)).get()
  
  if (!data) return c.json({ error: 'Grupo de Trabalho não encontrado' }, 404)

  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)
  if (!visiveis.tudo && !visiveis.gruposTrabalhoIds.has(id)) {
    return c.json({ error: 'Acesso não autorizado para este escopo', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

gruposTrabalhoRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateGrupoTrabalhoSchema.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(gruposTrabalho).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'A Regional vinculada não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed: check_escopo_unico')) {
      return c.json({ error: 'O banco de dados rejeitou o escopo do GT. O GT deve ser Regional.' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

gruposTrabalhoRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateGrupoTrabalhoSchema.parse(body)
    
    const existing = await db.select().from(gruposTrabalho).where(eq(gruposTrabalho.id, id)).get()
    if (!existing) return c.json({ error: 'Grupo de Trabalho não encontrado' }, 404)

    const finalRegionalId = parsed.regionalId !== undefined ? parsed.regionalId : existing.regionalId
    if (!finalRegionalId) {
      return c.json({ error: 'Grupo de Trabalho deve pertencer a uma Regional.' }, 400)
    }

    const participacoes = await db
      .select({ regionalId: administracoes.regionalId })
      .from(participacoesGruposTrabalho)
      .innerJoin(setores, eq(setores.id, participacoesGruposTrabalho.setorRepresentadoId))
      .innerJoin(administracoes, eq(administracoes.id, setores.administracaoId))
      .where(
        and(
          eq(participacoesGruposTrabalho.grupoTrabalhoId, id),
          eq(participacoesGruposTrabalho.ativo, true)
        )
      )
      .all()

    if (participacoes.some((item: any) => item.regionalId !== finalRegionalId)) {
      return c.json({
        error: 'A Regional informada conflita com Setores já representados neste GT.',
        code: 'GT_PARTICIPACOES_INCOMPATIVEIS',
      }, 409)
    }

    const updated = await db.update(gruposTrabalho)
      .set({
        ...parsed,
        regionalId: finalRegionalId,
        administracaoId: null,
        setorId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(gruposTrabalho.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'O escopo vinculado (Regional/Administração/Setor) não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed: check_escopo_unico')) {
      return c.json({ error: 'O banco de dados rejeitou os escopos. Deve existir exatamente 1 escopo.' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
