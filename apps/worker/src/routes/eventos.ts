import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { eventos } from '../db/schema'
import { EventoCreate, EventoUpdate } from '@piedade/shared'
import { executarOperacaoComAudit, extrairEscopoDoEvento, AuditLogData } from '../services/auditoria'
import { authMiddleware } from '../middleware/auth'
import { eGestorRelatoriosAutorizadoParaEvento, obterEscoposTerritoriaisVisiveis, podeGerenciarAgendaNoEscopo } from '../security/permissoes'

export const eventosRouter = new Hono<any>()

function eventoVisivelNoEscopo(evento: any, escopos: any): boolean {
  if (escopos.tudo) return true
  if (evento.regionalId && escopos.regionaisIds.has(evento.regionalId)) return true
  if (evento.administracaoId && escopos.administracoesIds.has(evento.administracaoId)) return true
  if (evento.setorId && escopos.setoresIds.has(evento.setorId)) return true
  if (evento.casaId && escopos.casasIds.has(evento.casaId)) return true
  if (evento.grupoTrabalhoId && escopos.gruposTrabalhoIds.has(evento.grupoTrabalhoId)) return true
  return false
}

async function eventoVisivelParaLeitura(
  db: any,
  membroId: string,
  evento: any,
  escopos: any
): Promise<boolean> {
  if (eventoVisivelNoEscopo(evento, escopos)) return true

  // Compatibilidade com relatórios: organizador ou gestor de relatórios autorizado
  // precisa continuar vendo o evento nos seletores de relatório.
  return eGestorRelatoriosAutorizadoParaEvento(db, membroId, evento)
}

eventosRouter.use('*', authMiddleware)

eventosRouter.get('/', async (c) => {
  const db = c.get('db')
  // Basic filtering for S04
  const ativo = c.req.query('ativo')
  const modalidade = c.req.query('modalidade')

  const conditions = []
  if (ativo !== undefined) {
    conditions.push(eq(eventos.ativo, ativo === 'true'))
  }
  if (modalidade !== undefined) {
    conditions.push(eq(eventos.modalidade, modalidade))
  }

  const query = db.select().from(eventos)
  const data = conditions.length > 0 
    ? await query.where(and(...conditions)).all()
    : await query.all()

  const escopos = await obterEscoposTerritoriaisVisiveis(db, c.get('contextoPermissoes'))
  const membroId = c.get('membroId')
  const visiveis = []

  for (const evento of data) {
    if (await eventoVisivelParaLeitura(db, membroId, evento, escopos)) {
      visiveis.push(evento)
    }
  }

  return c.json(visiveis)
})

eventosRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(eventos).where(eq(eventos.id, id)).get()
  
  if (!data) return c.json({ error: 'Evento não encontrado' }, 404)

  const escopos = await obterEscoposTerritoriaisVisiveis(db, c.get('contextoPermissoes'))
  if (!(await eventoVisivelParaLeitura(db, c.get('membroId'), data, escopos))) {
    return c.json({ error: 'Acesso não autorizado para este evento', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

eventosRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = EventoCreate.parse(body)
    
    const id = crypto.randomUUID()

    const { escopoTipo, escopoId } = extrairEscopoDoEvento(parsed)
    const atorMembroId = c.get('membroId') || null

    if (!atorMembroId || !escopoTipo || !escopoId) {
      return c.json({ error: 'Escopo da Agenda indisponível', code: 'FORBIDDEN' }, 403)
    }
    const autorizado = await podeGerenciarAgendaNoEscopo(
      db,
      atorMembroId,
      escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
      escopoId
    )
    if (!autorizado) {
      return c.json({ error: 'Acesso não autorizado para gerir a Agenda neste escopo', code: 'FORBIDDEN' }, 403)
    }

    const auditData: AuditLogData = {
      acao: 'EVENTO_CRIADO',
      atorMembroId,
      recursoTipo: 'EVENTO',
      recursoId: id,
      escopoTipo,
      escopoId,
      contexto: {
        titulo: parsed.titulo,
        modalidade: parsed.modalidade,
        escopoTipo: escopoTipo || '',
        escopoId: escopoId || '',
      },
    }

    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(eventos).values({ id, ...parsed })],
      auditData
    )

    const result = await db.select().from(eventos).where(eq(eventos.id, id)).get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local ou Escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
      return c.json({ error: 'Violação de regra de negócio no banco (ex: escopo único)' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

eventosRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = EventoUpdate.parse(body)
    
    const existing = await db.select().from(eventos).where(eq(eventos.id, id)).get()
    if (!existing) return c.json({ error: 'Evento não encontrado' }, 404)

    // Validar estado final mesclado (existente + patch) com EventoCreate
    const merged = { ...existing, ...parsed }
    EventoCreate.parse(merged)

    const escopoOriginal = extrairEscopoDoEvento(existing)
    const escopoFinal = extrairEscopoDoEvento(merged)
    const membroId = c.get('membroId')
    if (
      !membroId ||
      !escopoOriginal.escopoTipo ||
      !escopoOriginal.escopoId ||
      !escopoFinal.escopoTipo ||
      !escopoFinal.escopoId
    ) {
      return c.json({ error: 'Escopo da Agenda indisponível', code: 'FORBIDDEN' }, 403)
    }

    const [autorizadoOriginal, autorizadoFinal] = await Promise.all([
      podeGerenciarAgendaNoEscopo(
        db,
        membroId,
        escopoOriginal.escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
        escopoOriginal.escopoId
      ),
      podeGerenciarAgendaNoEscopo(
        db,
        membroId,
        escopoFinal.escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
        escopoFinal.escopoId
      ),
    ])

    if (!autorizadoOriginal || !autorizadoFinal) {
      return c.json({ error: 'Acesso não autorizado para gerir a Agenda neste escopo', code: 'FORBIDDEN' }, 403)
    }

    // PMO Rule: Ao alterar uma ocorrência individual, preservar serie_recorrencia_id e marcar recorrencia_excecao = true.
    const isExcecao = existing.serieRecorrenciaId !== null ? true : existing.recorrenciaExcecao
    const nowIso = new Date().toISOString()

    const { escopoTipo, escopoId } = extrairEscopoDoEvento(existing)
    const atorMembroId = c.get('membroId') || null

    const auditData: AuditLogData = {
      acao: 'EVENTO_ATUALIZADO',
      atorMembroId,
      recursoTipo: 'EVENTO',
      recursoId: id,
      escopoTipo,
      escopoId,
      contexto: {
        titulo: existing.titulo,
        modalidade: existing.modalidade,
        camposAlterados: Object.keys(parsed),
      },
    }

    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(eventos)
          .set({ ...parsed, recorrenciaExcecao: isExcecao, updatedAt: nowIso })
          .where(eq(eventos.id, id))
      ],
      auditData
    )

    const updated = await db.select().from(eventos).where(eq(eventos.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local ou Escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
      return c.json({ error: 'Violação de regra de negócio no banco (ex: escopo único)' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

