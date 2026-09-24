import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import {
  administracoes,
  casas,
  funcoes,
  gruposTrabalho,
  membros,
  regionais,
  setores,
  vinculosFuncionais,
} from '../db/schema'
import { CreateVinculoFuncionalSchema, UpdateVinculoFuncionalSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, obterRegionalDoEscopo, regionaisAdministradas } from '../security/permissoes'

export const vinculosFuncionaisRouter = new Hono<any>()

vinculosFuncionaisRouter.use('*', authMiddleware)

const vinculoDetalhadoSelect = {
  id: vinculosFuncionais.id,
  membroId: vinculosFuncionais.membroId,
  funcaoId: vinculosFuncionais.funcaoId,
  regionalId: vinculosFuncionais.regionalId,
  administracaoId: vinculosFuncionais.administracaoId,
  setorId: vinculosFuncionais.setorId,
  casaId: vinculosFuncionais.casaId,
  grupoTrabalhoId: vinculosFuncionais.grupoTrabalhoId,
  ativo: vinculosFuncionais.ativo,
  createdAt: vinculosFuncionais.createdAt,
  updatedAt: vinculosFuncionais.updatedAt,
  membro: {
    nome: membros.nome,
  },
  funcao: {
    nome: funcoes.nome,
  },
  regional: {
    nome: regionais.nome,
  },
  administracao: {
    nome: administracoes.nome,
  },
  setor: {
    nome: setores.nome,
  },
  casa: {
    nome: casas.nome,
  },
  grupoTrabalho: {
    nome: gruposTrabalho.nome,
  },
}

function selecionarVinculosDetalhados(db: any) {
  return db
    .select(vinculoDetalhadoSelect)
    .from(vinculosFuncionais)
    .leftJoin(membros, eq(vinculosFuncionais.membroId, membros.id))
    .leftJoin(funcoes, eq(vinculosFuncionais.funcaoId, funcoes.id))
    .leftJoin(regionais, eq(vinculosFuncionais.regionalId, regionais.id))
    .leftJoin(administracoes, eq(vinculosFuncionais.administracaoId, administracoes.id))
    .leftJoin(setores, eq(vinculosFuncionais.setorId, setores.id))
    .leftJoin(casas, eq(vinculosFuncionais.casaId, casas.id))
    .leftJoin(gruposTrabalho, eq(vinculosFuncionais.grupoTrabalhoId, gruposTrabalho.id))
}

async function regionalIdDoMembro(db: any, membroId: string): Promise<string | null> {
  const row = await db
    .select({ regionalId: administracoes.regionalId })
    .from(membros)
    .innerJoin(casas, eq(membros.casaId, casas.id))
    .innerJoin(setores, eq(casas.setorId, setores.id))
    .innerJoin(administracoes, eq(setores.administracaoId, administracoes.id))
    .where(eq(membros.id, membroId))
    .get()

  return row?.regionalId ?? null
}

function escopoDoVinculo(vinculo: any): {
  tipo: 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO'
  id: string
} | null {
  if (vinculo.regionalId) return { tipo: 'REGIONAL', id: vinculo.regionalId }
  if (vinculo.administracaoId) return { tipo: 'ADMINISTRACAO', id: vinculo.administracaoId }
  if (vinculo.setorId) return { tipo: 'SETOR', id: vinculo.setorId }
  if (vinculo.casaId) return { tipo: 'CASA', id: vinculo.casaId }
  if (vinculo.grupoTrabalhoId) return { tipo: 'GRUPO_TRABALHO', id: vinculo.grupoTrabalhoId }
  return null
}

async function podeAdministrarVinculo(db: any, contexto: any, vinculo: any): Promise<boolean> {
  if (eMasterSistema(contexto)) return true

  const administradas = regionaisAdministradas(contexto)
  if (administradas.size === 0) return false

  const regionalMembro = await regionalIdDoMembro(db, vinculo.membroId)
  if (!regionalMembro || !administradas.has(regionalMembro)) return false

  const escopo = escopoDoVinculo(vinculo)
  if (!escopo) return false

  const regionalEscopo = await obterRegionalDoEscopo(db, escopo.tipo, escopo.id)
  return !!regionalEscopo && administradas.has(regionalEscopo) && regionalEscopo === regionalMembro
}

