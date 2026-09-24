import { Hono } from 'hono'
import { eq, and, inArray, sql, asc } from 'drizzle-orm'
import {
  convocacoes,
  convocacaoFuncoes,
  convocacaoDestinatarios,
  convocacaoDestinatarioEvidencias,
  eventos,
  vinculosFuncionais,
  membros,
  funcoes,
  rsvp,
} from '../db/schema'
import { ConvocacaoCreate, ConvocacaoUpdate, ConvocacaoFuncaoCreate, AcompanhamentoRsvpQuerySchema } from '@piedade/shared'
import { executeAtomic } from '../db/batch'
import {
  criarAuditQuery,
  extrairEscopoDoEvento,
  executarOperacaoComAudit,
} from '../services/auditoria'
import {
  eGestorRelatoriosAutorizadoParaEvento,
  obterEscoposTerritoriaisVisiveis,
  podeGerenciarAgendaNoEscopo,
} from '../security/permissoes'
import { authMiddleware, Variables } from '../middleware/auth'

export const convocacoesRouter = new Hono<{ Variables: Variables }>()

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho))
  }
  return lotes
}

convocacoesRouter.use('*', authMiddleware)

function eventoVisivelNoEscopo(evento: any, escopos: any): boolean {
  if (escopos.tudo) return true
  if (evento.regionalId && escopos.regionaisIds.has(evento.regionalId)) return true
  if (evento.administracaoId && escopos.administracoesIds.has(evento.administracaoId)) return true
  if (evento.setorId && escopos.setoresIds.has(evento.setorId)) return true
  if (evento.casaId && escopos.casasIds.has(evento.casaId)) return true
  if (evento.grupoTrabalhoId && escopos.gruposTrabalhoIds.has(evento.grupoTrabalhoId)) return true
  return false
}

async function idsConvocacoesDoDestinatario(db: any, membroId: string): Promise<Set<string>> {
  const rows = await db
    .select({ convocacaoId: convocacaoDestinatarios.convocacaoId })
    .from(convocacaoDestinatarios)
    .where(eq(convocacaoDestinatarios.membroId, membroId))
    .all()

  return new Set(rows.map((row: { convocacaoId: string }) => row.convocacaoId))
}

function podeLerConvocacao(
  convocacao: any,
  evento: any,
  escopos: any,
  destinatarias: Set<string>
): boolean {
  if (evento && eventoVisivelNoEscopo(evento, escopos)) return true
  return destinatarias.has(convocacao.id)
}

async function podeGerirConvocacao(db: any, membroId: string, evento: any): Promise<boolean> {
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)
  if (!escopoTipo || !escopoId) return false
  return podeGerenciarAgendaNoEscopo(
    db,
    membroId,
    escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
    escopoId
  )
}

convocacoesRouter.get('/', async c => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const escopos = await obterEscoposTerritoriaisVisiveis(db, contexto)
  const destinatarias = await idsConvocacoesDoDestinatario(db, membroId)

  const data = await db
    .select({ convocacao: convocacoes, evento: eventos })
    .from(convocacoes)
    .innerJoin(eventos, eq(convocacoes.eventoId, eventos.id))
    .all()

  return c.json(
    data
      .filter((item: any) =>
        eventoVisivelNoEscopo(item.evento, escopos) || destinatarias.has(item.convocacao.id)
      )
      .map((item: any) => item.convocacao)
  )
})

