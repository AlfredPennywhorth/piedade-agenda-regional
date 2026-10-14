import { Hono } from 'hono'
import { and, eq, isNull, or } from 'drizzle-orm'
import { locais, regionais, administracoes, setores, casas, gruposTrabalho, membros } from '../db/schema'
import { LocalCreate, LocalUpdate } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, podeGerenciarCadastroTerritorial, obterRegionalDoEscopo, obterEscoposTerritoriaisVisiveis } from '../security/permissoes'
import { executarOperacaoComAudit } from '../services/auditoria'
import { locaisDeEventosVisiveis } from '../security/locais-eventos'

async function localVisivel(db: any, contexto: any, local: any, visiveisPrecarregados?: Awaited<ReturnType<typeof obterEscoposTerritoriaisVisiveis>>): Promise<boolean> {
  if (local.proprietarioMembroId) return local.proprietarioMembroId === contexto.membroId
  if (eMasterSistema(contexto)) return true
  // Locais legados continuam na lista compartilhada até classificação pelo Master.
  if (!local.escopoTipo || !local.escopoId) return true
  const visiveis = visiveisPrecarregados ?? await obterEscoposTerritoriaisVisiveis(db, contexto)
  const chaves: Record<string, Set<string>> = {
    REGIONAL: visiveis.regionaisIds,
    ADMINISTRACAO: visiveis.administracoesIds,
    SETOR: visiveis.setoresIds,
    CASA: visiveis.casasIds,
    GRUPO_TRABALHO: visiveis.gruposTrabalhoIds,
  }
  return chaves[local.escopoTipo]?.has(local.escopoId) ?? false
}

// A vinculação ordinária à Casa de Oração permite cadastrar Local no próprio Setor,
// sem conceder permissão administrativa para editar cadastros institucionais.
async function setorDeOrigemAtivo(db: any, membroId: string | null | undefined) {
  if (!membroId) return null
  return db.select({ id: setores.id, nome: setores.nome })
    .from(membros)
    .innerJoin(casas, eq(membros.casaId, casas.id))
    .innerJoin(setores, eq(casas.setorId, setores.id))
    .where(and(eq(membros.id, membroId), eq(membros.ativo, true), eq(casas.ativo, true), eq(setores.ativo, true)))
    .get()
}

export const locaisRouter = new Hono<any>()

locaisRouter.use('*', authMiddleware)

locaisRouter.get('/', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const data = await db.select().from(locais).where(or(isNull(locais.proprietarioMembroId), eq(locais.proprietarioMembroId, membroId))).all()
  const contexto = c.get('contextoPermissoes')
  const visiveis = eMasterSistema(contexto) ? undefined : await obterEscoposTerritoriaisVisiveis(db, contexto)
  const resultados = await Promise.all(data.map((local: any) => localVisivel(db, contexto, local, visiveis)))
  const referenciados = resultados.every(Boolean) ? new Set<string>() : await locaisDeEventosVisiveis(db, contexto, data.filter((local: any, i: number) => !resultados[i] && !local.proprietarioMembroId).map((local: any) => local.id))
  return c.json(data.filter((local: any, i: number) => resultados[i] || (!local.proprietarioMembroId && referenciados.has(local.id))))
})

