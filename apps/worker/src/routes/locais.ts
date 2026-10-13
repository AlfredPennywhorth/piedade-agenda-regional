import { Hono } from 'hono'
import { eq, isNull, or } from 'drizzle-orm'
import { locais } from '../db/schema'
import { LocalCreate, LocalUpdate } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, podeGerenciarCadastroTerritorial, obterRegionalDoEscopo } from '../security/permissoes'
import { executarOperacaoComAudit } from '../services/auditoria'

export const locaisRouter = new Hono<any>()

locaisRouter.use('*', authMiddleware)

locaisRouter.get('/', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const data = await db.select().from(locais).where(or(isNull(locais.proprietarioMembroId), eq(locais.proprietarioMembroId, membroId))).all()
  return c.json(data)
})

// Escopos explicitamente atribuídos ao administrador; a API valida novamente na escrita.
locaisRouter.get('/escopos-autorizados', async c => {
  const contexto = c.get('contextoPermissoes')
  const escopos = contexto.acessosAtivos
    .filter((acesso: any) => acesso.perfilCodigo === 'ADMINISTRADOR_SISTEMA' &&
      acesso.escopoTipo !== 'GLOBAL' && acesso.escopoId)
    .map((acesso: any) => ({ escopoTipo: acesso.escopoTipo, escopoId: acesso.escopoId }))
  return c.json({ master: eMasterSistema(contexto), escopos })
})

locaisRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(locais).where(eq(locais.id, id)).get()
  
  if (!data || (data.proprietarioMembroId && data.proprietarioMembroId !== c.get('membroId'))) return c.json({ error: 'Local não encontrado' }, 404)
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
    const master = eMasterSistema(contexto)
    const tipo = body.escopoTipo
    const escopoId = body.escopoId
    const tipos = ['REGIONAL', 'ADMINISTRACAO', 'SETOR', 'CASA', 'GRUPO_TRABALHO']
    if ((!tipo || !escopoId) && !master) return c.json({ error: 'Informe um escopo territorial autorizado', code: 'ESCOPO_OBRIGATORIO' }, 403)
    if ((tipo || escopoId) && (!tipos.includes(tipo) || typeof escopoId !== 'string' || !escopoId.trim())) return c.json({ error: 'Escopo territorial inválido' }, 400)
    if (tipo && escopoId) {
      const existe = await obterRegionalDoEscopo(db, tipo, escopoId)
      if (!existe) return c.json({ error: 'Escopo territorial não encontrado' }, 400)
      if (!await podeGerenciarCadastroTerritorial(db, contexto, tipo, escopoId)) return c.json({ error: 'Sem permissão para cadastrar neste escopo', code: 'FORBIDDEN' }, 403)
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
        escopoTipo: 'GLOBAL',
        escopoId: null,
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
    if ('escopoTipo' in body || 'escopoId' in body) return c.json({ error: 'Escopo do local não pode ser alterado por esta operação' }, 400)

    const atorMembroId = c.get('membroId') || null
    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(locais)
          .set({ ...parsed, updatedAt: new Date().toISOString() })
          .where(eq(locais.id, id))
      ],
      {
        acao: 'LOCAL_ATUALIZADO',
        atorMembroId,
        recursoTipo: 'LOCAL',
        recursoId: id,
        escopoTipo: 'GLOBAL',
        escopoId: null,
        contexto: { camposAlterados: Object.keys(parsed) },
      }
    )
    const updated = await db.select().from(locais).where(eq(locais.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
