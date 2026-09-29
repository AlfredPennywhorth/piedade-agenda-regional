import { Hono } from 'hono'
import { and, eq, inArray, or } from 'drizzle-orm'
import { acessosConta, administracoes, casas, contasAcesso, funcoes, membros, setores, tentativasAcesso, vinculosFuncionais } from '../db/schema'
import { CreateMembroSchema, UpdateMembroSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, regionaisAdministradas } from '../security/permissoes'
import { listarVinculosVisiveis, prepararSincronizacaoConvocacoes, queriesSincronizacaoConvocacoes } from './vinculos_funcionais'
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

const membroParaRelatorio = {
  id: membros.id,
  nome: membros.nome,
  casaId: membros.casaId,
  ativo: membros.ativo,
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

function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

async function existeMesmoNomeNaCasa(
  db: any,
  nome: string,
  casaId: string,
  ignorarMembroId?: string
): Promise<boolean> {
  const candidatos = await db
    .select({ id: membros.id, nome: membros.nome })
    .from(membros)
    .where(eq(membros.casaId, casaId))
    .all()

  const alvo = normalizarNome(nome)
  return candidatos.some(
    (item: { id: string; nome: string }) =>
      item.id !== ignorarMembroId && normalizarNome(item.nome) === alvo
  )
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

async function obterFuncaoDco(db: any) {
  return db
    .select({ id: funcoes.id })
    .from(funcoes)
    .where(and(eq(funcoes.codigo, 'DCO'), eq(funcoes.ativo, true)))
    .get()
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

type VisibilidadeMembros = {
  ids: Set<string>
  idsComCadastroCompleto: Set<string>
}

async function idsMembrosVisiveis(c: any): Promise<VisibilidadeMembros | null> {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')

  if (eMasterSistema(contexto)) return null

  const ids = new Set<string>([contexto.membroId])
  const idsComCadastroCompleto = new Set<string>([contexto.membroId])
  const regionaisAdministradasIds = new Set<string>(regionaisAdministradas(contexto))
  const regionaisRelatoriosIds = new Set<string>()
  const administracoesRelatoriosIds = new Set<string>()
  const setoresRelatoriosIds = new Set<string>()
  const casasRelatoriosIds = new Set<string>()
  const gtsRelatoriosIds = new Set<string>()

  for (const acesso of contexto.acessosAtivos) {
    if (acesso.perfilCodigo !== 'GESTOR_RELATORIOS' || !acesso.escopoId) continue

    if (acesso.escopoTipo === 'REGIONAL') regionaisRelatoriosIds.add(acesso.escopoId)
    if (acesso.escopoTipo === 'ADMINISTRACAO') administracoesRelatoriosIds.add(acesso.escopoId)
    if (acesso.escopoTipo === 'SETOR') setoresRelatoriosIds.add(acesso.escopoId)
    if (acesso.escopoTipo === 'CASA') casasRelatoriosIds.add(acesso.escopoId)
    if (acesso.escopoTipo === 'GRUPO_TRABALHO') gtsRelatoriosIds.add(acesso.escopoId)
  }

  const buscarMembrosTerritoriais = async (filtros: any[]) => {
    if (filtros.length === 0) return []
    return db
      .select({ id: membros.id })
      .from(membros)
      .leftJoin(casas, eq(membros.casaId, casas.id))
      .leftJoin(setores, eq(casas.setorId, setores.id))
      .leftJoin(administracoes, eq(setores.administracaoId, administracoes.id))
      .where(or(...filtros))
      .all()
  }

  const filtrosAdministrativos = [eq(membros.id, contexto.membroId)]
  if (regionaisAdministradasIds.size > 0) {
    filtrosAdministrativos.push(
      inArray(administracoes.regionalId, Array.from(regionaisAdministradasIds))
    )
  }
  const membrosAdministrativos = await buscarMembrosTerritoriais(filtrosAdministrativos)
  membrosAdministrativos.forEach((row: { id: string }) => {
    ids.add(row.id)
    idsComCadastroCompleto.add(row.id)
  })

  const filtrosRelatorios = []
  if (regionaisRelatoriosIds.size > 0) {
    filtrosRelatorios.push(inArray(administracoes.regionalId, Array.from(regionaisRelatoriosIds)))
  }
  if (administracoesRelatoriosIds.size > 0) {
    filtrosRelatorios.push(inArray(administracoes.id, Array.from(administracoesRelatoriosIds)))
  }
  if (setoresRelatoriosIds.size > 0) {
    filtrosRelatorios.push(inArray(setores.id, Array.from(setoresRelatoriosIds)))
  }
  if (casasRelatoriosIds.size > 0) {
    filtrosRelatorios.push(inArray(casas.id, Array.from(casasRelatoriosIds)))
  }
  const membrosRelatorios = await buscarMembrosTerritoriais(filtrosRelatorios)
  membrosRelatorios.forEach((row: { id: string }) => ids.add(row.id))

  if (gtsRelatoriosIds.size > 0) {
    const membrosGt = await db
      .select({ id: vinculosFuncionais.membroId })
      .from(vinculosFuncionais)
      .where(
        and(
          eq(vinculosFuncionais.ativo, true),
          inArray(vinculosFuncionais.grupoTrabalhoId, Array.from(gtsRelatoriosIds))
        )
      )
      .all()
    membrosGt.forEach((row: { id: string }) => ids.add(row.id))
  }

  return { ids, idsComCadastroCompleto }
}

membrosRouter.get('/', async (c) => {
  const db = c.get('db')
  const visibilidade = await idsMembrosVisiveis(c)

  if (visibilidade === null) {
    const data = await db.select(membroPublico).from(membros).all()
    data.sort((a: { id: string; nome: string }, b: { id: string; nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) || a.id.localeCompare(b.id))
    return c.json(data)
  }

  const ids = Array.from(visibilidade.ids)
  if (ids.length === 0) return c.json([])

  const LIMITE_IDS_D1 = 90
  const data: any[] = []
  const idsCompletos = Array.from(visibilidade.idsComCadastroCompleto)
  const idsMinimizados = ids.filter(id => !visibilidade.idsComCadastroCompleto.has(id))

  for (const [loteIds, projecao] of [
    [idsCompletos, membroPublico],
    [idsMinimizados, membroParaRelatorio],
  ] as const) {
    for (let i = 0; i < loteIds.length; i += LIMITE_IDS_D1) {
      const lote = loteIds.slice(i, i + LIMITE_IDS_D1)
      const parcial = await db
        .select(projecao)
        .from(membros)
        .where(inArray(membros.id, lote))
        .all()
      data.push(...parcial)
    }
  }

  data.sort((a: { id: string; nome: string }, b: { id: string; nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) || a.id.localeCompare(b.id))
  return c.json(data)
})

membrosRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const visibilidade = await idsMembrosVisiveis(c)
  if (visibilidade !== null && !visibilidade.ids.has(id)) {
    return c.json({ error: 'Acesso não autorizado para este membro', code: 'FORBIDDEN' }, 403)
  }

  const projecao = visibilidade === null || visibilidade.idsComCadastroCompleto.has(id)
    ? membroPublico
    : membroParaRelatorio
  const data = await db.select(projecao).from(membros).where(eq(membros.id, id)).get()
  if (!data) return c.json({ error: 'Membro não encontrado' }, 404)

  return c.json(data)
})

membrosRouter.get('/:id/vinculos', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  
  const membroExists = await db.select().from(membros).where(eq(membros.id, id)).get()
  if (!membroExists) return c.json({ error: 'Membro não encontrado' }, 404)

  const visibilidade = await idsMembrosVisiveis(c)
  if (visibilidade !== null && !visibilidade.ids.has(id)) {
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

    if (await existeMesmoNomeNaCasa(db, parsed.nome, parsed.casaId)) {
      return c.json(
        {
          error: 'Já existe um membro com este nome nesta Casa de Oração',
          code: 'NOME_JA_VINCULADO_NA_CASA',
        },
        409
      )
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

    const funcaoDco = await obterFuncaoDco(db)
    if (!funcaoDco) {
      return c.json(
        { error: 'Função Diácono Casa de Oração (DCO) não cadastrada ou inativa', code: 'FUNCAO_DCO_INDISPONIVEL' },
        409
      )
    }

    const id = crypto.randomUUID()
    const agoraCriacao = new Date().toISOString()
    const membroAtivo = parsed.ativo
    const vinculoDco = {
      id: crypto.randomUUID(),
      membroId: id,
      funcaoId: funcaoDco.id,
      casaId: parsed.casaId,
      origem: 'MEMBRO_AUTOMATICO',
      ativo: true,
      createdAt: agoraCriacao,
      updatedAt: agoraCriacao,
    }
    const sincronizacoesDco = membroAtivo
      ? await prepararSincronizacaoConvocacoes(db, vinculoDco, true)
      : []

    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.insert(membros).values({ id, ...parsed }),
        qdb.insert(vinculosFuncionais).values(vinculoDco),
        ...queriesSincronizacaoConvocacoes(qdb, vinculoDco, sincronizacoesDco, agoraCriacao),
      ],
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

    const nomeFinal = parsed.nome ?? existing.nome
    const casaFinalParaValidacao = parsed.casaId ?? existing.casaId
    if (await existeMesmoNomeNaCasa(db, nomeFinal, casaFinalParaValidacao, id)) {
      return c.json(
        {
          error: 'Já existe um membro com este nome nesta Casa de Oração',
          code: 'NOME_JA_VINCULADO_NA_CASA',
        },
        409
      )
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
    const atorContaAcessoId = c.get('contaAcessoId') || null
    const camposAlterados = Object.keys(parsed)
    const moveuCasa = casaFinalId !== existing.casaId
    const agoraAtualizacao = new Date().toISOString()
    const contaDoMembro = moveuCasa
      ? await db
          .select({ id: contasAcesso.id })
          .from(contasAcesso)
          .where(eq(contasAcesso.membroId, id))
          .get()
      : null
    const funcaoDco = moveuCasa ? await obterFuncaoDco(db) : null
    const vinculoDcoDestinoExistente = moveuCasa && funcaoDco
      ? await db
          .select()
          .from(vinculosFuncionais)
          .where(
            and(
              eq(vinculosFuncionais.membroId, id),
              eq(vinculosFuncionais.funcaoId, funcaoDco.id),
              eq(vinculosFuncionais.casaId, casaFinalId),
              eq(vinculosFuncionais.ativo, true)
            )
          )
          .get()
      : null

    if (moveuCasa && !funcaoDco) {
      return c.json(
        { error: 'Função Diácono Casa de Oração (DCO) não cadastrada ou inativa', code: 'FUNCAO_DCO_INDISPONIVEL' },
        409
      )
    }

    const novoVinculoDcoId = vinculoDcoDestinoExistente?.id ?? crypto.randomUUID()
    const novoVinculoDco = moveuCasa && funcaoDco
      ? {
          id: novoVinculoDcoId,
          membroId: id,
          funcaoId: funcaoDco.id,
          casaId: casaFinalId,
          origem: vinculoDcoDestinoExistente?.origem ?? 'MEMBRO_AUTOMATICO',
          ativo: true,
          createdAt: agoraAtualizacao,
          updatedAt: agoraAtualizacao,
        }
      : null
    const membroAtivoFinal = parsed.ativo ?? existing.ativo
    const sincronizacoesDco = novoVinculoDco && membroAtivoFinal
      ? await prepararSincronizacaoConvocacoes(db, novoVinculoDco, true)
      : []

    if (moveuCasa) {
      await executarOperacaoComAudits(
        db,
        (qdb) => {
          const queries = [
            qdb.update(membros)
              .set({ ...parsed, updatedAt: agoraAtualizacao })
              .where(eq(membros.id, id))
          ]

          queries.push(
            qdb.update(vinculosFuncionais)
              .set({ ativo: false, updatedAt: agoraAtualizacao })
              .where(
                and(
                  eq(vinculosFuncionais.membroId, id),
                  eq(vinculosFuncionais.funcaoId, funcaoDco!.id),
                  eq(vinculosFuncionais.casaId, existing.casaId),
                  eq(vinculosFuncionais.ativo, true)
                )
              )
          )

          if (!vinculoDcoDestinoExistente && novoVinculoDco) {
            queries.push(qdb.insert(vinculosFuncionais).values(novoVinculoDco))
          }
          if (novoVinculoDco) {
            queries.push(
              ...queriesSincronizacaoConvocacoes(
                qdb,
                novoVinculoDco,
                sincronizacoesDco,
                agoraAtualizacao
              )
            )
          }

          if (contaDoMembro) {
            queries.push(
              qdb.update(acessosConta)
                .set({
                  ativo: false,
                  revogadoEm: agoraAtualizacao,
                  revogadoPorContaId: atorContaAcessoId,
                  updatedAt: agoraAtualizacao,
                })
                .where(
                  and(
                    eq(acessosConta.contaAcessoId, contaDoMembro.id),
                    eq(acessosConta.perfilCodigo, 'USUARIO_COMUM'),
                    eq(acessosConta.ativo, true)
                  )
                ),
              qdb.insert(acessosConta).values({
                id: crypto.randomUUID(),
                contaAcessoId: contaDoMembro.id,
                perfilCodigo: 'USUARIO_COMUM',
                escopoTipo: 'CASA',
                escopoId: casaFinalId,
                concedidoPorContaId: atorContaAcessoId,
                createdAt: agoraAtualizacao,
                updatedAt: agoraAtualizacao,
              })
            )
          }

          return queries
        },
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
            .set({ ...parsed, updatedAt: agoraAtualizacao })
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

membrosRouter.delete('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  if (!podeEscreverMembros(c.get('contextoPermissoes'))) {
    return c.json({ error: 'Acesso não autorizado para administrar pessoas', code: 'FORBIDDEN' }, 403)
  }

  const existing = await db.select().from(membros).where(eq(membros.id, id)).get()
  if (!existing) return c.json({ error: 'Membro não encontrado' }, 404)

  if (!(await podeAdministrarMembro(c, existing))) {
    return c.json({ error: 'Acesso não autorizado para excluir este membro', code: 'FORBIDDEN' }, 403)
  }

  if (id === c.get('membroId')) {
    return c.json(
      { error: 'Não é permitido excluir o próprio cadastro', code: 'AUTO_EXCLUSAO_NAO_PERMITIDA' },
      409
    )
  }

  try {
    const funcaoDco = await obterFuncaoDco(db)
    const vinculosDcoAutomaticos = funcaoDco
      ? await db
          .select({ id: vinculosFuncionais.id })
          .from(vinculosFuncionais)
          .where(
            and(
              eq(vinculosFuncionais.membroId, id),
              eq(vinculosFuncionais.funcaoId, funcaoDco.id),
              eq(vinculosFuncionais.origem, 'MEMBRO_AUTOMATICO')
            )
          )
          .all()
      : []
    const vinculosDcoAutomaticosIds = vinculosDcoAutomaticos.map(
      (item: { id: string }) => item.id
    )

    await executarOperacaoComAudit(
      db,
      qdb => [
        ...(vinculosDcoAutomaticosIds.length > 0
          ? [
              qdb.delete(vinculosFuncionais).where(
                inArray(vinculosFuncionais.id, vinculosDcoAutomaticosIds)
              ),
            ]
          : []),
        qdb.delete(membros).where(eq(membros.id, id)),
      ],
      {
        acao: 'MEMBRO_EXCLUIDO',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'MEMBRO',
        recursoId: id,
        escopoTipo: 'CASA',
        escopoId: existing.casaId,
        contexto: {
          motivoOperacional: 'Exclusão administrativa de cadastro indevido sem dependências',
        },
      }
    )

    return c.json({ message: 'Membro excluído', id })
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json(
        {
          error:
            'Este membro já possui conta, vínculo, convocação ou outro histórico relacionado. Inative o cadastro em vez de excluí-lo.',
          code: 'MEMBRO_POSSUI_DEPENDENCIAS',
        },
        409
      )
    }
    return c.json({ error: 'Não foi possível excluir o membro' }, 400)
  }
})

