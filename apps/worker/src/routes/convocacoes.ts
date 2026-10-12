import { Hono } from 'hono'
import { eq, and, or, inArray, sql, asc } from 'drizzle-orm'
import {
  convocacoes,
  convocacaoFuncoes,
  convocacaoDestinatarios,
  convocacaoDestinatarioEvidencias,
  eventos,
  vinculosFuncionais,
  casas,
  setores,
  administracoes,
  regionais,
  membros,
  funcoes,
  rsvp,
} from '../db/schema'
import { ConvocacaoCreate, ConvocacaoUpdate, ConvocacaoFuncaoCreate, AcompanhamentoRsvpQuerySchema } from '@piedade/shared'
import { executeAtomic } from '../db/batch'
import { queriesSincronizacaoDcoAtual } from '../services/sincronizacao-dco'
import {
  criarAuditQuery,
  extrairEscopoDoEvento,
  executarOperacaoComAudit,
} from '../services/auditoria'
import { eGestorRelatoriosAutorizadoParaEvento } from '../security/permissoes'
import { condicaoEventosVisiveis, podeLerEvento, podeGerenciarEvento } from '../security/eventos'
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

function hierarquiaVinculo(escopoTipo: string | null) {
  if (escopoTipo === 'REGIONAL' || escopoTipo === 'GRUPO_TRABALHO') return 4
  if (escopoTipo === 'ADMINISTRACAO') return 3
  if (escopoTipo === 'SETOR') return 2
  if (escopoTipo === 'CASA') return 1
  return 0
}

function escolherMaiorVinculo<T extends {
  funcaoNome: string | null
  escopoTipo: string | null
  [key: string]: unknown
}>(vinculos: T[]): T | null {
  return [...vinculos].sort((a, b) => {
    const nivel = hierarquiaVinculo(b.escopoTipo) - hierarquiaVinculo(a.escopoTipo)
    if (nivel !== 0) return nivel
    return (a.funcaoNome ?? '').localeCompare(b.funcaoNome ?? '', 'pt-BR')
  })[0] ?? null
}


async function podeGerirConvocacao(db: any, membroId: string, evento: any): Promise<boolean> {
  return !evento.pessoal && podeGerenciarEvento(db, membroId, evento)
}

convocacoesRouter.get('/', async c => {
  const db = c.get('db')
  const condicao = await condicaoEventosVisiveis(db, c.get('contextoPermissoes'))
  const data = await db.select({
    convocacao: convocacoes,
    possuiFuncaoDco: sql<number>`EXISTS (
      SELECT 1 FROM ${convocacaoFuncoes} cf
      JOIN ${funcoes} f ON f.id = cf.funcao_id
      WHERE cf.convocacao_id = ${convocacoes.id}
      AND f.codigo = 'DCO' AND f.ativo = 1
    )`,
  })
    .from(convocacoes)
    .innerJoin(eventos, eq(convocacoes.eventoId, eventos.id))
    .where(condicao)
    .all()
  return c.json(data.map((item: any) => ({
    ...item.convocacao, possuiFuncaoDco: Boolean(item.possuiFuncaoDco),
  })))
})

