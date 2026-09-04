import { Hono } from 'hono'
import { eq, and, inArray } from 'drizzle-orm'
import { convocacoes, convocacaoFuncoes, convocacaoDestinatarios, eventos, vinculosFuncionais, membros, funcoes } from '../db/schema'
import { ConvocacaoCreate, ConvocacaoUpdate, ConvocacaoFuncaoCreate } from '@piedade/shared'
import { executeAtomic } from '../db/batch'

export const convocacoesRouter = new Hono<any>()

convocacoesRouter.get('/', async (c) => {
  const db = c.get('db')
  const data = await db.select().from(convocacoes).all()
  return c.json(data)
})

convocacoesRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  
  if (!data) return c.json({ error: 'Convocação não encontrada' }, 404)
  return c.json(data)
})

convocacoesRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = ConvocacaoCreate.parse(body)
    
    // Validate if evento exists
    const evento = await db.select().from(eventos).where(eq(eventos.id, parsed.eventoId)).get()
    if (!evento) return c.json({ error: 'Evento não encontrado' }, 404)

    const convocacaoId = crypto.randomUUID()
    const nowIso = new Date().toISOString()
    
    const resultConvocacao = {
      id: convocacaoId,
      eventoId: parsed.eventoId,
      observacoes: parsed.observacoes,
      status: 'RASCUNHO',
      ativo: true,
      createdAt: nowIso,
      updatedAt: nowIso
    }
    
    await executeAtomic(db, (qdb) => {
      return [qdb.insert(convocacoes).values(resultConvocacao)]
    })

    return c.json(resultConvocacao, 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

convocacoesRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  
  try {
    const body = await c.req.json()
    const parsed = ConvocacaoUpdate.parse(body)
    
    const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
    if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
    if (convocacao.status !== 'RASCUNHO') return c.json({ error: 'Apenas convocações em RASCUNHO podem ser alteradas' }, 400)
    
    const nowIso = new Date().toISOString()
    await executeAtomic(db, (qdb) => {
      return [qdb.update(convocacoes).set({ observacoes: parsed.observacoes, updatedAt: nowIso }).where(eq(convocacoes.id, id))]
    })

    const updated = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

convocacoesRouter.get('/:id/funcoes', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(convocacaoFuncoes).where(eq(convocacaoFuncoes.convocacaoId, id)).all()
  return c.json(data)
})

convocacoesRouter.post('/:id/funcoes', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  
  try {
    const body = await c.req.json()
    const parsed = ConvocacaoFuncaoCreate.parse(body)
    
    const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
    if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
    if (convocacao.status !== 'RASCUNHO') return c.json({ error: 'Não é possível alterar funções fora do status RASCUNHO' }, 400)
    
    const funcaoObj = await db.select().from(funcoes).where(eq(funcoes.id, parsed.funcaoId)).get()
    if (!funcaoObj) return c.json({ error: 'Função não encontrada' }, 404)

    const funcaoId = crypto.randomUUID()
    const nowIso = new Date().toISOString()
    
    const resultFuncao = {
      id: funcaoId,
      convocacaoId: id,
      funcaoId: parsed.funcaoId,
      createdAt: nowIso
    }

    await executeAtomic(db, (qdb) => {
      return [qdb.insert(convocacaoFuncoes).values(resultFuncao)]
    })

    return c.json(resultFuncao, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Função já adicionada a esta convocação' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

convocacoesRouter.delete('/:id/funcoes/:funcaoId', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const funcaoId = c.req.param('funcaoId')
  
  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
  if (convocacao.status !== 'RASCUNHO') return c.json({ error: 'Não é possível remover funções fora do status RASCUNHO' }, 400)
  
  await executeAtomic(db, (qdb) => {
    return [qdb.delete(convocacaoFuncoes).where(and(eq(convocacaoFuncoes.convocacaoId, id), eq(convocacaoFuncoes.funcaoId, funcaoId)))]
  })

  return c.json({ success: true })
})

convocacoesRouter.post('/:id/publicar', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  
  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
  if (convocacao.status !== 'RASCUNHO') return c.json({ error: 'Apenas convocações em RASCUNHO podem ser publicadas' }, 400)
  
  const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
  if (!evento || !evento.ativo) return c.json({ error: 'Evento associado não existe ou inativo' }, 400)
  
  const funcoesConvocadas = await db.select().from(convocacaoFuncoes).where(eq(convocacaoFuncoes.convocacaoId, id)).all()
  if (funcoesConvocadas.length === 0) return c.json({ error: 'É necessário ter pelo menos uma função associada para publicar' }, 400)
  
  const funcaoIds = funcoesConvocadas.map((f: { funcaoId: string }) => f.funcaoId)
  
  // Validar se todas as funções existem e estão ativas
  const funcoesAtivas = await db.select().from(funcoes).where(inArray(funcoes.id, funcaoIds)).all()
  if (funcoesAtivas.length !== funcaoIds.length) {
    return c.json({ error: 'Uma ou mais funções associadas não existem' }, 400)
  }
  const algumaInativa = funcoesAtivas.some((f: { ativo: boolean }) => !f.ativo)
  if (algumaInativa) {
    return c.json({ error: 'Uma ou mais funções associadas estão inativas' }, 400)
  }

  // Derivação dos destinatários
  // Condições: vinculo ativo, membro ativo, escopo bate com evento, funcaoId IN funcaoIds
  const conditions = [
    eq(vinculosFuncionais.ativo, true),
    eq(membros.ativo, true),
    inArray(vinculosFuncionais.funcaoId, funcaoIds)
  ]
  
  if (evento.regionalId) conditions.push(eq(vinculosFuncionais.regionalId, evento.regionalId))
  if (evento.administracaoId) conditions.push(eq(vinculosFuncionais.administracaoId, evento.administracaoId))
  if (evento.setorId) conditions.push(eq(vinculosFuncionais.setorId, evento.setorId))
  if (evento.casaId) conditions.push(eq(vinculosFuncionais.casaId, evento.casaId))
  if (evento.grupoTrabalhoId) conditions.push(eq(vinculosFuncionais.grupoTrabalhoId, evento.grupoTrabalhoId))
  
  // Realiza query juntando vinculosFuncionais e membros
  const destinatariosValidos = await db.select({
    membroId: membros.id,
    funcaoId: vinculosFuncionais.funcaoId,
    vinculoId: vinculosFuncionais.id
  })
  .from(vinculosFuncionais)
  .innerJoin(membros, eq(membros.id, vinculosFuncionais.membroId))
  .where(and(...conditions))
  .all()
  
  const nowIso = new Date().toISOString()
  
  const destinatariosToInsert = destinatariosValidos.map((dest: { membroId: string; funcaoId: string; vinculoId: string }) => ({
    id: crypto.randomUUID(),
    convocacaoId: id,
    membroId: dest.membroId,
    funcaoId: dest.funcaoId,
    vinculoFuncionalId: dest.vinculoId,
    createdAt: nowIso
  }))

  try {
    await executeAtomic(db, (qdb) => {
      const queries = []
      queries.push(
        qdb.update(convocacoes)
          .set({ status: 'PUBLICADA', publicadaEm: nowIso, updatedAt: nowIso })
          .where(eq(convocacoes.id, id))
      )
      if (destinatariosToInsert.length > 0) {
        queries.push(qdb.insert(convocacaoDestinatarios).values(destinatariosToInsert))
      }
      return queries
    })
    
    return c.json({ success: true, destinatariosGerados: destinatariosToInsert.length })
  } catch {
    return c.json({ error: 'Falha ao materializar destinatários' }, 400)
  }
})

convocacoesRouter.post('/:id/cancelar', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  
  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
  if (convocacao.status === 'CANCELADA') return c.json({ error: 'Convocação já está cancelada' }, 400)
  
  const nowIso = new Date().toISOString()
  await executeAtomic(db, (qdb) => {
    return [
      qdb.update(convocacoes)
        .set({ status: 'CANCELADA', canceladaEm: nowIso, ativo: false, updatedAt: nowIso })
        .where(eq(convocacoes.id, id))
    ]
  })
  
  return c.json({ success: true })
})

convocacoesRouter.get('/:id/destinatarios', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(convocacaoDestinatarios).where(eq(convocacaoDestinatarios.convocacaoId, id)).all()
  return c.json(data)
})
