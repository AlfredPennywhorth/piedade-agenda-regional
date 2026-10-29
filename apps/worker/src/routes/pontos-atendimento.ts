import { Hono } from 'hono'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { z } from '@piedade/shared'
import { pontosAtendimento, tiposReuniao, casas, setores, casasPontosExcecoes } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { executarOperacaoComAudit } from '../services/auditoria'
import { eMasterSistema, obterEscoposTerritoriaisVisiveis, podeAdministrarEscopo } from '../security/permissoes'

export const pontosAtendimentoRouter = new Hono<any>()
export const tiposReuniaoRouter = new Hono<any>()
pontosAtendimentoRouter.use('*', authMiddleware)
tiposReuniaoRouter.use('*', authMiddleware)

const pontoInput = z.object({
  nome: z.string().trim().min(2).max(255),
  setorId: z.string().uuid(),
  codigo: z.string().trim().max(60).nullable().optional(),
})
const tipoInput = z.object({
  nome: z.string().trim().min(2).max(255),
  codigo: z.string().trim().min(2).max(60).regex(/^[A-Z0-9_-]+$/),
})
const corpoAtivo = z.object({ ativo: z.boolean() })

// Exceção intersetorial somente pelo Master; não altera o Setor institucional.
pontosAtendimentoRouter.post('/excecoes-intersetoriais', async c => {
  if (!eMasterSistema(c.get('contextoPermissoes'))) return c.json({ error: 'Apenas Master pode autorizar exceções', code: 'FORBIDDEN' }, 403)
  const parsed = z.object({
    casaId: z.string().uuid(),
    pontoAtendimentoId: z.string().uuid(),
    motivo: z.string().trim().min(5).max(500),
  }).safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const { casaId, pontoAtendimentoId, motivo } = parsed.data
  const db = c.get('db')
  const [casa, ponto] = await Promise.all([
    db.select().from(casas).where(eq(casas.id, casaId)).get(),
    db.select().from(pontosAtendimento).where(eq(pontosAtendimento.id, pontoAtendimentoId)).get(),
  ])
  if (!casa || !ponto) return c.json({ error: 'Casa ou Ponto inexistente' }, 404)
  if (!casa.ativo || !ponto.ativo) return c.json({ error: 'Casa ou Ponto inativo' }, 409)
  if (casa.setorId === ponto.setorId) return c.json({ error: 'Use a vinculação normal para Casas do mesmo Setor' }, 400)
  if (casa.pontoAtendimentoId) return c.json({ error: 'Casa já vinculada: desvincule antes de autorizar exceção', code: 'CASA_PONTO_JA_VINCULADO' }, 409)
  try {
    await executarOperacaoComAudit(db, qdb => [
      qdb.insert(casasPontosExcecoes).values({
        casaId, pontoAtendimentoId, motivo,
        autorizadoPorMembroId: c.get('membroId') || null,
      }),
      qdb.update(casas).set({
        pontoAtendimentoId: sql`CASE WHEN ${casas.pontoAtendimentoId} IS NULL
          THEN ${pontoAtendimentoId} ELSE 'VINCULO_CONCORRENTE_INVALIDO' END` as any,
        updatedAt: new Date().toISOString(),
      }).where(eq(casas.id, casaId)),
    ], {
      acao: 'CASA_PONTO_EXCECAO_INTERSETORIAL',
      atorMembroId: c.get('membroId') || null,
      recursoTipo: 'CASA', recursoId: casaId,
      escopoTipo: 'SETOR', escopoId: casa.setorId,
      contexto: { setorOrigemId: casa.setorId, setorDestinoId: ponto.setorId, pontoAtendimentoId, motivo },
    })
  } catch {
    return c.json({ error: 'Autorização concorrente, vínculo existente ou restrição de integridade', code: 'EXCECAO_NAO_APLICADA' }, 409)
  }
  return c.json({ ok: true, casaId, pontoAtendimentoId }, 201)
})

pontosAtendimentoRouter.get('/', async c => {
  const db = c.get('db')
  const visible = await obterEscoposTerritoriaisVisiveis(db, c.get('contextoPermissoes'))
  const setorId = c.req.query('setorId')
  if (setorId && !visible.tudo && !visible.setoresIds.has(setorId)) return c.json([], 200)
  const ids = setorId ? [setorId] : [...visible.setoresIds]
  if (!visible.tudo && ids.length === 0) return c.json([])
  // Limite de binds D1. Evita IN massivo.
  const result: Array<typeof pontosAtendimento.$inferSelect> = []
  if (visible.tudo && !setorId) result.push(...await db.select().from(pontosAtendimento).all())
  else for (let i = 0; i < ids.length; i += 80) {
    result.push(...await db.select().from(pontosAtendimento).where(inArray(pontosAtendimento.setorId, ids.slice(i, i + 80))).all())
  }
  return c.json(result.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id.localeCompare(b.id)))
})

