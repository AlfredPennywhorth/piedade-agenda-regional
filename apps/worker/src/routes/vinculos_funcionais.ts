import { Hono } from 'hono'
import { and, eq, gt, inArray } from 'drizzle-orm'
import {
  administracoes,
  casas,
  convocacaoDestinatarioEvidencias,
  convocacaoDestinatarios,
  convocacaoFuncoes,
  convocacoes,
  eventos,
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
import { executarOperacaoComAudit, executarOperacaoComAudits } from '../services/auditoria'

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

function eventoCorrespondeAoVinculo(evento: any, vinculo: any): boolean {
  if (vinculo.regionalId) return evento.regionalId === vinculo.regionalId
  if (vinculo.administracaoId) return evento.administracaoId === vinculo.administracaoId
  if (vinculo.setorId) return evento.setorId === vinculo.setorId
  if (vinculo.casaId) return evento.casaId === vinculo.casaId
  if (vinculo.grupoTrabalhoId) return evento.grupoTrabalhoId === vinculo.grupoTrabalhoId
  return false
}

async function sincronizarConvocacoesPublicadasParaVinculo(db: any, vinculo: any) {
  if (!vinculo?.ativo) return

  const agoraIso = new Date().toISOString()
  const candidatas = await db
    .select({
      convocacaoId: convocacoes.id,
      evento: eventos,
    })
    .from(convocacoes)
    .innerJoin(
      convocacaoFuncoes,
      and(
        eq(convocacaoFuncoes.convocacaoId, convocacoes.id),
        eq(convocacaoFuncoes.funcaoId, vinculo.funcaoId)
      )
    )
    .innerJoin(eventos, eq(convocacoes.eventoId, eventos.id))
    .where(
      and(
        eq(convocacoes.status, 'PUBLICADA'),
        eq(convocacoes.ativo, true),
        eq(eventos.ativo, true),
        gt(eventos.fimEm, agoraIso)
      )
    )
    .all()

  for (const candidata of candidatas) {
    if (!eventoCorrespondeAoVinculo(candidata.evento, vinculo)) continue

    let destinatario = await db
      .select({ id: convocacaoDestinatarios.id })
      .from(convocacaoDestinatarios)
      .where(
        and(
          eq(convocacaoDestinatarios.convocacaoId, candidata.convocacaoId),
          eq(convocacaoDestinatarios.membroId, vinculo.membroId)
        )
      )
      .get()

    if (!destinatario) {
      const destinatarioId = crypto.randomUUID()
      await db
        .insert(convocacaoDestinatarios)
        .values({
          id: destinatarioId,
          convocacaoId: candidata.convocacaoId,
          membroId: vinculo.membroId,
          createdAt: agoraIso,
        })
        .onConflictDoNothing()

      destinatario = await db
        .select({ id: convocacaoDestinatarios.id })
        .from(convocacaoDestinatarios)
        .where(
          and(
            eq(convocacaoDestinatarios.convocacaoId, candidata.convocacaoId),
            eq(convocacaoDestinatarios.membroId, vinculo.membroId)
          )
        )
        .get()
    }

    if (!destinatario) continue

    await db
      .insert(convocacaoDestinatarioEvidencias)
      .values({
        id: crypto.randomUUID(),
        convocacaoDestinatarioId: destinatario.id,
        funcaoId: vinculo.funcaoId,
        vinculoFuncionalId: vinculo.id,
        createdAt: agoraIso,
      })
      .onConflictDoNothing()
  }
}

function podeEscreverVinculos(contexto: any): boolean {
  return eMasterSistema(contexto) || regionaisAdministradas(contexto).size > 0
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

async function idsEscoposDasRegionaisAdministradas(db: any, contexto: any) {
  const regionaisIds = Array.from(regionaisAdministradas(contexto))
  const administracoesIds: string[] = []
  const setoresIds: string[] = []
  const casasIds: string[] = []
  const gruposTrabalhoIds: string[] = []
  const LIMITE_IDS_D1 = 90

  for (let i = 0; i < regionaisIds.length; i += LIMITE_IDS_D1) {
    const lote = regionaisIds.slice(i, i + LIMITE_IDS_D1)
    if (lote.length === 0) continue

    const adms = await db
      .select({ id: administracoes.id })
      .from(administracoes)
      .where(inArray(administracoes.regionalId, lote))
      .all()
    administracoesIds.push(...adms.map((item: any) => item.id))

    const gts = await db
      .select({ id: gruposTrabalho.id })
      .from(gruposTrabalho)
      .where(inArray(gruposTrabalho.regionalId, lote))
      .all()
    gruposTrabalhoIds.push(...gts.map((item: any) => item.id))
  }

  for (let i = 0; i < administracoesIds.length; i += LIMITE_IDS_D1) {
    const lote = administracoesIds.slice(i, i + LIMITE_IDS_D1)
    const itens = await db
      .select({ id: setores.id })
      .from(setores)
      .where(inArray(setores.administracaoId, lote))
      .all()
    setoresIds.push(...itens.map((item: any) => item.id))
  }

  for (let i = 0; i < setoresIds.length; i += LIMITE_IDS_D1) {
    const lote = setoresIds.slice(i, i + LIMITE_IDS_D1)
    const itens = await db
      .select({ id: casas.id })
      .from(casas)
      .where(inArray(casas.setorId, lote))
      .all()
    casasIds.push(...itens.map((item: any) => item.id))
  }

  return { regionaisIds, administracoesIds, setoresIds, casasIds, gruposTrabalhoIds }
}

export async function listarVinculosVisiveis(db: any, contexto: any, membroId?: string) {
  if (eMasterSistema(contexto)) {
    const query = selecionarVinculosDetalhados(db)
    return membroId
      ? await query.where(eq(vinculosFuncionais.membroId, membroId)).all()
      : await query.all()
  }

  const porId = new Map<string, any>()
  const incluir = (itens: any[]) => {
    for (const item of itens) porId.set(item.id, item)
  }

  // Usuário comum: somente os próprios vínculos.
  if (!membroId || membroId === contexto.membroId) {
    incluir(
      await selecionarVinculosDetalhados(db)
        .where(eq(vinculosFuncionais.membroId, contexto.membroId))
        .all()
    )
  }

  const administradas = regionaisAdministradas(contexto)
  if (administradas.size === 0) {
    return Array.from(porId.values())
  }

  const escopos = await idsEscoposDasRegionaisAdministradas(db, contexto)
  const LIMITE_IDS_D1 = 90

  const consultarEmLotes = async (coluna: any, ids: string[]) => {
    for (let i = 0; i < ids.length; i += LIMITE_IDS_D1) {
      const lote = ids.slice(i, i + LIMITE_IDS_D1)
      if (lote.length === 0) continue

      const itens = await selecionarVinculosDetalhados(db)
        .where(inArray(coluna, lote))
        .all()

      incluir(
        membroId
          ? itens.filter((item: any) => item.membroId === membroId)
          : itens
      )
    }
  }

  await consultarEmLotes(vinculosFuncionais.regionalId, escopos.regionaisIds)
  await consultarEmLotes(vinculosFuncionais.administracaoId, escopos.administracoesIds)
  await consultarEmLotes(vinculosFuncionais.setorId, escopos.setoresIds)
  await consultarEmLotes(vinculosFuncionais.casaId, escopos.casasIds)
  await consultarEmLotes(vinculosFuncionais.grupoTrabalhoId, escopos.gruposTrabalhoIds)

  return Array.from(porId.values())
}

async function vinculoVisivelParaContexto(db: any, contexto: any, vinculoId: string): Promise<boolean> {
  if (eMasterSistema(contexto)) return true
  const visiveis = await listarVinculosVisiveis(db, contexto)
  return visiveis.some((item: any) => item.id === vinculoId)
}

vinculosFuncionaisRouter.get('/', async (c) => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  return c.json(await listarVinculosVisiveis(db, contexto))
})

vinculosFuncionaisRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await selecionarVinculosDetalhados(db)
    .where(eq(vinculosFuncionais.id, id))
    .get()
  
  if (!data) return c.json({ error: 'Vínculo funcional não encontrado' }, 404)

  const contexto = c.get('contextoPermissoes')
  if (!(await vinculoVisivelParaContexto(db, contexto, data.id))) {
    return c.json({ error: 'Acesso não autorizado para este vínculo', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

vinculosFuncionaisRouter.post('/', async (c) => {
  const db = c.get('db')
  if (!podeEscreverVinculos(c.get('contextoPermissoes'))) {
    return c.json({ error: 'Acesso não autorizado para administrar vínculos', code: 'FORBIDDEN' }, 403)
  }

  try {
    const body = await c.req.json()
    const parsed = CreateVinculoFuncionalSchema.parse(body)

    if (!(await podeAdministrarVinculo(db, c.get('contextoPermissoes'), parsed))) {
      return c.json({ error: 'Acesso não autorizado para administrar vínculo neste escopo', code: 'FORBIDDEN' }, 403)
    }
    
    const id = crypto.randomUUID()
    const escopo = escopoDoVinculo(parsed)
    if (!escopo) {
      return c.json({ error: 'O vínculo funcional deve possuir exatamente um escopo institucional.' }, 400)
    }
    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(vinculosFuncionais).values({ id, ...parsed })],
      {
        acao: 'VINCULO_FUNCIONAL_CRIADO',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'VINCULO_FUNCIONAL',
        recursoId: id,
        escopoTipo: escopo.tipo,
        escopoId: escopo.id,
        contexto: { membroId: parsed.membroId, funcaoId: parsed.funcaoId },
      }
    )
    const result = await db.select().from(vinculosFuncionais).where(eq(vinculosFuncionais.id, id)).get()
    await sincronizarConvocacoesPublicadasParaVinculo(db, result)
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
  if (!podeEscreverVinculos(c.get('contextoPermissoes'))) {
    return c.json({ error: 'Acesso não autorizado para administrar vínculos', code: 'FORBIDDEN' }, 403)
  }

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

    const escopoOrigem = escopoDoVinculo(existing)
    const escopoFinal = escopoDoVinculo(vinculoResultante)
    if (!escopoOrigem || !escopoFinal) {
      return c.json({ error: 'O vínculo funcional resultante deve possuir exatamente um escopo institucional.' }, 400)
    }

    const atorMembroId = c.get('membroId') || null
    const camposAlterados = Object.keys(parsed)
    const moveuEscopo = escopoOrigem.tipo !== escopoFinal.tipo || escopoOrigem.id !== escopoFinal.id

    if (moveuEscopo) {
      await executarOperacaoComAudits(
        db,
        (qdb) => [
          qdb.update(vinculosFuncionais)
            .set({ ...parsed, updatedAt: new Date().toISOString() })
            .where(eq(vinculosFuncionais.id, id))
        ],
        [
          {
            acao: 'VINCULO_FUNCIONAL_ATUALIZADO',
            atorMembroId,
            recursoTipo: 'VINCULO_FUNCIONAL',
            recursoId: id,
            escopoTipo: escopoOrigem.tipo,
            escopoId: escopoOrigem.id,
            contexto: {
              camposAlterados,
              movimentoEscopo: 'ORIGEM',
              escopoDestinoTipo: escopoFinal.tipo,
              escopoDestinoId: escopoFinal.id,
            },
          },
          {
            acao: 'VINCULO_FUNCIONAL_ATUALIZADO',
            atorMembroId,
            recursoTipo: 'VINCULO_FUNCIONAL',
            recursoId: id,
            escopoTipo: escopoFinal.tipo,
            escopoId: escopoFinal.id,
            contexto: {
              camposAlterados,
              movimentoEscopo: 'DESTINO',
              escopoOrigemTipo: escopoOrigem.tipo,
              escopoOrigemId: escopoOrigem.id,
            },
          },
        ]
      )
    } else {
      await executarOperacaoComAudit(
        db,
        (qdb) => [
          qdb.update(vinculosFuncionais)
            .set({ ...parsed, updatedAt: new Date().toISOString() })
            .where(eq(vinculosFuncionais.id, id))
        ],
        {
          acao: 'VINCULO_FUNCIONAL_ATUALIZADO',
          atorMembroId,
          recursoTipo: 'VINCULO_FUNCIONAL',
          recursoId: id,
          escopoTipo: escopoFinal.tipo,
          escopoId: escopoFinal.id,
          contexto: { camposAlterados },
        }
      )
    }
    const updated = await db.select().from(vinculosFuncionais).where(eq(vinculosFuncionais.id, id)).get()
    await sincronizarConvocacoesPublicadasParaVinculo(db, updated)
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
