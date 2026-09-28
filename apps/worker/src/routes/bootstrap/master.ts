import { Hono } from 'hono'
import { and, eq, isNull } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { executeAtomic } from '../../db/batch'
import type { Env } from '../../index'
import { gerarTokenAleatorio, hashToken } from '../../security/tokens'

type BootstrapVariables = { db: any }

const CONFIRMACAO_BOOTSTRAP = 'CRIAR PRIMEIRO MASTER'
const VALIDADE_LINK_ATIVACAO_MS = 7 * 24 * 60 * 60 * 1000

async function segredoCorresponde(recebido: string, esperado: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [hashRecebido, hashEsperado] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(recebido)),
    crypto.subtle.digest('SHA-256', encoder.encode(esperado)),
  ])

  const a = new Uint8Array(hashRecebido)
  const b = new Uint8Array(hashEsperado)
  let diferenca = 0
  for (let i = 0; i < a.length; i += 1) diferenca |= a[i] ^ b[i]
  return diferenca === 0
}

export const bootstrapMasterApp = new Hono<{
  Bindings: Env
  Variables: BootstrapVariables
}>()

bootstrapMasterApp.post('/', async c => {
  const db = c.get('db')
  const segredoConfigurado = c.env?.MASTER_BOOTSTRAP_SECRET
  const segredoRecebido = c.req.header('X-Bootstrap-Secret') ?? ''

  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  if (
    !segredoConfigurado ||
    segredoConfigurado.length < 32 ||
    !segredoRecebido ||
    !(await segredoCorresponde(segredoRecebido, segredoConfigurado))
  ) {
    return c.json({ error: 'Operação não autorizada', code: 'UNAUTHORIZED' }, 401)
  }

  let body: { codigoCarteirinha?: string; confirmacao?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  if (
    !body.codigoCarteirinha ||
    body.confirmacao !== CONFIRMACAO_BOOTSTRAP
  ) {
    return c.json(
      {
        error: 'Código da carteirinha e confirmação explícita são obrigatórios',
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  const bootstrapExistente = await db
    .select({
      id: schema.bootstrapMaster.id,
      contaAcessoId: schema.bootstrapMaster.contaAcessoId,
      contaStatus: schema.contasAcesso.status,
      membroId: schema.membros.id,
      codigoCarteirinha: schema.membros.codigoCarteirinha,
      celular: schema.membros.celular,
      membroAtivo: schema.membros.ativo,
    })
    .from(schema.bootstrapMaster)
    .innerJoin(
      schema.contasAcesso,
      eq(schema.bootstrapMaster.contaAcessoId, schema.contasAcesso.id)
    )
    .innerJoin(schema.membros, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(eq(schema.bootstrapMaster.id, 'PRIMEIRO_MASTER'))
    .get()

  if (
    bootstrapExistente &&
    bootstrapExistente.contaStatus === 'PENDENTE_ATIVACAO' &&
    bootstrapExistente.membroAtivo &&
    bootstrapExistente.celular &&
    bootstrapExistente.codigoCarteirinha === body.codigoCarteirinha
  ) {
    const agora = new Date().toISOString()
    const tokenAtivacao = gerarTokenAleatorio()
    const tokenAtivacaoHash = await hashToken(tokenAtivacao)
    const expiraEmAtivacao = new Date(Date.now() + VALIDADE_LINK_ATIVACAO_MS).toISOString()

    await executeAtomic(db, tx => [
      tx
        .update(schema.linksAtivacao)
        .set({ revogadoEm: agora, updatedAt: agora })
        .where(
          and(
            eq(schema.linksAtivacao.contaAcessoId, bootstrapExistente.contaAcessoId),
            isNull(schema.linksAtivacao.utilizadoEm),
            isNull(schema.linksAtivacao.revogadoEm)
          )
        ),
      tx.insert(schema.linksAtivacao).values({
        id: crypto.randomUUID(),
        contaAcessoId: bootstrapExistente.contaAcessoId,
        membroId: bootstrapExistente.membroId,
        tokenHash: tokenAtivacaoHash,
        expiraEm: expiraEmAtivacao,
        createdAt: agora,
        updatedAt: agora,
      }),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'BOOTSTRAP_MASTER_LINK_REGERADO',
        atorMembroId: bootstrapExistente.membroId,
        atorContaAcessoId: bootstrapExistente.contaAcessoId,
        recursoTipo: 'CONTA_ACESSO',
        recursoId: bootstrapExistente.contaAcessoId,
        escopoTipo: 'GLOBAL',
        escopoId: null,
        contexto: JSON.stringify({ motivo: 'MASTER_PENDENTE_ATIVACAO' }),
        criadoEm: agora,
      }),
    ])

    return c.json(
      {
        message: 'Link de ativação do primeiro Master regenerado com sucesso',
        perfilCodigo: 'MASTER_SISTEMA',
        escopoTipo: 'GLOBAL',
        tokenAtivacao,
        expiraEmAtivacao,
      },
      200
    )
  }

  const masterExistente = await db
    .select({ id: schema.acessosConta.id })
    .from(schema.acessosConta)
    .where(
      and(
        eq(schema.acessosConta.perfilCodigo, 'MASTER_SISTEMA'),
        eq(schema.acessosConta.ativo, true)
      )
    )
    .get()

  if (bootstrapExistente || masterExistente) {
    return c.json({ error: 'Bootstrap do Master já concluído', code: 'BOOTSTRAP_CONCLUIDO' }, 409)
  }

  const identidade = await db
    .select({
      membroId: schema.membros.id,
      membroAtivo: schema.membros.ativo,
      contaAcessoId: schema.contasAcesso.id,
      contaStatus: schema.contasAcesso.status,
      celular: schema.membros.celular,
    })
    .from(schema.membros)
    .leftJoin(schema.contasAcesso, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(eq(schema.membros.codigoCarteirinha, body.codigoCarteirinha))
    .get()

  if (
    !identidade ||
    !identidade.membroAtivo ||
    !identidade.celular ||
    ['BLOQUEADA', 'DESATIVADA'].includes(identidade.contaStatus ?? '')
  ) {
    return c.json(
      { error: 'Conta ativa elegível não encontrada', code: 'CONTA_INELEGIVEL' },
      404
    )
  }

  const agora = new Date().toISOString()
  const acessoId = crypto.randomUUID()
  const contaAcessoId = identidade.contaAcessoId ?? crypto.randomUUID()
  const precisaAtivacao = !identidade.contaAcessoId || identidade.contaStatus === 'PENDENTE_ATIVACAO'
  const tokenAtivacao = precisaAtivacao ? gerarTokenAleatorio() : null
  const tokenAtivacaoHash = tokenAtivacao ? await hashToken(tokenAtivacao) : null
  const expiraEmAtivacao = precisaAtivacao
    ? new Date(Date.now() + VALIDADE_LINK_ATIVACAO_MS).toISOString()
    : null

  try {
    await executeAtomic(db, tx => {
      const queries = []

      if (!identidade.contaAcessoId) {
        queries.push(
          tx.insert(schema.contasAcesso).values({
            id: contaAcessoId,
            membroId: identidade.membroId,
            status: 'PENDENTE_ATIVACAO',
            createdAt: agora,
            updatedAt: agora,
          })
        )
      }

      if (tokenAtivacao && tokenAtivacaoHash && expiraEmAtivacao) {
        queries.push(
          tx
            .update(schema.linksAtivacao)
            .set({ revogadoEm: agora, updatedAt: agora })
            .where(
              and(
                eq(schema.linksAtivacao.contaAcessoId, contaAcessoId),
                isNull(schema.linksAtivacao.utilizadoEm),
                isNull(schema.linksAtivacao.revogadoEm)
              )
            ),
          tx.insert(schema.linksAtivacao).values({
            id: crypto.randomUUID(),
            contaAcessoId,
            membroId: identidade.membroId,
            tokenHash: tokenAtivacaoHash,
            expiraEm: expiraEmAtivacao,
            createdAt: agora,
            updatedAt: agora,
          })
        )
      }

      queries.push(
        tx.insert(schema.acessosConta).values({
          id: acessoId,
          contaAcessoId,
          perfilCodigo: 'MASTER_SISTEMA',
          escopoTipo: 'GLOBAL',
          escopoId: null,
          concedidoPorContaId: contaAcessoId,
          createdAt: agora,
          updatedAt: agora,
        }),
        tx.insert(schema.bootstrapMaster).values({
          id: 'PRIMEIRO_MASTER',
          contaAcessoId,
          concluidoEm: agora,
        }),
        tx.insert(schema.auditoriaLogs).values({
          id: crypto.randomUUID(),
          acao: 'BOOTSTRAP_PRIMEIRO_MASTER',
          atorMembroId: identidade.membroId,
          atorContaAcessoId: contaAcessoId,
          recursoTipo: 'ACESSO_CONTA',
          recursoId: acessoId,
          escopoTipo: 'GLOBAL',
          escopoId: null,
          contexto: JSON.stringify({ perfilCodigo: 'MASTER_SISTEMA' }),
          criadoEm: agora,
        })
      )

      return queries
    })
  } catch {
    return c.json({ error: 'Bootstrap do Master já concluído', code: 'BOOTSTRAP_CONCLUIDO' }, 409)
  }

  return c.json(
    {
      message: 'Primeiro Master criado com sucesso',
      acessoId,
      perfilCodigo: 'MASTER_SISTEMA',
      escopoTipo: 'GLOBAL',
      ...(tokenAtivacao ? { tokenAtivacao, expiraEmAtivacao } : {}),
    },
    201
  )
})