pontosAtendimentoRouter.post('/', async c => {
  const parsed = pontoInput.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const db = c.get('db')
  const { nome, setorId, codigo } = parsed.data
  if (!(await podeAdministrarEscopo(db, c.get('contextoPermissoes'), 'SETOR', setorId))) return c.json({ error: 'Acesso negado' }, 403)
  const setor = await db.select({ id: setores.id }).from(setores).where(eq(setores.id, setorId)).get()
  if (!setor) return c.json({ error: 'Setor inexistente' }, 400)
  const id = crypto.randomUUID()
  try {
    await db.insert(pontosAtendimento).values({ id, setorId, nome, codigo: codigo ?? null })
  } catch {
    return c.json({ error: 'Ponto duplicado ou inválido' }, 409)
  }
  return c.json(await db.select().from(pontosAtendimento).where(eq(pontosAtendimento.id, id)).get(), 201)
})

pontosAtendimentoRouter.patch('/:id', async c => {
  const db = c.get('db')
  const existing = await db.select().from(pontosAtendimento).where(eq(pontosAtendimento.id, c.req.param('id'))).get()
  if (!existing) return c.json({ error: 'Ponto não encontrado' }, 404)
  const parsed = pontoInput.partial().extend({ ativo: z.boolean().optional() }).safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const setorFinal = parsed.data.setorId ?? existing.setorId
  if (!(await podeAdministrarEscopo(db, c.get('contextoPermissoes'), 'SETOR', existing.setorId)) ||
      !(await podeAdministrarEscopo(db, c.get('contextoPermissoes'), 'SETOR', setorFinal))) return c.json({ error: 'Acesso negado' }, 403)
  try {
    await db.update(pontosAtendimento).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(eq(pontosAtendimento.id, existing.id))
  } catch {
    return c.json({ error: 'Alteração incompatível com Casas vinculadas ou nome duplicado' }, 409)
  }
  return c.json(await db.select().from(pontosAtendimento).where(eq(pontosAtendimento.id, existing.id)).get())
})

// Vincula a Casa sem alterar seu setor. Restrição entre setores também existe no D1.
pontosAtendimentoRouter.patch('/:id/casas/:casaId', async c => {
  const db = c.get('db')
  const ponto = await db.select().from(pontosAtendimento).where(eq(pontosAtendimento.id, c.req.param('id'))).get()
  const casa = await db.select().from(casas).where(eq(casas.id, c.req.param('casaId'))).get()
  if (!ponto || !casa) return c.json({ error: 'Ponto ou Casa não encontrado' }, 404)
  if (ponto.setorId !== casa.setorId) return c.json({ error: 'Casa pertence a outro Setor' }, 400)
  if (!(await podeAdministrarEscopo(db, c.get('contextoPermissoes'), 'SETOR', ponto.setorId))) return c.json({ error: 'Acesso negado' }, 403)
  if (!ponto.ativo) return c.json({ error: 'Ponto inativo' }, 409)
  // Compare-and-set atômico: a Casa só pode ser vinculada se ainda não possuir Ponto.
  // Evita que duas requisições concorrentes transfiram silenciosamente o vínculo.
  const vinculada = await db.update(casas)
    .set({ pontoAtendimentoId: ponto.id, updatedAt: new Date().toISOString() })
    .where(and(eq(casas.id, casa.id), isNull(casas.pontoAtendimentoId)))
    .returning({ id: casas.id }).get()
  if (!vinculada) return c.json({ error: 'Casa já vinculada a um Ponto de Atendimento. Remanejamentos exigem procedimento específico.', code: 'CASA_PONTO_JA_VINCULADO' }, 409)
  return c.json({ ok: true })
})

// Desvinculação autorizada para reorganização territorial, inclusive futura mudança de Setor.
pontosAtendimentoRouter.post('/:id/casas/:casaId/desvincular', async c => {
  const db = c.get('db')
  const ponto = await db.select().from(pontosAtendimento).where(eq(pontosAtendimento.id, c.req.param('id'))).get()
  const casa = await db.select().from(casas).where(eq(casas.id, c.req.param('casaId'))).get()
  if (!ponto || !casa) return c.json({ error: 'Ponto ou Casa não encontrado' }, 404)
  if (!(await podeAdministrarEscopo(db, c.get('contextoPermissoes'), 'SETOR', casa.setorId))) return c.json({ error: 'Acesso negado' }, 403)
  if (casa.pontoAtendimentoId !== ponto.id) return c.json({ error: 'Vínculo de origem alterado', code: 'VINCULO_ALTERADO' }, 409)
  const parsed = z.object({ motivo: z.string().trim().min(5).max(500) }).safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  try {
    await executarOperacaoComAudit(db, qdb => [
      qdb.update(casas).set({
        pontoAtendimentoId: sql`CASE WHEN ${casas.pontoAtendimentoId} = ${ponto.id}
          THEN NULL ELSE 'VINCULO_CONCORRENTE_INVALIDO' END` as any,
        updatedAt: new Date().toISOString(),
      }).where(eq(casas.id, casa.id)),
    ], {
      acao: 'CASA_DESVINCULADA_PONTO',
      atorMembroId: c.get('membroId') || null,
      recursoTipo: 'CASA',
      recursoId: casa.id,
      escopoTipo: 'SETOR',
      escopoId: casa.setorId,
      contexto: { origemPontoId: ponto.id, motivo: parsed.data.motivo },
    })
  } catch {
    return c.json({ error: 'Vínculo alterado simultaneamente', code: 'VINCULO_ALTERADO' }, 409)
  }
  return c.json({ ok: true })
})