convocacoesRouter.get('/:id', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()

  if (!data) return c.json({ error: 'Convocação não encontrada' }, 404)

  const evento = await db.select().from(eventos).where(eq(eventos.id, data.eventoId)).get()

  if (!evento || !(await podeLerEvento(db, c.get('contextoPermissoes'), evento.id))) {
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
    const evento = await db
      .select()
      .from(eventos)
      .where(and(eq(eventos.id, parsed.eventoId), eq(eventos.ativo, true)))
      .get()
    if (!evento) return c.json({ error: 'Evento não encontrado ou inativo' }, 409)

    const membroId = c.get('membroId')
    if (!membroId || !(await podeGerenciarEvento(db, membroId, evento))) {
      return c.json({ error: 'Acesso não autorizado para gerir a convocação', code: 'FORBIDDEN' }, 403)
    }
    if (evento.pessoal) {
      return c.json({
        error: 'Evento Próprio entra diretamente na agenda e não recebe convocação',
        code: 'EVENTO_PESSOAL_SEM_CONVOCACAO'
      }, 409)
    }
    if (!(await podeGerirConvocacao(db, membroId, evento))) {
      return c.json({ error: 'Acesso não autorizado para gerir a convocação', code: 'FORBIDDEN' }, 403)
    }

    const convocacaoExistente = await db
      .select({ id: convocacoes.id, status: convocacoes.status })
      .from(convocacoes)
      .where(eq(convocacoes.eventoId, parsed.eventoId))
      .get()

    if (convocacaoExistente) {
      return c.json(
        {
          error: 'Este evento já possui convocação',
          code: 'CONVOCACAO_EVENTO_EXISTENTE',
          convocacaoId: convocacaoExistente.id,
          status: convocacaoExistente.status,
        },
        409
      )
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

    const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)
    await executarOperacaoComAudit(
      db,
      qdb => [qdb.insert(convocacoes).values(resultConvocacao)],
      {
        acao: 'CONVOCACAO_CRIADA',
        atorMembroId: membroId,
        recursoTipo: 'CONVOCACAO',
        recursoId: convocacaoId,
        escopoTipo,
        escopoId,
        contexto: { eventoId: parsed.eventoId },
      }
    )

    return c.json(resultConvocacao, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('CONVOCACAO_EM_EVENTO_INATIVO')) {
      return c.json({ error: 'Evento associado não existe ou inativo' }, 409)
    }
    if (
      err.message &&
      (
        err.message.includes('UNIQUE constraint failed: convocacoes.evento_id') ||
        err.message.includes('idx_convocacoes_evento_unico')
      )
    ) {
      return c.json(
        { error: 'Este evento já possui convocação', code: 'CONVOCACAO_EVENTO_EXISTENTE' },
        409
      )
    }
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
    const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

    try {
      await executeAtomic(db, qdb => [
        qdb
          .update(convocacoes)
          .set({ observacoes: parsed.observacoes, updatedAt: nowIso })
          .where(
            and(
              eq(convocacoes.id, id),
              eq(convocacoes.status, 'RASCUNHO'),
              eq(convocacoes.updatedAt, convocacao.updatedAt)
            )
          ),
        criarAuditQuery(qdb, {
          acao: 'CONVOCACAO_ATUALIZADA',
          atorMembroId: membroId,
          recursoTipo: 'CONVOCACAO',
          recursoId: id,
          escopoTipo,
          escopoId,
          contexto: { camposAlterados: Object.keys(parsed) },
        }),
        qdb
          .update(convocacoes)
          .set({
            status:
              sql`CASE WHEN ${convocacoes.updatedAt} = ${nowIso} THEN ${convocacoes.status} ELSE 'ABORT_OCC' END` as any,
          })
          .where(eq(convocacoes.id, id)),
      ])
    } catch (err: any) {
      if (err.message && err.message.includes('check_status_convocacao')) {
        return c.json(
          { error: 'Conflito: a convocação deixou de ser um rascunho ou foi alterada por outra operação.' },
          409
        )
      }
      throw err
    }

    const updated = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
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
  if (!evento || !(await podeLerEvento(db, c.get('contextoPermissoes'), evento.id))) {
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
    if (evento.abrangencia === 'NACIONAL' || evento.abrangencia === 'INTERNACIONAL') {
      return c.json({ error: 'Atendimento externo aceita somente convites pessoais, nunca atribuição por função', code: 'EVENTO_EXTERNO_SEM_FUNCOES' }, 409)
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

    const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)
    await executarOperacaoComAudit(
      db,
      qdb => [qdb.insert(convocacaoFuncoes).values(resultFuncao)],
      {
        acao: 'CONVOCACAO_FUNCAO_ADICIONADA',
        atorMembroId: membroId,
        recursoTipo: 'CONVOCACAO',
        recursoId: id,
        escopoTipo,
        escopoId,
        contexto: { funcaoId: parsed.funcaoId },
      }
    )

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

  const associacao = await db
    .select({ id: convocacaoFuncoes.id })
    .from(convocacaoFuncoes)
    .where(
      and(eq(convocacaoFuncoes.convocacaoId, id), eq(convocacaoFuncoes.funcaoId, funcaoId))
    )
    .get()
  if (!associacao) {
    return c.json({ error: 'Função não associada a esta convocação' }, 404)
  }

  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)
  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb
        .delete(convocacaoFuncoes)
        .where(eq(convocacaoFuncoes.id, associacao.id)),
    ],
    {
      acao: 'CONVOCACAO_FUNCAO_REMOVIDA',
      atorMembroId: membroId,
      recursoTipo: 'CONVOCACAO',
      recursoId: id,
      escopoTipo,
      escopoId,
      contexto: { funcaoId },
    }
  )

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

  if (evento.abrangencia === 'NACIONAL' || evento.abrangencia === 'INTERNACIONAL') {
    return c.json({ error: 'Publicação de evento externo requer atribuições pessoais; fluxo de funções não permitido', code: 'EVENTO_EXTERNO_CONVITE_PESSOAL_PENDENTE' }, 409)
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

  // A função DCO é vinculada à Casa, mas pode ser convocada por seus níveis superiores.
  // Demais funções seguem exigindo vínculo explícito no escopo do evento.
  const conditions = [
    eq(vinculosFuncionais.ativo, true),
    eq(membros.ativo, true),
    inArray(vinculosFuncionais.funcaoId, funcaoIds),
  ]
  const vinculoDco = and(eq(funcoes.codigo, 'DCO'), eq(vinculosFuncionais.casaId, membros.casaId))
  if (evento.casaId) {
    const casasAtivas = db.select({ id: casas.id }).from(casas).where(eq(casas.ativo, true))
    // A regra de Casa ativa aplica-se ao DCO automático; vínculos comuns/manuais
    // mantêm a correspondência direta, sem herança territorial.
    conditions.push(eq(vinculosFuncionais.casaId, evento.casaId))
    conditions.push(or(sql`${funcoes.codigo} != 'DCO'`,
      and(eq(vinculosFuncionais.casaId, membros.casaId), inArray(vinculosFuncionais.casaId, casasAtivas)))!)
  } else if (evento.setorId) {
    const casasDoSetor = db.select({ id: casas.id }).from(casas)
      .innerJoin(setores, eq(setores.id, casas.setorId))
      .where(and(eq(casas.setorId, evento.setorId), eq(casas.ativo, true), eq(setores.ativo, true)))
    conditions.push(or(eq(vinculosFuncionais.setorId, evento.setorId),
      and(vinculoDco, inArray(vinculosFuncionais.casaId, casasDoSetor)))!)
  } else if (evento.administracaoId) {
    const casasDaAdministracao = db.select({ id: casas.id }).from(casas)
      .innerJoin(setores, eq(setores.id, casas.setorId))
      .innerJoin(administracoes, eq(administracoes.id, setores.administracaoId))
      .where(and(eq(setores.administracaoId, evento.administracaoId),
        eq(administracoes.ativo, true), eq(setores.ativo, true), eq(casas.ativo, true)))
    conditions.push(or(eq(vinculosFuncionais.administracaoId, evento.administracaoId),
      and(vinculoDco, inArray(vinculosFuncionais.casaId, casasDaAdministracao)))!)
  } else if (evento.regionalId) {
    const casasDaRegional = db.select({ id: casas.id }).from(casas)
      .innerJoin(setores, eq(setores.id, casas.setorId))
      .innerJoin(administracoes, eq(administracoes.id, setores.administracaoId))
      .innerJoin(regionais, eq(regionais.id, administracoes.regionalId))
      .where(and(eq(administracoes.regionalId, evento.regionalId),
        eq(regionais.ativo, true), eq(administracoes.ativo, true), eq(setores.ativo, true), eq(casas.ativo, true)))
    conditions.push(or(eq(vinculosFuncionais.regionalId, evento.regionalId),
      and(vinculoDco, inArray(vinculosFuncionais.casaId, casasDaRegional)))!)
  } else if (evento.grupoTrabalhoId) {
    conditions.push(eq(vinculosFuncionais.grupoTrabalhoId, evento.grupoTrabalhoId))
  }

  // Realiza query juntando vinculosFuncionais e membros
  const destinatariosValidos = await db
    .select({
      membroId: membros.id,
      funcaoId: vinculosFuncionais.funcaoId,
      vinculoId: vinculosFuncionais.id,
    })
    .from(vinculosFuncionais)
    .innerJoin(membros, eq(membros.id, vinculosFuncionais.membroId))
    .innerJoin(funcoes, eq(funcoes.id, vinculosFuncionais.funcaoId))
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
      // Inclui DCO automáticos reativados após a preparação do snapshot.
      // A publicação e a reativação consultam o estado efetivo dentro do batch.
      queries.push(...queriesSincronizacaoDcoAtual(qdb, nowIso, { convocacaoId: id }))

      // 3. AUDITORIA
      queries.push(
        criarAuditQuery(qdb, {
          acao: 'CONVOCACAO_PUBLICADA',
          atorMembroId,
          recursoTipo: 'CONVOCACAO',
          recursoId: id,
          escopoTipo,
          escopoId,
          contexto: sql`json_object(
            'eventoId', ${convocacao.eventoId},
            'totalDestinatarios', (SELECT count(*) FROM ${convocacaoDestinatarios}
              WHERE ${convocacaoDestinatarios.convocacaoId} = ${id})
          )` as any,
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

    const total = await db.select({ total: sql<number>`count(*)` })
      .from(convocacaoDestinatarios).where(eq(convocacaoDestinatarios.convocacaoId, id)).get()
    return c.json({ success: true, destinatariosGerados: total.total })
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

// Reconciliação idempotente de DCO em convocação já publicada.
// Não altera RSVP, funções existentes ou evidências históricas.
convocacoesRouter.post('/:id/sincronizar-dco', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const atorMembroId = c.get('membroId')
  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
  if (convocacao.status !== 'PUBLICADA' || !convocacao.ativo)
    return c.json({ error: 'Somente convocações publicadas e ativas podem ser sincronizadas' }, 409)
  const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
  if (!evento || !atorMembroId || !(await podeGerirConvocacao(db, atorMembroId, evento)))
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  if (evento.abrangencia !== 'TERRITORIAL')
    return c.json({ error: 'A sincronização DCO é exclusiva de eventos territoriais' }, 409)
  const dco = await db.select({ id: funcoes.id }).from(funcoes)
    .where(and(eq(funcoes.codigo, 'DCO'), eq(funcoes.ativo, true))).get()
  if (!dco) return c.json({ error: 'Função DCO canônica indisponível' }, 409)
  const convocouDco = await db.select({ id: convocacaoFuncoes.id }).from(convocacaoFuncoes)
    .where(and(eq(convocacaoFuncoes.convocacaoId, id), eq(convocacaoFuncoes.funcaoId, dco.id))).get()
  if (!convocouDco) return c.json({ error: 'Convocação não contém a função canônica DCO' }, 409)
  const nowIso = new Date().toISOString()
  const antes = await db.select({ total: sql<number>`count(*)` }).from(convocacaoDestinatarios)
    .where(eq(convocacaoDestinatarios.convocacaoId, id)).get()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)
  try {
    await executarOperacaoComAudit(db,
      qdb => [
        // Guarda atômica: cancelar/desativar ou remover a função após a leitura
        // deve abortar o batch inteiro, inclusive a auditoria.
        qdb.update(convocacoes).set({
          status: sql`CASE WHEN ${convocacoes.status} = 'PUBLICADA'
            AND ${convocacoes.ativo} = 1
            AND EXISTS (SELECT 1 FROM ${eventos}
              WHERE ${eventos.id} = ${convocacoes.eventoId}
              AND ${eventos.ativo} = 1 AND ${eventos.abrangencia} = 'TERRITORIAL'
              AND ${eventos.regionalId} IS ${evento.regionalId ?? null}
              AND ${eventos.administracaoId} IS ${evento.administracaoId ?? null}
              AND ${eventos.setorId} IS ${evento.setorId ?? null}
              AND ${eventos.casaId} IS ${evento.casaId ?? null}
              AND ${eventos.grupoTrabalhoId} IS ${evento.grupoTrabalhoId ?? null})
            AND EXISTS (SELECT 1 FROM ${convocacaoFuncoes}
              JOIN ${funcoes} ON ${funcoes.id} = ${convocacaoFuncoes.funcaoId}
              WHERE ${convocacaoFuncoes.convocacaoId} = ${convocacoes.id}
                AND ${funcoes.codigo} = 'DCO' AND ${funcoes.ativo} = 1)
            THEN 'PUBLICADA' ELSE 'ABORT_OCC' END` as any,
        }).where(eq(convocacoes.id, id)),
        ...queriesSincronizacaoDcoAtual(qdb, nowIso, { convocacaoId: id }),
      ],
      {
        acao: 'CONVOCACAO_DCO_SINCRONIZADA',
      atorMembroId,
      recursoTipo: 'CONVOCACAO',
      recursoId: id,
      escopoTipo,
      escopoId,
      contexto: { operacao: 'ADITIVA_IDEMPOTENTE' },
      }
    )
  } catch {
    return c.json({ error: 'Convocação alterada durante a sincronização; recarregue e tente novamente' }, 409)
  }
  const depois = await db.select({ total: sql<number>`count(*)` }).from(convocacaoDestinatarios)
    .where(eq(convocacaoDestinatarios.convocacaoId, id)).get()
  return c.json({ success: true, destinatariosAntes: antes?.total ?? 0,
    destinatariosDepois: depois?.total ?? 0 })
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
  const convocacao = await db.select().from(convocacoes).where(eq(convocacoes.id, id)).get()
  if (!convocacao) return c.json({ error: 'Convocação não encontrada' }, 404)
  const evento = await db.select().from(eventos).where(eq(eventos.id, convocacao.eventoId)).get()
  const membroId = c.get('membroId')
  if (!evento || !(await podeGerirConvocacao(db, membroId, evento)) && !(await eGestorRelatoriosAutorizadoParaEvento(db, membroId, evento))) {
    return c.json({ error: 'Acesso não autorizado para consultar destinatários', code: 'FORBIDDEN' }, 403)
  }
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
      respostaRsvp: sql`COALESCE(${rsvp.resposta}, 'SEM_RESPOSTA')`.as('respostaRsvp'),
      rsvpAtualizadoEm: rsvp.atualizadoEm
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
    rsvpAtualizadoEm: string | null
  }
  type EvidenciaItem = {
    convocacaoDestinatarioId: string
    funcaoId: string
    vinculoFuncionalId: string
    funcaoNome: string | null
    escopoTipo: string | null
    escopoId: string | null
  }

  const destIds = destinatariosPage.map((d: DestinatarioPage) => d.destinatarioId)
  const evidencias = await db
    .select({
      convocacaoDestinatarioId: convocacaoDestinatarioEvidencias.convocacaoDestinatarioId,
      funcaoId: convocacaoDestinatarioEvidencias.funcaoId,
      vinculoFuncionalId: convocacaoDestinatarioEvidencias.vinculoFuncionalId,
      funcaoNome: convocacaoDestinatarioEvidencias.funcaoNomeSnapshot,
      escopoTipo: convocacaoDestinatarioEvidencias.escopoTipoSnapshot,
      escopoId: convocacaoDestinatarioEvidencias.escopoIdSnapshot
    })
    .from(convocacaoDestinatarioEvidencias)
    .where(inArray(convocacaoDestinatarioEvidencias.convocacaoDestinatarioId, destIds))
    .all()

  const data = destinatariosPage.map((d: DestinatarioPage) => {
    const evidenciasDestinatario = evidencias
      .filter((e: EvidenciaItem) => e.convocacaoDestinatarioId === d.destinatarioId)
    const vinculo = escolherMaiorVinculo(evidenciasDestinatario)

    return {
      destinatarioId: d.destinatarioId,
      membroId: d.membroId,
      membroNome: d.membroNome,
      respostaRsvp: d.respostaRsvp,
      reconfirmacaoPendente:
        Boolean(d.rsvpAtualizadoEm) &&
        new Date(d.rsvpAtualizadoEm!).getTime() < new Date(evento.agendaRevisao).getTime(),
      vinculo: vinculo?.funcaoNome ? {
        funcaoId: vinculo.funcaoId,
        funcaoNome: vinculo.funcaoNome,
        vinculoFuncionalId: vinculo.vinculoFuncionalId,
      } : null,
      evidencias: evidenciasDestinatario.map((e: EvidenciaItem) => ({
        funcaoId: e.funcaoId,
        vinculoFuncionalId: e.vinculoFuncionalId
      }))
    }
  })

  return c.json({
    data,
    meta: { total, page, lastPage }
  })
})