async function vinculoVisivelParaContexto(db: any, contexto: any, vinculo: any): Promise<boolean> {
  if (eMasterSistema(contexto)) return true
  if (vinculo.membroId === contexto.membroId) return true

  const administradas = regionaisAdministradas(contexto)
  if (administradas.size === 0) return false

  let escopoTipo: 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO' | null = null
  let escopoId: string | null = null

  if (vinculo.regionalId) {
    escopoTipo = 'REGIONAL'
    escopoId = vinculo.regionalId
  } else if (vinculo.administracaoId) {
    escopoTipo = 'ADMINISTRACAO'
    escopoId = vinculo.administracaoId
  } else if (vinculo.setorId) {
    escopoTipo = 'SETOR'
    escopoId = vinculo.setorId
  } else if (vinculo.casaId) {
    escopoTipo = 'CASA'
    escopoId = vinculo.casaId
  } else if (vinculo.grupoTrabalhoId) {
    escopoTipo = 'GRUPO_TRABALHO'
    escopoId = vinculo.grupoTrabalhoId
  }

  if (!escopoTipo || !escopoId) return false
  const regionalId = await obterRegionalDoEscopo(db, escopoTipo, escopoId)
  return regionalId ? administradas.has(regionalId) : false
}

vinculosFuncionaisRouter.get('/', async (c) => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const data = await selecionarVinculosDetalhados(db).all()

  if (eMasterSistema(contexto)) return c.json(data)

  const visiveis = []
  for (const vinculo of data) {
    if (await vinculoVisivelParaContexto(db, contexto, vinculo)) {
      visiveis.push(vinculo)
    }
  }

  return c.json(visiveis)
})

vinculosFuncionaisRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await selecionarVinculosDetalhados(db)
    .where(eq(vinculosFuncionais.id, id))
    .get()
  
  if (!data) return c.json({ error: 'Vínculo funcional não encontrado' }, 404)

  const contexto = c.get('contextoPermissoes')
  if (!(await vinculoVisivelParaContexto(db, contexto, data))) {
    return c.json({ error: 'Acesso não autorizado para este vínculo', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

vinculosFuncionaisRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateVinculoFuncionalSchema.parse(body)

    if (!(await podeAdministrarVinculo(db, c.get('contextoPermissoes'), parsed))) {
      return c.json({ error: 'Acesso não autorizado para administrar vínculo neste escopo', code: 'FORBIDDEN' }, 403)
    }
    
    const id = crypto.randomUUID()
    const result = await db.insert(vinculosFuncionais).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Membro, função ou escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Este vínculo já existe e está ativo neste escopo' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

vinculosFuncionaisRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateVinculoFuncionalSchema.parse(body)
    
    const existing = await db.select().from(vinculosFuncionais).where(eq(vinculosFuncionais.id, id)).get()
    if (!existing) return c.json({ error: 'Vínculo funcional não encontrado' }, 404)

    if (!(await podeAdministrarVinculo(db, c.get('contextoPermissoes'), existing))) {
      return c.json({ error: 'Acesso não autorizado para administrar este vínculo', code: 'FORBIDDEN' }, 403)
    }

    // Validar se o estado resultante possui exatamente um escopo
    // O fallback é explícito com null para que as propriedades undefined no PATCH não preservem
    // valores anteriores de escopo caso outro seja enviado?
    // Exemplo: se eu enviei `regionalId: '...'`, eu quero substituir o escopo atual,
    // então os outros escopos devem virar nulos.
    // O Zod não faz isso automaticamente, então se enviou qualquer escopo, devemos
    // contar como o novo escopo, mas...
    // O usuário instruiu: "validar que o estado RESULTANTE possui exatamente um"
    
    const estadoResultante = {
      regionalId: parsed.regionalId !== undefined ? parsed.regionalId : existing.regionalId,
      administracaoId: parsed.administracaoId !== undefined ? parsed.administracaoId : existing.administracaoId,
      setorId: parsed.setorId !== undefined ? parsed.setorId : existing.setorId,
      casaId: parsed.casaId !== undefined ? parsed.casaId : existing.casaId,
      grupoTrabalhoId: parsed.grupoTrabalhoId !== undefined ? parsed.grupoTrabalhoId : existing.grupoTrabalhoId,
    }

    let preenchidos = 0
    if (estadoResultante.regionalId) preenchidos++
    if (estadoResultante.administracaoId) preenchidos++
    if (estadoResultante.setorId) preenchidos++
    if (estadoResultante.casaId) preenchidos++
    if (estadoResultante.grupoTrabalhoId) preenchidos++

    if (preenchidos !== 1) {
      return c.json({ error: 'O vínculo funcional resultante deve possuir exatamente um escopo institucional.' }, 400)
    }

    const vinculoResultante = {
      ...existing,
      ...parsed,
      membroId: parsed.membroId !== undefined ? parsed.membroId : existing.membroId,
      ...estadoResultante,
    }

    if (!(await podeAdministrarVinculo(db, c.get('contextoPermissoes'), vinculoResultante))) {
      return c.json({ error: 'Acesso não autorizado para mover vínculo para outro escopo', code: 'FORBIDDEN' }, 403)
    }

    const updated = await db.update(vinculosFuncionais)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(vinculosFuncionais.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Membro, função ou escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Este vínculo já existe e está ativo neste escopo' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
