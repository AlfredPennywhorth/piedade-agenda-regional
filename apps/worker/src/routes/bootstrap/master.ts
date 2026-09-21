import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { executeAtomic } from '../../db/batch'
import type { Env } from '../../index'

type BootstrapVariables = { db: any }

const CONFIRMACAO_BOOTSTRAP = 'CRIAR PRIMEIRO MASTER'

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
    .select({ id: schema.bootstrapMaster.id })
    .from(schema.bootstrapMaster)
    .where(eq(schema.bootstrapMaster.id, 'PRIMEIRO_MASTER'))
    .get()

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
    })
    .from(schema.membros)
    .innerJoin(schema.contasAcesso, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(eq(schema.membros.codigoCarteirinha, body.codigoCarteirinha))
    .get()

  if (!identidade || !identidade.membroAtivo || identidade.contaStatus !== 'ATIVA') {
    return c.json(
      { error: 'Conta ativa elegível não encontrada', code: 'CONTA_INELEGIVEL' },
      404
    )
  }

  const agora = new Date().toISOString()
  const acessoId = crypto.randomUUID()

  try {
    await executeAtomic(db, tx => [
      tx.insert(schema.acessosConta).values({
        id: acessoId,
        contaAcessoId: identidade.contaAcessoId,
        perfilCodigo: 'MASTER_SISTEMA',
        escopoTipo: 'GLOBAL',
        escopoId: null,
        concedidoPorContaId: identidade.contaAcessoId,
        createdAt: agora,
        updatedAt: agora,
      }),
      tx.insert(schema.bootstrapMaster).values({
        id: 'PRIMEIRO_MASTER',
        contaAcessoId: identidade.contaAcessoId,
        concluidoEm: agora,
      }),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'BOOTSTRAP_PRIMEIRO_MASTER',
        atorMembroId: identidade.membroId,
        atorContaAcessoId: identidade.contaAcessoId,
        recursoTipo: 'ACESSO_CONTA',
        recursoId: acessoId,
        escopoTipo: 'GLOBAL',
        escopoId: null,
        contexto: JSON.stringify({ perfilCodigo: 'MASTER_SISTEMA' }),
        criadoEm: agora,
      }),
    ])
  } catch {
    return c.json({ error: 'Bootstrap do Master já concluído', code: 'BOOTSTRAP_CONCLUIDO' }, 409)
  }

  return c.json(
    {
      message: 'Primeiro Master criado com sucesso',
      acessoId,
      perfilCodigo: 'MASTER_SISTEMA',
      escopoTipo: 'GLOBAL',
    },
    201
  )
})
