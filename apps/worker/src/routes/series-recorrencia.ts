import { Hono } from 'hono'
import { eq, and, gte, sql } from 'drizzle-orm'
import { eventos, seriesRecorrencia } from '../db/schema'
import { SerieCreate, SerieUpdatePayload, generateOccurrences, getLocalDateFromUtc } from '@piedade/shared'
import { EventoCreate } from '@piedade/shared'
import { executeAtomic } from '../db/batch'
import { authMiddleware } from '../middleware/auth'
import { podeGerenciarAgendaNoEscopo } from '../security/permissoes'
import { extrairEscopoDoEvento } from '../services/auditoria'

export const seriesRecorrenciaRouter = new Hono<any>()

seriesRecorrenciaRouter.use('*', authMiddleware)

async function podeGerenciarEntidade(c: any, entidade: any): Promise<boolean> {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const escopo = extrairEscopoDoEvento(entidade)

  if (!membroId || !escopo.escopoTipo || !escopo.escopoId) return false

  return podeGerenciarAgendaNoEscopo(
    db,
    membroId,
    escopo.escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
    escopo.escopoId
  )
}

seriesRecorrenciaRouter.get('/', async (c) => {
  const db = c.get('db')
  const ativo = c.req.query('ativo')

  const conditions = []
  if (ativo !== undefined) {
    conditions.push(eq(seriesRecorrencia.ativo, ativo === 'true'))
  }

  const query = db.select().from(seriesRecorrencia)
  const data = conditions.length > 0 
    ? await query.where(and(...conditions)).all()
    : await query.all()

  const autorizadas = []
  for (const serie of data) {
    if (await podeGerenciarEntidade(c, serie)) autorizadas.push(serie)
  }

  return c.json(autorizadas)
})

seriesRecorrenciaRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(seriesRecorrencia).where(eq(seriesRecorrencia.id, id)).get()
  
  if (!data) return c.json({ error: 'Série não encontrada' }, 404)
  if (!(await podeGerenciarEntidade(c, data))) {
    return c.json({ error: 'Acesso não autorizado para gerir esta série', code: 'FORBIDDEN' }, 403)
  }
  return c.json(data)
})

seriesRecorrenciaRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = SerieCreate.parse(body)
    
    if (!(await podeGerenciarEntidade(c, parsed))) {
      return c.json({ error: 'Acesso não autorizado para gerir a Agenda neste escopo', code: 'FORBIDDEN' }, 403)
    }

    const serieId = crypto.randomUUID()
    
    const nowIso = new Date().toISOString()
    const resultSerie = { id: serieId, ...parsed, createdAt: nowIso, updatedAt: nowIso }
    
    // Gerar ocorrências usando a recurrence-engine (Agnóstica de infra)
    const occurrencesDates = generateOccurrences(parsed)
    
    // Preparar payloads de evento
    const eventosToInsert = occurrencesDates.map(occ => {
      const { ...serieBaseData } = parsed
      return {
        id: crypto.randomUUID(),
        titulo: serieBaseData.titulo,
        descricao: serieBaseData.descricao,
        pauta: serieBaseData.pauta,
        modalidade: serieBaseData.modalidade,
        localId: serieBaseData.localId,
        urlOnline: serieBaseData.urlOnline,
        organizadorMembroId: serieBaseData.organizadorMembroId,
        regionalId: serieBaseData.regionalId,
        administracaoId: serieBaseData.administracaoId,
        setorId: serieBaseData.setorId,
        casaId: serieBaseData.casaId,
        grupoTrabalhoId: serieBaseData.grupoTrabalhoId,
        observacoes: serieBaseData.observacoes,
        ativo: serieBaseData.ativo ?? true,
        
        inicioEm: occ.inicioEm,
        fimEm: occ.fimEm,
        
        serieRecorrenciaId: serieId,
        recorrenciaOrigemInicioEm: occ.inicioEm,
        recorrenciaExcecao: false,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    })

    // Transação usando executeAtomic para atomicidade nativa Cloudflare/SQLite
    await executeAtomic(db, (qdb) => {
      const queries = []
      queries.push(qdb.insert(seriesRecorrencia).values(resultSerie))
      if (eventosToInsert.length > 0) {
        queries.push(qdb.insert(eventos).values(eventosToInsert))
      }
      return queries
    })

    return c.json({ serie: resultSerie, generatedOccurrences: eventosToInsert.length }, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local ou Escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
      return c.json({ error: 'Violação de regra de negócio no banco' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

seriesRecorrenciaRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const serieId = c.req.param('id')
  
  try {
    const body = await c.req.json()
    const parsed = SerieUpdatePayload.parse(body)
    
    const existingSerie = await db.select().from(seriesRecorrencia).where(eq(seriesRecorrencia.id, serieId)).get()
    if (!existingSerie) return c.json({ error: 'Série não encontrada' }, 404)
    if (!(await podeGerenciarEntidade(c, existingSerie))) {
      return c.json({ error: 'Acesso não autorizado para gerir esta série', code: 'FORBIDDEN' }, 403)
    }
    
    const nowIso = new Date().toISOString()
    
    if (parsed.updateMode === 'THIS') {
      if (!parsed.fromEventId) return c.json({ error: 'fromEventId obrigatório' }, 400)
      
      const existingEvent = await db.select().from(eventos).where(eq(eventos.id, parsed.fromEventId)).get()
      if (!existingEvent || existingEvent.serieRecorrenciaId !== serieId) {
         return c.json({ error: 'Evento origem não encontrado ou não pertence a esta série' }, 400)
      }
      
      if (!(await podeGerenciarEntidade(c, existingEvent))) {
        return c.json({ error: 'Acesso não autorizado para gerir este evento', code: 'FORBIDDEN' }, 403)
      }

      const mergedEvent = { ...existingEvent, ...parsed.changes }
      EventoCreate.parse(mergedEvent) // Valida regras S04
      if (!(await podeGerenciarEntidade(c, mergedEvent))) {
        return c.json({ error: 'Acesso não autorizado para mover o evento para este escopo', code: 'FORBIDDEN' }, 403)
      }
      
      const updatedEvent = await db.update(eventos)
        .set({
          ...parsed.changes,
          recorrenciaOrigemInicioEm:
            existingEvent.recorrenciaOrigemInicioEm ?? existingEvent.inicioEm,
          recorrenciaExcecao: true,
          updatedAt: nowIso,
        }) // serieRecorrenciaId intacto
        .where(eq(eventos.id, parsed.fromEventId))
        .returning().get()
        
      return c.json({ message: 'Evento atualizado individualmente', event: updatedEvent })
    }
    
    if (parsed.updateMode === 'ALL') {
      const mergedSerieData = { ...existingSerie, ...parsed.changes }
      SerieCreate.parse(mergedSerieData)
      if (!(await podeGerenciarEntidade(c, mergedSerieData))) {
        return c.json({ error: 'Acesso não autorizado para mover a série para este escopo', code: 'FORBIDDEN' }, 403)
      }

      if (parsed.changes.ativo === false) {
        await executeAtomic(db, (qdb) => {
          return [
            qdb.update(seriesRecorrencia)
              .set({ ...parsed.changes, ativo: false, updatedAt: nowIso })
              .where(eq(seriesRecorrencia.id, serieId)),
            qdb.update(eventos)
              .set({ ativo: false, updatedAt: nowIso })
              .where(and(
                eq(eventos.serieRecorrenciaId, serieId),
                gte(eventos.inicioEm, nowIso)
              ))
          ]
        })
        return c.json({ message: 'Série atualizada e eventos futuros inativados com sucesso' })
      }

      const exceptions = await db.select().from(eventos).where(and(
        eq(eventos.serieRecorrenciaId, serieId),
        gte(
          sql`COALESCE(${eventos.recorrenciaOrigemInicioEm}, ${eventos.inicioEm})`,
          nowIso
        ),
        eq(eventos.recorrenciaExcecao, true)
      )).all()
      const exceptionDates = new Set(
        exceptions.map((e: any) =>
          getLocalDateFromUtc(e.recorrenciaOrigemInicioEm ?? e.inicioEm)
        )
      )
      
      const occurrencesDates = generateOccurrences(mergedSerieData)
      const futureOccurrences = occurrencesDates
        .filter(occ => occ.inicioEm >= nowIso)
        .filter(occ => !exceptionDates.has(getLocalDateFromUtc(occ.inicioEm)))
        
      const eventosToInsert = futureOccurrences.map(occ => {
        const { ...serieBaseData } = mergedSerieData
        return {
          id: crypto.randomUUID(),
          titulo: serieBaseData.titulo,
          descricao: serieBaseData.descricao,
          pauta: serieBaseData.pauta,
          modalidade: serieBaseData.modalidade,
          localId: serieBaseData.localId,
          urlOnline: serieBaseData.urlOnline,
          organizadorMembroId: serieBaseData.organizadorMembroId,
          regionalId: serieBaseData.regionalId,
          administracaoId: serieBaseData.administracaoId,
          setorId: serieBaseData.setorId,
          casaId: serieBaseData.casaId,
          grupoTrabalhoId: serieBaseData.grupoTrabalhoId,
          observacoes: serieBaseData.observacoes,
          ativo: serieBaseData.ativo ?? true,
          
          inicioEm: occ.inicioEm,
          fimEm: occ.fimEm,
          
          serieRecorrenciaId: serieId,
          recorrenciaOrigemInicioEm: occ.inicioEm,
          recorrenciaExcecao: false,
          createdAt: nowIso,
          updatedAt: nowIso
        }
      })
      
      await executeAtomic(db, (qdb) => {
        const queries = []
        queries.push(
          qdb.update(seriesRecorrencia)
            .set({ ...parsed.changes, updatedAt: nowIso })
            .where(eq(seriesRecorrencia.id, serieId))
        )
        
        // Em vez de delete, marcar ativo=false nas ocorrências substituídas
        queries.push(
          qdb.update(eventos)
            .set({ ativo: false, updatedAt: nowIso })
            .where(and(
              eq(eventos.serieRecorrenciaId, serieId),
              gte(eventos.inicioEm, nowIso),
              eq(eventos.recorrenciaExcecao, false),
              eq(eventos.ativo, true) // Não precisa inativar o que já está inativo
            ))
        )
        
        if (eventosToInsert.length > 0) {
          queries.push(qdb.insert(eventos).values(eventosToInsert))
        }
        
        return queries
      })
      
      return c.json({ message: 'Série inteira e futuros eventos atualizados com sucesso' })
    }
    
    if (parsed.updateMode === 'THIS_AND_FUTURE') {
      if (!parsed.fromEventId) return c.json({ error: 'fromEventId obrigatório' }, 400)
      
      const existingEvent = await db.select().from(eventos).where(eq(eventos.id, parsed.fromEventId)).get()
      if (!existingEvent || existingEvent.serieRecorrenciaId !== serieId) {
         return c.json({ error: 'Evento origem não encontrado ou não pertence a esta série' }, 400)
      }
      
      if (!(await podeGerenciarEntidade(c, existingEvent))) {
        return c.json({ error: 'Acesso não autorizado para gerir este evento', code: 'FORBIDDEN' }, 403)
      }

      const pivotDateIso = existingEvent.inicioEm
      
      const newSerieId = crypto.randomUUID()
      
      // Cálculo correto com timezone
      const newStartDateStr = getLocalDateFromUtc(pivotDateIso)
      
      const serieBData = SerieCreate.parse({
        ...existingSerie,
        ...parsed.changes,
        dataInicio: newStartDateStr
      })
      if (!(await podeGerenciarEntidade(c, serieBData))) {
        return c.json({ error: 'Acesso não autorizado para mover a série para este escopo', code: 'FORBIDDEN' }, 403)
      }
      
      // Série A (Antiga) termina no dia anterior a novaStartDateStr
      // Para saber isso facilmente no mesmo timezone de SP: 
      // Em Javascript local é perigoso por causa de fusos da máquina.
      // Porém getLocalDateFromUtc pega exatamente o "hoje" em SP e podemos subtrair os dias
      // convertendo Date UTC + Math. Uma forma segura é simplesmente:
      const msPerDay = 1000 * 60 * 60 * 24
      // Pegamos o meio do dia em UTC equivalente ao início da data de hoje, 
      // garantindo que não vamos cair no dia errado.
      const pivotDate = new Date(`${newStartDateStr}T12:00:00Z`)
      pivotDate.setTime(pivotDate.getTime() - msPerDay)
      const oldEndDateStr = pivotDate.toISOString().split('T')[0]
      
      const exceptions = await db.select().from(eventos).where(and(
        eq(eventos.serieRecorrenciaId, serieId),
        gte(
          sql`COALESCE(${eventos.recorrenciaOrigemInicioEm}, ${eventos.inicioEm})`,
          pivotDateIso
        ),
        eq(eventos.recorrenciaExcecao, true)
      )).all()
      const exceptionDates = new Set(
        exceptions.map((e: any) =>
          getLocalDateFromUtc(e.recorrenciaOrigemInicioEm ?? e.inicioEm)
        )
      )
      
      const occurrencesDates = generateOccurrences(serieBData)
      const eventosToInsert = occurrencesDates
        .filter(occ => !exceptionDates.has(getLocalDateFromUtc(occ.inicioEm)))
        .map(occ => {
          const { ...serieBaseData } = serieBData
          return {
            id: crypto.randomUUID(),
            titulo: serieBaseData.titulo,
            descricao: serieBaseData.descricao,
            pauta: serieBaseData.pauta,
            modalidade: serieBaseData.modalidade,
            localId: serieBaseData.localId,
            urlOnline: serieBaseData.urlOnline,
            organizadorMembroId: serieBaseData.organizadorMembroId,
            regionalId: serieBaseData.regionalId,
            administracaoId: serieBaseData.administracaoId,
            setorId: serieBaseData.setorId,
            casaId: serieBaseData.casaId,
            grupoTrabalhoId: serieBaseData.grupoTrabalhoId,
            observacoes: serieBaseData.observacoes,
            ativo: serieBaseData.ativo ?? true,
            
            inicioEm: occ.inicioEm,
            fimEm: occ.fimEm,
            
            serieRecorrenciaId: newSerieId,
            recorrenciaOrigemInicioEm: occ.inicioEm,
            recorrenciaExcecao: false,
            createdAt: nowIso,
            updatedAt: nowIso
          }
        })
      
      await executeAtomic(db, (qdb) => {
        const queries = []
        // 1. Atualizar Série A. Se o pivô for a primeira ocorrência,
        // não persistir dataFim anterior a dataInicio: a série antiga fica inativa.
        const splitNaPrimeiraOcorrencia = newStartDateStr <= existingSerie.dataInicio
        queries.push(
          qdb.update(seriesRecorrencia)
            .set(
              splitNaPrimeiraOcorrencia
                ? { ativo: false, updatedAt: nowIso }
                : { dataFim: oldEndDateStr, updatedAt: nowIso }
            )
            .where(eq(seriesRecorrencia.id, serieId))
        )
          
        // 2. Criar Série B
        const resultSerieB = { id: newSerieId, ...serieBData, createdAt: nowIso, updatedAt: nowIso }
        queries.push(qdb.insert(seriesRecorrencia).values(resultSerieB))
        
        // 3. Atualizar as EXCEÇÕES futuras (e a própria pivot se for exceção) para apontar para a Série B
        // As ocorrências normais serão inativadas e recriadas.
        // Assim respeitamos a regra de que as ocorrências velhas (não exceção) devem ser inativadas sem DELETE.
        
        queries.push(
          qdb.update(eventos)
            .set({ serieRecorrenciaId: newSerieId, updatedAt: nowIso })
            .where(and(
              eq(eventos.serieRecorrenciaId, serieId),
              gte(
                sql`COALESCE(${eventos.recorrenciaOrigemInicioEm}, ${eventos.inicioEm})`,
                pivotDateIso
              ),
              eq(eventos.recorrenciaExcecao, true)
            ))
        )
        
        // 4. Inativar ocorrências normais da Série A a partir do pivot
        queries.push(
          qdb.update(eventos)
            .set({ ativo: false, updatedAt: nowIso })
            .where(and(
              eq(eventos.serieRecorrenciaId, serieId),
              gte(eventos.inicioEm, pivotDateIso),
              eq(eventos.recorrenciaExcecao, false),
              eq(eventos.ativo, true)
            ))
        )
          
        // 5. Inserir eventos gerados
        if (eventosToInsert.length > 0) {
          queries.push(qdb.insert(eventos).values(eventosToInsert))
        }
        
        return queries
      })
      
      return c.json({ message: 'Série dividida e eventos atualizados', novaSerieId: newSerieId })
    }

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
