import { Hono } from 'hono'
import { eq, inArray, or } from 'drizzle-orm'
import { administracoes, casas, membros, setores, vinculosFuncionais, tentativasAcesso } from '../db/schema'
import { CreateMembroSchema, UpdateMembroSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, regionaisAdministradas } from '../security/permissoes'

export const membrosRouter = new Hono<any>()

membrosRouter.use('*', authMiddleware)

const membroPublico = {
  id: membros.id,
  nome: membros.nome,
  dataOrdenacao: membros.dataOrdenacao,
  codigoCarteirinha: membros.codigoCarteirinha,
  celular: membros.celular,
  casaId: membros.casaId,
  ativo: membros.ativo,
  createdAt: membros.createdAt,
  updatedAt: membros.updatedAt,
}

function somenteCadastroInstitucional(membro: any) {
  return {
    id: membro.id,
    nome: membro.nome,
    dataOrdenacao: membro.dataOrdenacao,
    codigoCarteirinha: membro.codigoCarteirinha,
    celular: membro.celular,
    casaId: membro.casaId,
    ativo: membro.ativo,
    createdAt: membro.createdAt,
    updatedAt: membro.updatedAt,
  }
}

async function regionalIdDaCasa(db: any, casaId: string): Promise<string | null> {
  const row = await db
    .select({ regionalId: administracoes.regionalId })
    .from(casas)
    .innerJoin(setores, eq(casas.setorId, setores.id))
    .innerJoin(administracoes, eq(setores.administracaoId, administracoes.id))
    .where(eq(casas.id, casaId))
    .get()

  return row?.regionalId ?? null
}

function podeAdministrarRegionalDoContexto(contexto: any, regionalId: string | null): boolean {
  if (!regionalId) return false
  if (eMasterSistema(contexto)) return true
  return regionaisAdministradas(contexto).has(regionalId)
}

async function podeAdministrarMembro(c: any, membro: { casaId: string }): Promise<boolean> {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  if (eMasterSistema(contexto)) return true
  const regionalId = await regionalIdDaCasa(db, membro.casaId)
  return podeAdministrarRegionalDoContexto(contexto, regionalId)
}

async function idsMembrosVisiveis(c: any): Promise<Set<string> | null> {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')

  if (eMasterSistema(contexto)) return null

  const ids = new Set<string>([contexto.membroId])
  const regionaisIds = Array.from(regionaisAdministradas(contexto))
  if (regionaisIds.length === 0) return ids

  const rows = await db
    .select({ id: membros.id })
    .from(membros)
    .leftJoin(casas, eq(membros.casaId, casas.id))
    .leftJoin(setores, eq(casas.setorId, setores.id))
    .leftJoin(administracoes, eq(setores.administracaoId, administracoes.id))
    .where(
      or(
        eq(membros.id, contexto.membroId),
        inArray(administracoes.regionalId, regionaisIds)
      )
    )
    .all()

  rows.forEach((row: { id: string }) => ids.add(row.id))
  return ids
}

membrosRouter.get('/', async (c) => {
  const db = c.get('db')
  const idsVisiveis = await idsMembrosVisiveis(c)

  if (idsVisiveis === null) {
    return c.json(await db.select(membroPublico).from(membros).all())
  }

  const ids = Array.from(idsVisiveis)
  if (ids.length === 0) return c.json([])

  const data = await db
    .select(membroPublico)
    .from(membros)
    .where(inArray(membros.id, ids))
    .all()

  return c.json(data)
})

membrosRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select(membroPublico).from(membros).where(eq(membros.id, id)).get()
  
  if (!data) return c.json({ error: 'Membro não encontrado' }, 404)

  const idsVisiveis = await idsMembrosVisiveis(c)
  if (idsVisiveis !== null && !idsVisiveis.has(id)) {
    return c.json({ error: 'Acesso não autorizado para este membro', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

membrosRouter.get('/:id/vinculos', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  
  const membroExists = await db.select().from(membros).where(eq(membros.id, id)).get()
  if (!membroExists) return c.json({ error: 'Membro não encontrado' }, 404)

  const idsVisiveis = await idsMembrosVisiveis(c)
  if (idsVisiveis !== null && !idsVisiveis.has(id)) {
    return c.json({ error: 'Acesso não autorizado para este membro', code: 'FORBIDDEN' }, 403)
  }

  const data = await db.select().from(vinculosFuncionais).where(eq(vinculosFuncionais.membroId, id)).all()
  return c.json(data)
})

membrosRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateMembroSchema.parse(body)

    const regionalAlvo = await regionalIdDaCasa(db, parsed.casaId)
    if (!podeAdministrarRegionalDoContexto(c.get('contextoPermissoes'), regionalAlvo)) {
      return c.json({ error: 'Acesso não autorizado para administrar pessoas nesta Regional', code: 'FORBIDDEN' }, 403)
    }
    
    const conflitoCarteirinha = await db
      .select({ id: membros.id })
      .from(membros)
      .where(eq(membros.codigoCarteirinha, parsed.codigoCarteirinha))
      .get()
    if (conflitoCarteirinha) {
      return c.json(
        { error: 'Código da carteirinha já vinculado', code: 'CARTEIRINHA_JA_VINCULADA' },
        409
      )
    }

    if (parsed.celular) {
      const conflito = await db.select().from(membros).where(eq(membros.celular, parsed.celular)).get()
      if (conflito) {
        // Celular já vinculado a outro membro. Registra auditoria genérica.
        await db.insert(tentativasAcesso).values({
          id: crypto.randomUUID(),
          membroId: null,
          tipo: 'CONFLITO_CELULAR',
          sucesso: false,
          motivo: 'Celular já vinculado a outro membro',
        })
        return c.json({ error: 'Celular já vinculado a outro membro', code: 'CELULAR_JA_VINCULADO' }, 409)
      }
    }

    const id = crypto.randomUUID()
    const result = await db.insert(membros).values({ id, ...parsed }).returning().get()
    return c.json(somenteCadastroInstitucional(result), 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Casa vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

membrosRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateMembroSchema.parse(body)
    
    const existing = await db.select().from(membros).where(eq(membros.id, id)).get()
    if (!existing) return c.json({ error: 'Membro não encontrado' }, 404)

    if (!(await podeAdministrarMembro(c, existing))) {
      return c.json({ error: 'Acesso não autorizado para administrar este membro', code: 'FORBIDDEN' }, 403)
    }

    if (parsed.casaId && parsed.casaId !== existing.casaId) {
      const novaRegionalId = await regionalIdDaCasa(db, parsed.casaId)
      if (!podeAdministrarRegionalDoContexto(c.get('contextoPermissoes'), novaRegionalId)) {
        return c.json({ error: 'Acesso não autorizado para mover membro para outra Regional', code: 'FORBIDDEN' }, 403)
      }
    }

    if (
      parsed.codigoCarteirinha &&
      parsed.codigoCarteirinha !== existing.codigoCarteirinha
    ) {
      const conflitoCarteirinha = await db
        .select({ id: membros.id })
        .from(membros)
        .where(eq(membros.codigoCarteirinha, parsed.codigoCarteirinha))
        .get()
      if (conflitoCarteirinha) {
        return c.json(
          { error: 'Código da carteirinha já vinculado', code: 'CARTEIRINHA_JA_VINCULADA' },
          409
        )
      }
    }

    if (parsed.celular && parsed.celular !== existing.celular) {
      const conflito = await db.select().from(membros).where(eq(membros.celular, parsed.celular)).get()
      if (conflito) {
        await db.insert(tentativasAcesso).values({
          id: crypto.randomUUID(),
          membroId: id,
          tipo: 'CONFLITO_CELULAR',
          sucesso: false,
          motivo: 'Celular já vinculado a outro membro',
        })
        return c.json({ error: 'Celular já vinculado a outro membro', code: 'CELULAR_JA_VINCULADO' }, 409)
      }
    }

    const updated = await db.update(membros)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(membros.id, id))
      .returning().get()
      
    return c.json(somenteCadastroInstitucional(updated))
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Casa vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