// Escopos explicitamente atribuídos ao administrador; a API valida novamente na escrita.
locaisRouter.get('/escopos-autorizados', async c => {
  const contexto = c.get('contextoPermissoes')
  const credenciais = contexto.acessosAtivos.filter((acesso: any) =>
    ['ADMINISTRADOR_SISTEMA', 'GESTOR_AGENDA'].includes(acesso.perfilCodigo) &&
    acesso.escopoTipo !== 'GLOBAL' && acesso.escopoId)
  const escopos: Array<{ escopoTipo: string; escopoId: string; nome: string }> = []
  const vistos = new Set<string>()
  const adicionar = (tipo: string, id: string, nome = id) => {
    const chave = tipo + ':' + id
    if (!vistos.has(chave)) { vistos.add(chave); escopos.push({ escopoTipo: tipo, escopoId: id, nome }) }
  }
  if (eMasterSistema(contexto) || credenciais.length) {
    const db = c.get('db')
    const master = eMasterSistema(contexto)
    const regionaisGeridas = new Set<string>(credenciais.filter((a: any) => a.escopoTipo === 'REGIONAL').map((a: any) => a.escopoId))
    const admsGeridas = new Set<string>(credenciais.filter((a: any) => a.escopoTipo === 'ADMINISTRACAO').map((a: any) => a.escopoId))
    const setoresGeridos = new Set<string>(credenciais.filter((a: any) => a.escopoTipo === 'SETOR').map((a: any) => a.escopoId))
    const casasGeridas = new Set<string>(credenciais.filter((a: any) => a.escopoTipo === 'CASA').map((a: any) => a.escopoId))
    const gtsGeridos = new Set<string>(credenciais.filter((a: any) => a.escopoTipo === 'GRUPO_TRABALHO').map((a: any) => a.escopoId))
    const [regionaisRows, admsRows, setoresRows, casasRows, gtsRows] = await Promise.all([
      db.select({ id: regionais.id, nome: regionais.nome }).from(regionais).all(),
      db.select({ id: administracoes.id, nome: administracoes.nome, regionalId: administracoes.regionalId }).from(administracoes).all(),
      db.select({ id: setores.id, nome: setores.nome, administracaoId: setores.administracaoId }).from(setores).all(),
      db.select({ id: casas.id, nome: casas.nome, setorId: casas.setorId }).from(casas).all(),
      db.select({ id: gruposTrabalho.id, nome: gruposTrabalho.nome, regionalId: gruposTrabalho.regionalId, administracaoId: gruposTrabalho.administracaoId, setorId: gruposTrabalho.setorId }).from(gruposTrabalho).all(),
    ])
    const admRegional = new Map<string, string>(admsRows.map((a: any) => [a.id, a.regionalId]))
    const setorAdm = new Map<string, string>(setoresRows.map((a: any) => [a.id, a.administracaoId]))
    const podeAdm = (id: string) => master || admsGeridas.has(id) || regionaisGeridas.has(admRegional.get(id) ?? '')
    const podeSetor = (id: string) => master || setoresGeridos.has(id) || podeAdm(setorAdm.get(id) ?? '')
    regionaisRows.forEach((a: any) => {
      if (master || regionaisGeridas.has(a.id)) adicionar('REGIONAL', a.id, a.nome)
    })
    admsRows.forEach((a: any) => { if (podeAdm(a.id)) adicionar('ADMINISTRACAO', a.id, a.nome) })
    setoresRows.forEach((a: any) => { if (podeSetor(a.id)) adicionar('SETOR', a.id, a.nome) })
    casasRows.forEach((a: any) => { if (master || casasGeridas.has(a.id) || podeSetor(a.setorId)) adicionar('CASA', a.id, a.nome) })
    gtsRows.forEach((gt: any) => {
      const admId = gt.administracaoId || (gt.setorId ? setorAdm.get(gt.setorId) : null)
      const regionalId = gt.regionalId || (admId ? admRegional.get(admId) : null)
      if (master || gtsGeridos.has(gt.id) ||
        (gt.setorId && setoresGeridos.has(gt.setorId)) ||
        (admId && admsGeridas.has(admId)) ||
        (regionalId && regionaisGeridas.has(regionalId))) adicionar('GRUPO_TRABALHO', gt.id, gt.nome)
    })
  }
  const setorOrigem = await setorDeOrigemAtivo(c.get('db'), c.get('membroId'))
  if (setorOrigem) adicionar('SETOR', setorOrigem.id, setorOrigem.nome)
  return c.json({ master: eMasterSistema(contexto), escopos })
})

locaisRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(locais).where(eq(locais.id, id)).get()
  
  if (!data) return c.json({ error: 'Local não encontrado' }, 404)
  if (!await localVisivel(db, c.get('contextoPermissoes'), data)) {
    const autorizados = data.proprietarioMembroId ? new Set<string>() : await locaisDeEventosVisiveis(db, c.get('contextoPermissoes'), [data.id])
    if (!autorizados.has(data.id)) return c.json({ error: 'Local não encontrado' }, 404)
  }
  return c.json(data)
})

