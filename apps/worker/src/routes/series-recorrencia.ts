import { Hono } from 'hono'
import { eq, and, gt, gte, lte } from 'drizzle-orm'
import { eventos, seriesRecorrencia } from '../db/schema'
import { SerieCreate, SerieUpdatePayload, generateOccurrences } from '@piedade/shared'

export const seriesRecorrenciaRouter = new Hono<any>()

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

  return c.json(data)
})

seriesRecorrenciaRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(seriesRecorrencia).where(eq(seriesRecorrencia.id, id)).get()
  
  if (!data) return c.json({ error: 'Série não encontrada' }, 404)
  return c.json(data)
})

seriesRecorrenciaRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = SerieCreate.parse(body)
    
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
        recorrenciaExcecao: false,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    })

    // Transação Drizzle para garantir Atomicidade (já suportada nativamente ou por batching)
    // O D1 suporta .batch(), que é preferível no Cloudflare. 
    // Para simplificar localmente com SQLite e D1, podemos usar tx ou apenas realizar em lote:
    await db.transaction(async (tx: any) => {
      await tx.insert(seriesRecorrencia).values(resultSerie).run()
      if (eventosToInsert.length > 0) {
        await tx.insert(eventos).values(eventosToInsert).run()
      }
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
    
    const nowIso = new Date().toISOString()
    
    if (parsed.updateMode === 'THIS') {
      if (!parsed.fromEventId) return c.json({ error: 'fromEventId obrigatório' }, 400)
      
      const existingEvent = await db.select().from(eventos).where(eq(eventos.id, parsed.fromEventId)).get()
      if (!existingEvent || existingEvent.serieRecorrenciaId !== serieId) {
         return c.json({ error: 'Evento origem não encontrado ou não pertence a esta série' }, 400)
      }
      
      const updatedEvent = await db.update(eventos)
        .set({ ...parsed.changes, recorrenciaExcecao: true, updatedAt: nowIso })
        .where(eq(eventos.id, parsed.fromEventId))
        .returning().get()
        
      return c.json({ message: 'Evento atualizado individualmente', event: updatedEvent })
    }
    
    if (parsed.updateMode === 'ALL') {
      const mergedSerieData = { ...existingSerie, ...parsed.changes }
      // Validar nova série
      SerieCreate.parse(mergedSerieData)
      
      // Encontrar todos os eventos da série no futuro que NÃO SÃO exceção, e no passado (passado a gente não mexe, futuro a gente recalcula)
      // Recalcular pode ser complexo. Se a regra da série mudar (frequencia), precisamos apagar os não-exceção futuros e recriar.
      // Se for apenas título, podemos dar um update em todos não-exceção.
      
      // Solução universal robusta:
      // 1. Apagar eventos futuros (inicioEm >= agora) que não são exceção
      // 2. Gerar eventos futuros a partir da mergedSerieData
      
      await db.transaction(async (tx: any) => {
        // Atualiza a série
        await tx.update(seriesRecorrencia)
          .set({ ...parsed.changes, updatedAt: nowIso })
          .where(eq(seriesRecorrencia.id, serieId))
          .run()
          
        // Exclui os eventos que iam acontecer e que não foram modificados individualmente
        await tx.delete(eventos)
          .where(and(
            eq(eventos.serieRecorrenciaId, serieId),
            gte(eventos.inicioEm, nowIso),
            eq(eventos.recorrenciaExcecao, false)
          ))
          .run()
          
        // Agora, se a dataInicio do mergeSerieData for no passado, o recurrence-engine vai calcular todos.
        // Devemos apenas inserir os eventos cuja data é >= nowIso.
        const occurrencesDates = generateOccurrences(mergedSerieData)
        const futureOccurrences = occurrencesDates.filter(occ => occ.inicioEm >= nowIso)
        
        const eventosToInsert = futureOccurrences.map(occ => {
          return {
            id: crypto.randomUUID(),
            titulo: mergedSerieData.titulo,
            descricao: mergedSerieData.descricao,
            pauta: mergedSerieData.pauta,
            modalidade: mergedSerieData.modalidade,
            localId: mergedSerieData.localId,
            urlOnline: mergedSerieData.urlOnline,
            organizadorMembroId: mergedSerieData.organizadorMembroId,
            regionalId: mergedSerieData.regionalId,
            administracaoId: mergedSerieData.administracaoId,
            setorId: mergedSerieData.setorId,
            casaId: mergedSerieData.casaId,
            grupoTrabalhoId: mergedSerieData.grupoTrabalhoId,
            observacoes: mergedSerieData.observacoes,
            ativo: mergedSerieData.ativo ?? true,
            
            inicioEm: occ.inicioEm,
            fimEm: occ.fimEm,
            
            serieRecorrenciaId: serieId,
            recorrenciaExcecao: false,
            createdAt: nowIso,
            updatedAt: nowIso
          }
        })
        
        if (eventosToInsert.length > 0) {
          await tx.insert(eventos).values(eventosToInsert).run()
        }
      })
      
      return c.json({ message: 'Série inteira e futuros eventos atualizados com sucesso' })
    }
    
    if (parsed.updateMode === 'THIS_AND_FUTURE') {
      if (!parsed.fromEventId) return c.json({ error: 'fromEventId obrigatório' }, 400)
      
      const existingEvent = await db.select().from(eventos).where(eq(eventos.id, parsed.fromEventId)).get()
      if (!existingEvent || existingEvent.serieRecorrenciaId !== serieId) {
         return c.json({ error: 'Evento origem não encontrado ou não pertence a esta série' }, 400)
      }
      
      const pivotDateIso = existingEvent.inicioEm
      
      // Série B (Nova) = Merge (existingSerie + parsed.changes)
      // Ajustar a dataInicio da Série B para ser a mesma data em America/Sao_Paulo (pegamos do pivot)
      // A dataFim da Série B mantém a original (ou modificada)
      
      const newSerieId = crypto.randomUUID()
      const mergedSerieData = { ...existingSerie, ...parsed.changes }
      
      // Precisamos inferir a data de início (YYYY-MM-DD) do pivotDateIso
      // Na prática, basta passarmos a date-string original correspondente àquela ocorrência, 
      // mas como temos o UTC ISO: YYYY-MM-DDTHH:MM:SS, ele já aproxima bastante. 
      // A recurrence-engine pode ter uma defasagem. Vamos converter ISO UTC para o "YYYY-MM-DD" em SP (-3).
      const pivotDt = new Date(pivotDateIso)
      pivotDt.setUTCHours(pivotDt.getUTCHours() - 3) 
      const newStartDateStr = pivotDt.toISOString().split('T')[0]
      
      mergedSerieData.dataInicio = newStartDateStr
      SerieCreate.parse(mergedSerieData)
      
      // Série A (Antiga) termina no dia antes
      const prevDt = new Date(pivotDateIso)
      prevDt.setUTCDate(prevDt.getUTCDate() - 1)
      prevDt.setUTCHours(prevDt.getUTCHours() - 3)
      const oldEndDateStr = prevDt.toISOString().split('T')[0]
      
      await db.transaction(async (tx: any) => {
        // 1. Atualizar Série A
        await tx.update(seriesRecorrencia)
          .set({ dataFim: oldEndDateStr, updatedAt: nowIso })
          .where(eq(seriesRecorrencia.id, serieId))
          .run()
          
        // 2. Criar Série B
        const resultSerieB = { id: newSerieId, ...mergedSerieData, createdAt: nowIso, updatedAt: nowIso }
        await tx.insert(seriesRecorrencia).values(resultSerieB).run()
        
        // 3. Atualizar todos os eventos >= pivotDateIso (exceções ou não) para apontar para a nova Série B
        await tx.update(eventos)
          .set({ serieRecorrenciaId: newSerieId, updatedAt: nowIso })
          .where(and(
            eq(eventos.serieRecorrenciaId, serieId),
            gte(eventos.inicioEm, pivotDateIso)
          ))
          .run()
          
        // 4. Regenerar apenas os futuros eventos da Série B que NÃO SÃO EXCEÇÕES, pois a regra (horário, título) pode ter mudado.
        // Apaga os não exceção
        await tx.delete(eventos)
          .where(and(
            eq(eventos.serieRecorrenciaId, newSerieId),
            eq(eventos.recorrenciaExcecao, false)
          ))
          .run()
          
        // Recalcular e inserir
        const occurrencesDates = generateOccurrences(mergedSerieData)
        const eventosToInsert = occurrencesDates.map(occ => {
          return {
            id: crypto.randomUUID(),
            titulo: mergedSerieData.titulo,
            descricao: mergedSerieData.descricao,
            pauta: mergedSerieData.pauta,
            modalidade: mergedSerieData.modalidade,
            localId: mergedSerieData.localId,
            urlOnline: mergedSerieData.urlOnline,
            organizadorMembroId: mergedSerieData.organizadorMembroId,
            regionalId: mergedSerieData.regionalId,
            administracaoId: mergedSerieData.administracaoId,
            setorId: mergedSerieData.setorId,
            casaId: mergedSerieData.casaId,
            grupoTrabalhoId: mergedSerieData.grupoTrabalhoId,
            observacoes: mergedSerieData.observacoes,
            ativo: mergedSerieData.ativo ?? true,
            
            inicioEm: occ.inicioEm,
            fimEm: occ.fimEm,
            
            serieRecorrenciaId: newSerieId,
            recorrenciaExcecao: false,
            createdAt: nowIso,
            updatedAt: nowIso
          }
        })
        
        if (eventosToInsert.length > 0) {
          await tx.insert(eventos).values(eventosToInsert).run()
        }
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