// Transferência explícita: vinculação continua exclusiva; o histórico dos convites não é reescrito.
pontosAtendimentoRouter.post('/:id/casas/:casaId/transferir', async c => {
  const db = c.get('db')
  const destino = await db.select().from(pontosAtendimento).where(eq(pontosAtendimento.id, c.req.param('id'))).get()
  const casa = await db.select().from(casas).where(eq(casas.id, c.req.param('casaId'))).get()
  if (!destino || !casa) return c.json({ error: 'Ponto ou Casa não encontrado' }, 404)
  const parsed = z.object({ origemPontoId: z.string().uuid(), motivo: z.string().trim().min(5).max(500) }).safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const origem = await db.select().from(pontosAtendimento).where(eq(pontosAtendimento.id, parsed.data.origemPontoId)).get()
  if (!origem || casa.pontoAtendimentoId !== origem.id) return c.json({ error: 'Vínculo de origem foi alterado. Recarregue a tela.', code: 'VINCULO_ALTERADO' }, 409)
  if (origem.id === destino.id) return c.json({ error: 'A Casa já pertence a este Ponto' }, 409)
  if (origem.setorId !== destino.setorId || destino.setorId !== casa.setorId) return c.json({ error: 'Transferência permitida apenas dentro do mesmo Setor' }, 400)
  if (!destino.ativo) return c.json({ error: 'Ponto de destino inativo' }, 409)
  if (!(await podeAdministrarEscopo(db, c.get('contextoPermissoes'), 'SETOR', casa.setorId))) return c.json({ error: 'Acesso negado' }, 403)
  try {
    await executarOperacaoComAudit(db, qdb => [
      // A FK inválida no ramo de erro aborta todo o batch, inclusive a auditoria.
      // Não substitui um vínculo que tenha sido modificado durante esta requisição.
      qdb.update(casas).set({
        pontoAtendimentoId: sql`CASE WHEN ${casas.pontoAtendimentoId} = ${origem.id}
          THEN ${destino.id} ELSE 'VINCULO_CONCORRENTE_INVALIDO' END` as any,
        updatedAt: new Date().toISOString(),
      }).where(eq(casas.id, casa.id)),
    ], {
      acao: 'CASA_TRANSFERIDA_PONTO',
      atorMembroId: c.get('membroId') || null,
      recursoTipo: 'CASA',
      recursoId: casa.id,
      escopoTipo: 'SETOR',
      escopoId: casa.setorId,
      contexto: { origemPontoId: origem.id, destinoPontoId: destino.id, motivo: parsed.data.motivo },
    })
  } catch {
    return c.json({ error: 'Vínculo alterado simultaneamente ou transferência não permitida', code: 'VINCULO_ALTERADO' }, 409)
  }
  return c.json({ ok: true, origemPontoId: origem.id, destinoPontoId: destino.id })
})

tiposReuniaoRouter.get('/', async c => {
  const db = c.get('db')
  const data = await db.select().from(tiposReuniao).all()
  return c.json(data.sort((a: typeof tiposReuniao.$inferSelect, b: typeof tiposReuniao.$inferSelect) => a.nome.localeCompare(b.nome, 'pt-BR')))
})

tiposReuniaoRouter.post('/', async c => {
  if (!eMasterSistema(c.get('contextoPermissoes'))) return c.json({ error: 'Acesso negado' }, 403)
  const parsed = tipoInput.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const db = c.get('db')
  const id = crypto.randomUUID()
  try { await db.insert(tiposReuniao).values({ id, ...parsed.data }) }
  catch { return c.json({ error: 'Tipo duplicado' }, 409) }
  return c.json(await db.select().from(tiposReuniao).where(eq(tiposReuniao.id, id)).get(), 201)
})

tiposReuniaoRouter.patch('/:id', async c => {
  if (!eMasterSistema(c.get('contextoPermissoes'))) return c.json({ error: 'Acesso negado' }, 403)
  const parsed = tipoInput.partial().merge(corpoAtivo.partial()).safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const db = c.get('db')
  const id = c.req.param('id')
  const existing = await db.select().from(tiposReuniao).where(eq(tiposReuniao.id, id)).get()
  if (!existing) return c.json({ error: 'Tipo não encontrado' }, 404)
  try { await db.update(tiposReuniao).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(eq(tiposReuniao.id, id)) }
  catch { return c.json({ error: 'Tipo duplicado ou inválido' }, 409) }
  return c.json(await db.select().from(tiposReuniao).where(eq(tiposReuniao.id, id)).get())
})
