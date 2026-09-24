import { Hono } from 'hono'
import { and, eq, inArray, or } from 'drizzle-orm'
import { acessosConta, administracoes, casas, contasAcesso, membros, setores, tentativasAcesso } from '../db/schema'
import { CreateMembroSchema, UpdateMembroSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, regionaisAdministradas } from '../security/permissoes'
import { listarVinculosVisiveis } from './vinculos_funcionais'
import { executarOperacaoComAudit, executarOperacaoComAudits } from '../services/auditoria'

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
  if (eMasterSistema(contexto)) return true
  if (!regionalId) return false
  return regionaisAdministradas(contexto).has(regionalId)
}

function podeEscreverMembros(contexto: any): boolean {
  return eMasterSistema(contexto) || regionaisAdministradas(contexto).size > 0
}

async function membroPossuiMasterAtivo(db: any, membroId: string): Promise<boolean> {
  const acesso = await db
    .select({ id: acessosConta.id })
    .from(acessosConta)
    .innerJoin(contasAcesso, eq(acessosConta.contaAcessoId, contasAcesso.id))
    .where(
      and(
        eq(contasAcesso.membroId, membroId),
        eq(acessosConta.perfilCodigo, 'MASTER_SISTEMA'),
        eq(acessosConta.ativo, true)
      )
    )
    .get()

  return Boolean(acesso)
}

async function podeAdministrarMembro(
  c: any,
  membro: { id: string; casaId: string }
): Promise<boolean> {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  if (eMasterSistema(contexto)) return true

  // Administrador Regional nunca pode alterar um membro que seja Master ativo.
  if (await membroPossuiMasterAtivo(db, membro.id)) return false

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

  const LIMITE_IDS_D1 = 90
  const data: any[] = []

  for (let i = 0; i < ids.length; i += LIMITE_IDS_D1) {
    const lote = ids.slice(i, i + LIMITE_IDS_D1)
    const parcial = await db
      .select(membroPublico)
      .from(membros)
      .where(inArray(membros.id, lote))
      .all()
    data.push(...parcial)
  }

  data.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
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

  const contexto = c.get('contextoPermissoes')
  const data = await listarVinculosVisiveis(db, contexto, id)
  return c.json(data)
})

membrosRouter.post('/', async (c) => {
  const db = c.get('db')
  if (!podeEscreverMembros(c.get('contextoPermissoes'))) {
    return c.json({ error: 'Acesso não autorizado para administrar pessoas', code: 'FORBIDDEN' }, 403)
  }

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
    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(membros).values({ id, ...parsed })],
      {
        acao: 'MEMBRO_CRIADO',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'MEMBRO',
        recursoId: id,
        escopoTipo: 'CASA',
        escopoId: parsed.casaId,
        contexto: { campos: ['nome', 'dataOrdenacao', 'codigoCarteirinha', 'celular', 'casaId', 'ativo'] },
      }
    )
    const result = await db.select().from(membros).where(eq(membros.id, id)).get()
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
  if (!podeEscreverMembros(c.get('contextoPermissoes'))) {
    return c.json({ error: 'Acesso não autorizado para administrar pessoas', code: 'FORBIDDEN' }, 403)
  }

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

    const casaFinalId = parsed.casaId ?? existing.casaId
    const atorMembroId = c.get('membroId') || null
    const camposAlterados = Object.keys(parsed)
    const moveuCasa = casaFinalId !== existing.casaId

    if (moveuCasa) {
      await executarOperacaoComAudits(
        db,
        (qdb) => [
          qdb.update(membros)
            .set({ ...parsed, updatedAt: new Date().toISOString() })
            .where(eq(membros.id, id))
        ],
        [
          {
            acao: 'MEMBRO_ATUALIZADO',
            atorMembroId,
            recursoTipo: 'MEMBRO',
            recursoId: id,
            escopoTipo: 'CASA',
            escopoId: existing.casaId,
            contexto: { camposAlterados, movimentoEscopo: 'ORIGEM', casaDestinoId: casaFinalId },
          },
          {
            acao: 'MEMBRO_ATUALIZADO',
            atorMembroId,
            recursoTipo: 'MEMBRO',
            recursoId: id,
            escopoTipo: 'CASA',
            escopoId: casaFinalId,
            contexto: { camposAlterados, movimentoEscopo: 'DESTINO', casaOrigemId: existing.casaId },
          },
        ]
      )
    } else {
      await executarOperacaoComAudit(
        db,
        (qdb) => [
          qdb.update(membros)
            .set({ ...parsed, updatedAt: new Date().toISOString() })
            .where(eq(membros.id, id))
        ],
        {
          acao: 'MEMBRO_ATUALIZADO',
          atorMembroId,
          recursoTipo: 'MEMBRO',
          recursoId: id,
          escopoTipo: 'CASA',
          escopoId: casaFinalId,
          contexto: { camposAlterados },
        }
      )
    }
    const updated = await db.select().from(membros).where(eq(membros.id, id)).get()
    return c.json(somenteCadastroInstitucional(updated))
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Casa vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
