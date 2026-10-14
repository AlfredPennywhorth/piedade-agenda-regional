import { Hono } from 'hono'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { espacosLocal, locais, membros, casas, setores } from '../db/schema'
import { EspacoLocalCreate, EspacoLocalUpdate } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, podeGerenciarCadastroTerritorial, obterEscoposTerritoriaisVisiveis } from '../security/permissoes'
import { executarOperacaoComAudit } from '../services/auditoria'
import { espacosDeEventosVisiveis } from '../security/locais-eventos'

async function espacoVisivel(db: any, contexto: any, local: any, visiveisPrecarregados?: Awaited<ReturnType<typeof obterEscoposTerritoriaisVisiveis>>): Promise<boolean> {
  if (!local) return false
  if (local.proprietarioMembroId) return local.proprietarioMembroId === contexto.membroId
  if (eMasterSistema(contexto)) return true
  if (!local.escopoTipo || !local.escopoId) return true
  const visiveis = visiveisPrecarregados ?? await obterEscoposTerritoriaisVisiveis(db, contexto)
  const grupos: Record<string, Set<string>> = {
    REGIONAL: visiveis.regionaisIds, ADMINISTRACAO: visiveis.administracoesIds,
    SETOR: visiveis.setoresIds, CASA: visiveis.casasIds,
    GRUPO_TRABALHO: visiveis.gruposTrabalhoIds,
  }
  return grupos[local.escopoTipo]?.has(local.escopoId) ?? false
}

async function podeCriarEspacoNoLocalDeAutoria(db: any, local: any, membroId: string | null): Promise<boolean> {
  if (!membroId || local.proprietarioMembroId || local.escopoTipo !== 'SETOR' ||
      local.criadorInstitucionalMembroId !== membroId || !local.ativo) return false
  const vinculo = await db.select({ setorId: setores.id })
    .from(membros)
    .innerJoin(casas, eq(membros.casaId, casas.id))
    .innerJoin(setores, eq(casas.setorId, setores.id))
    .where(and(eq(membros.id, membroId), eq(membros.ativo, true), eq(casas.ativo, true), eq(setores.ativo, true)))
    .get()
  return vinculo?.setorId === local.escopoId
}

export const espacosLocaisRouter = new Hono<any>()

espacosLocaisRouter.use('*', authMiddleware)

espacosLocaisRouter.get('/', async c => {
  const db = c.get('db')
  const localId = c.req.query('localId')
  const ativo = c.req.query('ativo')
  const conditions = [or(isNull(espacosLocal.proprietarioMembroId), eq(espacosLocal.proprietarioMembroId, c.get('membroId')))]
  if (localId) conditions.push(eq(espacosLocal.localId, localId))
  if (ativo !== undefined) conditions.push(eq(espacosLocal.ativo, ativo === 'true'))

  const query = db.select().from(espacosLocal)
  const data = conditions.length ? await query.where(and(...conditions)).all() : await query.all()
  data.sort((a: typeof espacosLocal.$inferSelect, b: typeof espacosLocal.$inferSelect) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) || a.id.localeCompare(b.id)
  )
  const contexto = c.get('contextoPermissoes')
  const localIds: string[] = [...new Set<string>(data.map((item: any) => String(item.localId)))]
  const localRows: any[] = []
  for (let inicio = 0; inicio < localIds.length; inicio += 80) {
    localRows.push(...await db.select().from(locais).where(inArray(locais.id, localIds.slice(inicio, inicio + 80))).all())
  }
  const locaisPorId = new Map<string, any>(localRows.map(local => [local.id, local]))
  const visiveis = eMasterSistema(contexto) ? undefined : await obterEscoposTerritoriaisVisiveis(db, contexto)
  const autorizados = await Promise.all(localIds.map(id => espacoVisivel(db, contexto, locaisPorId.get(id), visiveis)))
  const idsPermitidos = new Set(localIds.filter((_: string, i: number) => autorizados[i]))
  const referenciados = autorizados.every(Boolean) ? new Set<string>() : await espacosDeEventosVisiveis(db, contexto, data.filter((item: any) => !idsPermitidos.has(item.localId) && !item.proprietarioMembroId).map((item: any) => item.id))
  return c.json(data.filter((item: any) => idsPermitidos.has(item.localId) || (!item.proprietarioMembroId && referenciados.has(item.id))))
})

espacosLocaisRouter.get('/:id', async c => {
  const db = c.get('db')
  const item = await db.select().from(espacosLocal).where(eq(espacosLocal.id, c.req.param('id'))).get()
  const local = item ? await db.select().from(locais).where(eq(locais.id, item.localId)).get() : null
  if (!item) return c.json({ error: 'Espaço não encontrado' }, 404)
  if (!await espacoVisivel(db, c.get('contextoPermissoes'), local)) {
    const autorizados = item.proprietarioMembroId || local?.proprietarioMembroId ? new Set<string>() : await espacosDeEventosVisiveis(db, c.get('contextoPermissoes'), [item.id])
    if (!autorizados.has(item.id)) return c.json({ error: 'Espaço não encontrado' }, 404)
  }
  return c.json(item)
})