convocacoesRouter.get('/:id', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()

  if (!data) return c.json({ error: 'Convocação não encontrada' }, 404)

  const evento = await db.select().from(eventos).where(eq(eventos.id, data.eventoId)).get()
  const escopos = await obterEscoposTerritoriaisVisiveis(db, c.get('contextoPermissoes'))
  const destinatarias = await idsConvocacoesDoDestinatario(db, c.get('membroId'))

  if (!podeLerConvocacao(data, evento, escopos, destinatarias)) {
    return c.json({ error: 'Acesso não autorizado para esta convocação', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

convocacoesRouter.post('/', async c => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = ConvocacaoCreate.parse(body)

    // Validate if evento exists
    const evento = await db.select().from(eventos).where(eq(eventos.id, parsed.eventoId)).get()
    if (!evento) return c.json({ error: 'Evento não encontrado' }, 404)

    const membroId = c.get('membroId')
    if (!membroId || !(await podeGerirConvocacao(db, membroId, evento))) {
      return c.json({ error: 'Acesso não autorizado para gerir a convocação', code: 'FORBIDDEN' }, 403)
    }

    const convocacaoId = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    const resultConvocacao = {
      id: convocacaoId,
      eventoId: parsed.eventoId,
      observacoes: parsed.observacoes,
      status: 'RASCUNHO',
      ativo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    await executeAtomic(db, qdb => {
      return [qdb.insert(convocacoes).values(resultConvocacao)]
    })

    return c.json(resultConvocacao, 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

convocacoesRouter.patch('/:id', async c => {
  const db = c.get('db')
  const id = c.req.param('id')

  try {
    const body = await c.req.json()
    const parsed = ConvocacaoUpdate.parse(body)

    const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
    if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
    const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
    const membroId = c.get('membroId')
    if (!evento || !membroId || !(await podeGerirConvocacao(db, membroId, evento))) {
      return c.json({ error: 'Acesso não autorizado para gerir a convocação', code: 'FORBIDDEN' }, 403)
    }
    if (convocacao.status !== 'RASCUNHO')
      return c.json({ error: 'Apenas convocações em RASCUNHO podem ser alteradas' }, 400)

    const nowIso = new Date().toISOString()
    const updated = await db
      .update(convocacoes)
      .set({ observacoes: parsed.observacoes, updatedAt: nowIso })
      .where(
        and(
          eq(convocacoes.id, id),
          eq(convocacoes.status, 'RASCUNHO'),
          eq(convocacoes.updatedAt, convocacao.updatedAt)
        )
      )
      .returning()
      .get()

    if (!updated) {
      return c.json(
        { error: 'Conflito: a convocação deixou de ser um rascunho ou foi alterada por outra operação.' },
        409
      )
    }

    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

convocacoesRouter.get('/:id/funcoes', async c => {
  const db = c.get('db')
  const id = c.req.param('id')

  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)

  const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
  const escopos = await obterEscoposTerritoriaisVisiveis(db, c.get('contextoPermissoes'))
  const destinatarias = await idsConvocacoesDoDestinatario(db, c.get('membroId'))
  if (!podeLerConvocacao(convocacao, evento, escopos, destinatarias)) {
    return c.json({ error: 'Acesso não autorizado para esta convocação', code: 'FORBIDDEN' }, 403)
  }

  const data = await db
    .select()
    .from(convocacaoFuncoes)
    .where(eq(convocacaoFuncoes.convocacaoId, id))
    .all()
  return c.json(data)
})

convocacoesRouter.post('/:id/funcoes', async c => {
  const db = c.get('db')
  const id = c.req.param('id')

  try {
    const body = await c.req.json()
    const parsed = ConvocacaoFuncaoCreate.parse(body)

    const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
    if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
    const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
    const membroId = c.get('membroId')
    if (!evento || !membroId || !(await podeGerirConvocacao(db, membroId, evento))) {
      return c.json({ error: 'Acesso não autorizado para gerir a convocação', code: 'FORBIDDEN' }, 403)
    }
    if (convocacao.status !== 'RASCUNHO')
      return c.json({ error: 'Não é possível alterar funções fora do status RASCUNHO' }, 400)

    const funcaoObj = await db.select().from(funcoes).where(eq(funcoes.id, parsed.funcaoId)).get()
    if (!funcaoObj) return c.json({ error: 'Função não encontrada' }, 404)

    const funcaoId = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    const resultFuncao = {
      id: funcaoId,
      convocacaoId: id,
      funcaoId: parsed.funcaoId,
      createdAt: nowIso,
    }

    await executeAtomic(db, qdb => {
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

convocacoesRouter.delete('/:id/funcoes/:funcaoId', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const funcaoId = c.req.param('funcaoId')

  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
  const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
  const membroId = c.get('membroId')
  if (!evento || !membroId || !(await podeGerirConvocacao(db, membroId, evento))) {
    return c.json({ error: 'Acesso não autorizado para gerir a convocação', code: 'FORBIDDEN' }, 403)
  }
  if (convocacao.status !== 'RASCUNHO')
    return c.json({ error: 'Não é possível remover funções fora do status RASCUNHO' }, 400)

  await executeAtomic(db, qdb => {
    return [
      qdb
        .delete(convocacaoFuncoes)
        .where(
          and(eq(convocacaoFuncoes.convocacaoId, id), eq(convocacaoFuncoes.funcaoId, funcaoId))
        ),
    ]
  })

  return c.json({ success: true })
})

convocacoesRouter.post('/:id/publicar', async c => {
  const db = c.get('db')
  const id = c.req.param('id')

  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
  if (convocacao.status !== 'RASCUNHO')
    return c.json({ error: 'Apenas convocações em RASCUNHO podem ser publicadas' }, 400)

  const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
  if (!evento || !evento.ativo)
    return c.json({ error: 'Evento associado não existe ou inativo' }, 400)

  const membroId = c.get('membroId')
  if (!membroId || !(await podeGerirConvocacao(db, membroId, evento))) {
    return c.json({ error: 'Acesso não autorizado para gerir a convocação', code: 'FORBIDDEN' }, 403)
  }

  const funcoesConvocadas = await db
    .select()
    .from(convocacaoFuncoes)
    .where(eq(convocacaoFuncoes.convocacaoId, id))
    .all()
  if (funcoesConvocadas.length === 0)
    return c.json({ error: 'É necessário ter pelo menos uma função associada para publicar' }, 400)

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
    inArray(vinculosFuncionais.funcaoId, funcaoIds),
  ]

  if (evento.regionalId) conditions.push(eq(vinculosFuncionais.regionalId, evento.regionalId))
  if (evento.administracaoId)
    conditions.push(eq(vinculosFuncionais.administracaoId, evento.administracaoId))
  if (evento.setorId) conditions.push(eq(vinculosFuncionais.setorId, evento.setorId))
  if (evento.casaId) conditions.push(eq(vinculosFuncionais.casaId, evento.casaId))
  if (evento.grupoTrabalhoId)
    conditions.push(eq(vinculosFuncionais.grupoTrabalhoId, evento.grupoTrabalhoId))

  // Realiza query juntando vinculosFuncionais e membros
  const destinatariosValidos = await db
    .select({
      membroId: membros.id,
      funcaoId: vinculosFuncionais.funcaoId,
      vinculoId: vinculosFuncionais.id,
    })
    .from(vinculosFuncionais)
    .innerJoin(membros, eq(membros.id, vinculosFuncionais.membroId))
    .where(and(...conditions))
    .all()

  const nowIso = new Date().toISOString()

  // Agrupar por membroId para criar destinatários lógicos únicos
  const agrupadoPorMembro = new Map<string, { funcaoId: string; vinculoId: string }[]>()

  for (const dest of destinatariosValidos) {
    if (!agrupadoPorMembro.has(dest.membroId)) {
      agrupadoPorMembro.set(dest.membroId, [])
    }
    agrupadoPorMembro
      .get(dest.membroId)!
      .push({ funcaoId: dest.funcaoId, vinculoId: dest.vinculoId })
  }

  const destinatariosToInsert: (typeof convocacaoDestinatarios.$inferInsert)[] = []
  const evidenciasToInsert: (typeof convocacaoDestinatarioEvidencias.$inferInsert)[] = []

  for (const [membroId, evidencias] of agrupadoPorMembro.entries()) {
    const destId = crypto.randomUUID()
    destinatariosToInsert.push({
      id: destId,
      convocacaoId: id,
      membroId,
      createdAt: nowIso,
    })

    // Deduplicar evidências exatas
    const evidenciasUnicas = new Set<string>()
    for (const ev of evidencias) {
      const key = `${ev.funcaoId}_${ev.vinculoId}`
      if (!evidenciasUnicas.has(key)) {
        evidenciasUnicas.add(key)
        evidenciasToInsert.push({
          id: crypto.randomUUID(),
          convocacaoDestinatarioId: destId,
          funcaoId: ev.funcaoId,
          vinculoFuncionalId: ev.vinculoId,
          createdAt: nowIso,
        })
      }
    }
  }

  try {
    const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)
    const atorMembroId = c.get('membroId') || null

    await executeAtomic(db, qdb => {
      const queries = []

      // 1. UPDATE OTIMISTA
      // Só atualiza se o updatedAt não foi modificado concorrentemente
      queries.push(
        qdb
          .update(convocacoes)
          .set({ status: 'PUBLICADA', publicadaEm: nowIso, updatedAt: nowIso })
          .where(
            and(
              eq(convocacoes.id, id),
              eq(convocacoes.status, 'RASCUNHO'),
              eq(convocacoes.updatedAt, convocacao.updatedAt)
            )
          )
      )

      // 2. INSERÇÕES em lotes abaixo do limite de parâmetros do D1.
      // Destinatário: 4 valores vinculados por linha; evidência: 5.
      for (const lote of emLotes(destinatariosToInsert, 20)) {
        queries.push(qdb.insert(convocacaoDestinatarios).values(lote))
      }
      for (const lote of emLotes(evidenciasToInsert, 15)) {
        queries.push(qdb.insert(convocacaoDestinatarioEvidencias).values(lote))
      }

      // 3. AUDITORIA
      queries.push(
        criarAuditQuery(qdb, {
          acao: 'CONVOCACAO_PUBLICADA',
          atorMembroId,
          recursoTipo: 'CONVOCACAO',
          recursoId: id,
          escopoTipo,
          escopoId,
          contexto: {
            eventoId: convocacao.eventoId,
            totalDestinatarios: destinatariosToInsert.length,
          },
        })
      )

      // 4. ABORTO CONDICIONAL VIA CONSTRAINT
      // Se a row não foi atualizada no passo 1 (concorrência), o updatedAt ainda é antigo.
      // Nesse caso, injetamos 'ABORT_OCC' no status, forçando o D1 a lançar CHECK constraint failed e abortar tudo.
      queries.push(
        qdb
          .update(convocacoes)
          .set({
            status:
              sql`CASE WHEN ${convocacoes.updatedAt} = ${nowIso} THEN ${convocacoes.status} ELSE 'ABORT_OCC' END` as any,
          })
          .where(eq(convocacoes.id, id))
      )

      return queries
    })

    return c.json({ success: true, destinatariosGerados: destinatariosToInsert.length })
  } catch (err: any) {
    if (err.message && err.message.includes('check_status_convocacao')) {
      return c.json(
        { error: 'Conflito: a convocação foi alterada enquanto o snapshot era processado.' },
        409
      )
    }
    return c.json({ error: 'Falha ao materializar destinatários' }, 400)
  }
})

convocacoesRouter.post('/:id/cancelar', async c => {
  const db = c.get('db')
  const id = c.req.param('id')

  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
  if (convocacao.status === 'CANCELADA')
    return c.json({ error: 'Convocação já está cancelada' }, 400)

  const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
  const atorMembroId = c.get('membroId') || null
  if (!evento || !atorMembroId || !(await podeGerirConvocacao(db, atorMembroId, evento))) {
    return c.json({ error: 'Acesso não autorizado para gerir a convocação', code: 'FORBIDDEN' }, 403)
  }
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  const nowIso = new Date().toISOString()
  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb
        .update(convocacoes)
        .set({ status: 'CANCELADA', canceladaEm: nowIso, ativo: false, updatedAt: nowIso })
        .where(eq(convocacoes.id, id)),
    ],
    {
      acao: 'CONVOCACAO_CANCELADA',
      atorMembroId,
      recursoTipo: 'CONVOCACAO',
      recursoId: id,
      escopoTipo,
      escopoId,
      contexto: {
        eventoId: convocacao.eventoId,
      },
    }
  )

  return c.json({ success: true })
})

convocacoesRouter.get('/:id/destinatarios', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const destinatarios = await db
    .select()
    .from(convocacaoDestinatarios)
    .where(eq(convocacaoDestinatarios.convocacaoId, id))
    .all()
  if (destinatarios.length === 0) return c.json([])

  const destIds = destinatarios.map((d: any) => d.id)
  const evidencias = await db
    .select()
    .from(convocacaoDestinatarioEvidencias)
    .where(inArray(convocacaoDestinatarioEvidencias.convocacaoDestinatarioId, destIds))
    .all()

  const resultado = destinatarios.map((d: any) => ({
    ...d,
    evidencias: evidencias.filter((e: any) => e.convocacaoDestinatarioId === d.id),
  }))

  return c.json(resultado)
})

convocacoesRouter.get('/:id/acompanhamento-rsvp', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const membroId = c.get('membroId')

  if (!membroId) return c.json({ error: 'Sessão indisponível' }, 500)

  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
  if (convocacao.status !== 'PUBLICADA') return c.json({ error: 'Acompanhamento disponível apenas para convocações PUBLICADAS' }, 400)

  const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404)

  const autorizado = await eGestorRelatoriosAutorizadoParaEvento(db, membroId, evento)
  if (!autorizado) return c.json({ error: 'Acesso não autorizado para acompanhar RSVP desta convocação' }, 403)

  const query = c.req.query()
  const parsedQuery = AcompanhamentoRsvpQuerySchema.safeParse(query)
  if (!parsedQuery.success) {
    return c.json({ error: parsedQuery.error.issues }, 400)
  }
  
  const { page, limit, statusRsvp } = parsedQuery.data
  const offset = (page - 1) * limit

  const conditions = [eq(convocacaoDestinatarios.convocacaoId, id)]
  if (statusRsvp) {
    if (statusRsvp === 'SEM_RESPOSTA') {
      conditions.push(sql`${rsvp.resposta} IS NULL`)
    } else {
      conditions.push(eq(rsvp.resposta, statusRsvp))
    }
  }

  const countQuery = await db.select({ total: sql<number>`count(*)` })
    .from(convocacaoDestinatarios)
    .leftJoin(rsvp, eq(rsvp.convocacaoDestinatarioId, convocacaoDestinatarios.id))
    .where(and(...conditions))
    .get()
  
  const total = countQuery?.total || 0
  const lastPage = Math.ceil(total / limit) || 1

  const destinatariosPage = await db
    .select({
      destinatarioId: convocacaoDestinatarios.id,
      membroId: membros.id,
      membroNome: membros.nome,
      respostaRsvp: sql`COALESCE(${rsvp.resposta}, 'SEM_RESPOSTA')`.as('respostaRsvp')
    })
    .from(convocacaoDestinatarios)
    .innerJoin(membros, eq(membros.id, convocacaoDestinatarios.membroId))
    .leftJoin(rsvp, eq(rsvp.convocacaoDestinatarioId, convocacaoDestinatarios.id))
    .where(and(...conditions))
    .orderBy(asc(membros.nome), asc(convocacaoDestinatarios.id))
    .limit(limit)
    .offset(offset)
    .all()

  if (destinatariosPage.length === 0) {
    return c.json({
      data: [],
      meta: { total, page, lastPage }
    })
  }

  type DestinatarioPage = {
    destinatarioId: string
    membroId: string
    membroNome: string
    respostaRsvp: string
  }
  type EvidenciaItem = {
    convocacaoDestinatarioId: string
    funcaoId: string
    vinculoFuncionalId: string
  }

  const destIds = destinatariosPage.map((d: DestinatarioPage) => d.destinatarioId)
  const evidencias = await db
    .select({
      convocacaoDestinatarioId: convocacaoDestinatarioEvidencias.convocacaoDestinatarioId,
      funcaoId: convocacaoDestinatarioEvidencias.funcaoId,
      vinculoFuncionalId: convocacaoDestinatarioEvidencias.vinculoFuncionalId
    })
    .from(convocacaoDestinatarioEvidencias)
    .where(inArray(convocacaoDestinatarioEvidencias.convocacaoDestinatarioId, destIds))
    .all()

  const data = destinatariosPage.map((d: DestinatarioPage) => ({
    destinatarioId: d.destinatarioId,
    membroId: d.membroId,
    membroNome: d.membroNome,
    respostaRsvp: d.respostaRsvp,
    evidencias: evidencias
      .filter((e: EvidenciaItem) => e.convocacaoDestinatarioId === d.destinatarioId)
      .map((e: EvidenciaItem) => ({
        funcaoId: e.funcaoId,
        vinculoFuncionalId: e.vinculoFuncionalId
      }))
  }))

  return c.json({
    data,
    meta: { total, page, lastPage }
  })
})