// Local particular: não entra no cadastro institucional e só seu proprietário o administra.
locaisRouter.post('/particulares', async c => {
  const db = c.get('db')
  const proprietarioMembroId = c.get('membroId')
  if (!proprietarioMembroId) return c.json({ error: 'Sessão não autenticada' }, 401)
  try {
    const parsed = LocalCreate.parse(await c.req.json())
    const id = crypto.randomUUID()
    await executarOperacaoComAudit(db, qdb => [qdb.insert(locais).values({
      id, ...parsed, proprietarioMembroId,
    })], {
      acao: 'LOCAL_PARTICULAR_CRIADO',
      atorMembroId: proprietarioMembroId, recursoTipo: 'LOCAL', recursoId: id,
      escopoTipo: 'PESSOAL', escopoId: proprietarioMembroId,
      contexto: { cidade: parsed.cidade, uf: parsed.uf },
    })
    return c.json(await db.select().from(locais).where(eq(locais.id, id)).get(), 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

locaisRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = LocalCreate.parse(body)
    const contexto = c.get('contextoPermissoes')
    const tipo = body.escopoTipo
    const escopoId = body.escopoId
    const tipos = ['REGIONAL', 'ADMINISTRACAO', 'SETOR', 'CASA', 'GRUPO_TRABALHO']
    if (!tipo || !escopoId) return c.json({ error: 'Informe um escopo territorial autorizado', code: 'FORBIDDEN' }, 403)
    if ((tipo || escopoId) && (!tipos.includes(tipo) || typeof escopoId !== 'string' || !escopoId.trim())) return c.json({ error: 'Escopo territorial inválido' }, 400)
    if (tipo && escopoId) {
      const existe = await obterRegionalDoEscopo(db, tipo, escopoId)
      if (!existe) return c.json({ error: 'Escopo territorial não encontrado' }, 400)
      const setorOrigem = tipo === 'SETOR' ? await setorDeOrigemAtivo(db, c.get('membroId')) : null
      const podeCriarNoProprioSetor = tipo === 'SETOR' && setorOrigem?.id === escopoId
      if (!podeCriarNoProprioSetor && !await podeGerenciarCadastroTerritorial(db, contexto, tipo, escopoId)) return c.json({ error: 'Sem permissão para cadastrar neste escopo', code: 'FORBIDDEN' }, 403)
    }

    const id = crypto.randomUUID()
    const atorMembroId = c.get('membroId') || null
    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(locais).values({ id, ...parsed, escopoTipo: tipo ?? null, escopoId: escopoId ?? null })],
      {
        acao: 'LOCAL_CRIADO',
        atorMembroId,
        recursoTipo: 'LOCAL',
        recursoId: id,
        escopoTipo: tipo ?? 'GLOBAL',
        escopoId: escopoId ?? null,
        contexto: { nome: parsed.nome, cidade: parsed.cidade, uf: parsed.uf },
      }
    )
    const result = await db.select().from(locais).where(eq(locais.id, id)).get()
    return c.json(result, 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

locaisRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = LocalUpdate.parse(body)
    
    const existing = await db.select().from(locais).where(eq(locais.id, id)).get()
    if (!existing || existing.proprietarioMembroId) return c.json({ error: 'Local institucional não encontrado' }, 404)
    const contexto = c.get('contextoPermissoes')
    if (!existing.escopoTipo || !existing.escopoId) {
      if (!eMasterSistema(contexto)) return c.json({ error: 'Somente o Master altera locais legados sem escopo', code: 'FORBIDDEN' }, 403)
    } else if (!await podeGerenciarCadastroTerritorial(db, contexto, existing.escopoTipo, existing.escopoId)) {
      return c.json({ error: 'Acesso não autorizado a este local', code: 'FORBIDDEN' }, 403)
    }
    let escopoParaClassificar: { escopoTipo: 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO'; escopoId: string } | null = null
    if ('escopoTipo' in body || 'escopoId' in body) {
      const permitidos = ['REGIONAL', 'ADMINISTRACAO', 'SETOR', 'CASA', 'GRUPO_TRABALHO']
      if (!eMasterSistema(contexto) || existing.escopoTipo || existing.escopoId) {
        return c.json({ error: 'Somente o Master classifica um local institucional legado', code: 'FORBIDDEN' }, 403)
      }
      if (!permitidos.includes(body.escopoTipo) || typeof body.escopoId !== 'string' ||
        !body.escopoId.trim() || !await obterRegionalDoEscopo(db, body.escopoTipo, body.escopoId)) {
        return c.json({ error: 'Escopo territorial inválido' }, 400)
      }
      escopoParaClassificar = { escopoTipo: body.escopoTipo, escopoId: body.escopoId }
    }

    const atorMembroId = c.get('membroId') || null
    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(locais)
          .set({ ...parsed, ...(escopoParaClassificar ?? {}), updatedAt: new Date().toISOString() })
          .where(eq(locais.id, id))
      ],
      {
        acao: 'LOCAL_ATUALIZADO',
        atorMembroId,
        recursoTipo: 'LOCAL',
        recursoId: id,
        escopoTipo: escopoParaClassificar?.escopoTipo ?? existing.escopoTipo ?? 'GLOBAL',
        escopoId: escopoParaClassificar?.escopoId ?? existing.escopoId ?? null,
        contexto: { camposAlterados: [...Object.keys(parsed), ...(escopoParaClassificar ? ['escopoTipo', 'escopoId'] : [])] },
      }
    )
    const updated = await db.select().from(locais).where(eq(locais.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