espacosLocaisRouter.post('/particulares', async c => {
  const db = c.get('db')
  const proprietarioMembroId = c.get('membroId')
  if (!proprietarioMembroId) return c.json({ error: 'Sessão não autenticada' }, 401)
  try {
    const parsed = EspacoLocalCreate.parse(await c.req.json())
    const local = await db.select().from(locais).where(and(eq(locais.id, parsed.localId), eq(locais.proprietarioMembroId, proprietarioMembroId))).get()
    if (!local) return c.json({ error: 'Local particular não encontrado' }, 404)
    const id = crypto.randomUUID()
    await executarOperacaoComAudit(db, qdb => [qdb.insert(espacosLocal).values({
      id, ...parsed, proprietarioMembroId,
    })], {
      acao: 'ESPACO_PARTICULAR_CRIADO',
      atorMembroId: proprietarioMembroId, recursoTipo: 'ESPACO_LOCAL', recursoId: id,
      escopoTipo: 'PESSOAL', escopoId: proprietarioMembroId,
      contexto: { localId: parsed.localId },
    })
    return c.json(await db.select().from(espacosLocal).where(eq(espacosLocal.id,id)).get(), 201)
  } catch (err: any) {
    if (String(err.message).includes('UNIQUE constraint')) return c.json({ error: 'Espaço já cadastrado neste local' }, 409)
    return c.json({ error: err.issues || err.message }, 400)
  }
})

espacosLocaisRouter.post('/', async c => {
  const db = c.get('db')
  try {
    const parsed = EspacoLocalCreate.parse(await c.req.json())
    const local = await db.select().from(locais).where(eq(locais.id, parsed.localId)).get()
    if (!local || local.proprietarioMembroId) return c.json({ error: 'Local institucional não encontrado' }, 404)
    if (!local.escopoTipo || !local.escopoId) {
      if (!eMasterSistema(c.get('contextoPermissoes'))) return c.json({ error: 'Somente o Master administra espaços de locais legados', code: 'FORBIDDEN' }, 403)
    } else if (!await podeGerenciarCadastroTerritorial(db, c.get('contextoPermissoes'), local.escopoTipo, local.escopoId) &&
      !await podeCriarEspacoNoLocalDeAutoria(db, local, c.get('membroId'))) {
      return c.json({ error: 'Sem permissão para criar espaços neste local', code: 'FORBIDDEN' }, 403)
    }
    const id = crypto.randomUUID()
    await executarOperacaoComAudit(
      db,
      qdb => [qdb.insert(espacosLocal).values({ id, ...parsed })],
      {
        acao: 'ESPACO_LOCAL_CRIADO',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'ESPACO_LOCAL',
        recursoId: id,
        escopoTipo: local.escopoTipo ?? 'GLOBAL',
        escopoId: local.escopoId ?? null,
        contexto: { localId: parsed.localId, nome: parsed.nome },
      }
    )
    return c.json(await db.select().from(espacosLocal).where(eq(espacosLocal.id, id)).get(), 201)
  } catch (err: any) {
    if (err.message?.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local vinculado não existe' }, 400)
    }
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Já existe um espaço ativo com este nome neste Local' }, 409)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

espacosLocaisRouter.patch('/:id', async c => {
  const db = c.get('db')
  try {
    const id = c.req.param('id')
    const existing = await db.select().from(espacosLocal).where(eq(espacosLocal.id, id)).get()
    if (!existing || existing.proprietarioMembroId) return c.json({ error: 'Espaço institucional não encontrado' }, 404)
    const local = await db.select().from(locais).where(eq(locais.id, existing.localId)).get()
    if (!local || local.proprietarioMembroId) return c.json({ error: 'Local institucional não encontrado' }, 404)
    if (!local.escopoTipo || !local.escopoId) {
      if (!eMasterSistema(c.get('contextoPermissoes'))) return c.json({ error: 'Somente o Master administra espaços de locais legados', code: 'FORBIDDEN' }, 403)
    } else if (!await podeGerenciarCadastroTerritorial(db, c.get('contextoPermissoes'), local.escopoTipo, local.escopoId)) {
      return c.json({ error: 'Sem permissão para alterar este espaço', code: 'FORBIDDEN' }, 403)
    }
    const parsed = EspacoLocalUpdate.parse(await c.req.json())
    if (parsed.localId && parsed.localId !== existing.localId) {
      return c.json(
        { error: 'O Local de um Espaço não pode ser alterado. Cadastre um novo Espaço no Local correto.', code: 'ESPACO_LOCAL_IMUTAVEL' },
        409
      )
    }
    await executarOperacaoComAudit(
      db,
      qdb => [
        qdb.update(espacosLocal)
          .set({ ...parsed, updatedAt: new Date().toISOString() })
          .where(eq(espacosLocal.id, id))
      ],
      {
        acao: 'ESPACO_LOCAL_ATUALIZADO',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'ESPACO_LOCAL',
        recursoId: id,
        escopoTipo: local.escopoTipo ?? 'GLOBAL',
        escopoId: local.escopoId ?? null,
        contexto: { localId: parsed.localId ?? existing.localId, camposAlterados: Object.keys(parsed) },
      }
    )
    return c.json(await db.select().from(espacosLocal).where(eq(espacosLocal.id, id)).get())
  } catch (err: any) {
    if (err.message?.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local vinculado não existe' }, 400)
    }
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Já existe um espaço ativo com este nome neste Local' }, 409)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
