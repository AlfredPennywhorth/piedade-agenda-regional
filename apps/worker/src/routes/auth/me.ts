import { Hono } from 'hono'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { alterarPinSchema, atualizarPerfilSchema } from '@piedade/shared'
import * as schema from '../../db/schema'
import { authMiddleware, Variables } from '../../middleware/auth'
import { obterCapacidadesMembro } from '../../security/permissoes'
import { gerarSalt, hashPin, verifyPin } from '../../security/pin'
import { executeAtomic } from '../../db/batch'

import type { Env } from '../../index'

export const meApp = new Hono<{ Bindings: Env; Variables: Variables }>()

const LIMITE_FALHAS_PIN_ATUAL = 5
const BLOQUEIO_PIN_ATUAL_MS = 15 * 60 * 1000

function respostaPinAtualBloqueado(c: any, bloqueadoAte: Date) {
  const agora = new Date()
  const retryAfter = Math.max(1, Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 1000))
  c.header('Retry-After', String(retryAfter))
  return c.json({ error: 'PIN temporariamente bloqueado', code: 'PIN_BLOQUEADO' }, 429)
}

async function registrarFalhaPinAtual(
  db: any,
  conta: typeof schema.contasAcesso.$inferSelect,
  membroId: string
) {
  const agora = new Date()
  const agoraIso = agora.toISOString()
  const bloqueioIso = new Date(agora.getTime() + BLOQUEIO_PIN_ATUAL_MS).toISOString()

  const montarUpdate = (qdb: any) =>
    qdb
      .update(schema.contasAcesso)
      .set({
        tentativasPin: sql`${schema.contasAcesso.tentativasPin} + 1`,
        bloqueadoAte: sql`CASE
          WHEN ${schema.contasAcesso.tentativasPin} + 1 >= ${LIMITE_FALHAS_PIN_ATUAL}
          THEN ${bloqueioIso}
          ELSE ${schema.contasAcesso.bloqueadoAte}
        END`,
        updatedAt: agoraIso,
      })
      .where(eq(schema.contasAcesso.id, conta.id))
      .returning({
        tentativasPin: schema.contasAcesso.tentativasPin,
        bloqueadoAte: schema.contasAcesso.bloqueadoAte,
      })

  const montarAuditoria = (qdb: any) =>
    qdb.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId,
      tipo: 'VERIFICACAO_PIN_ATUAL',
      sucesso: false,
      motivo: 'PIN atual inválido',
    })

  let atualizada: { tentativasPin: number; bloqueadoAte: string | null } | undefined

  if (db && 'batch' in db && typeof db.batch === 'function') {
    const resultados = await db.batch([montarUpdate(db), montarAuditoria(db)])
    atualizada = Array.isArray(resultados?.[0]) ? resultados[0][0] : resultados?.[0]
  } else if (db && 'transaction' in db && typeof db.transaction === 'function') {
    atualizada = await db.transaction((tx: any) => {
      const contaAtualizada = montarUpdate(tx).get()
      montarAuditoria(tx).run()
      return contaAtualizada
    })
  } else {
    throw new Error('Nenhum mecanismo atômico disponível para registrar falha de PIN.')
  }

  return atualizada?.bloqueadoAte ?? null
}

meApp.use('*', authMiddleware)

meApp.get('/', async c => {
  const membroId = c.get('membroId')
  const contaAcessoId = c.get('contaAcessoId')
  const db = c.get('db')

  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const identidade = await db
    .select({
      membro: schema.membros,
      conta: schema.contasAcesso,
      casaNome: schema.casas.nome,
      casaCodigo: schema.casas.codigo,
      setorNome: schema.setores.nome,
      administracaoNome: schema.administracoes.nome,
      regionalNome: schema.regionais.nome,
    })
    .from(schema.membros)
    .innerJoin(schema.contasAcesso, eq(schema.contasAcesso.membroId, schema.membros.id))
    .innerJoin(schema.casas, eq(schema.casas.id, schema.membros.casaId))
    .innerJoin(schema.setores, eq(schema.setores.id, schema.casas.setorId))
    .innerJoin(schema.administracoes, eq(schema.administracoes.id, schema.setores.administracaoId))
    .innerJoin(schema.regionais, eq(schema.regionais.id, schema.administracoes.regionalId))
    .where(eq(schema.contasAcesso.id, contaAcessoId))
    .get()

  if (!identidade || identidade.membro.id !== membroId) {
    return c.json({ error: 'Membro não encontrado' }, 404)
  }

  const { membro, conta } = identidade
  const capacidades = await obterCapacidadesMembro(db, membroId, contaAcessoId)

  return c.json(
    {
      id: membro.id,
      nome: membro.nome,
      celular: membro.celular,
      codigoCarteirinha: membro.codigoCarteirinha,
      dataOrdenacao: membro.dataOrdenacao,
      casaId: membro.casaId,
      casa: {
        nome: identidade.casaNome,
        codigo: identidade.casaCodigo,
        setor: identidade.setorNome,
        administracao: identidade.administracaoNome,
        regional: identidade.regionalNome,
      },
      ativo: membro.ativo,
      autenticacaoAtiva: conta.status === 'ATIVA',
      ativadoEm: conta.ativadoEm,
      conta: {
        id: conta.id,
        status: conta.status,
      },
      capacidades,
    },
    200
  )
})

meApp.patch('/', async c => {
  const membroId = c.get('membroId')
  const contaAcessoId = c.get('contaAcessoId')
  const db = c.get('db')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  const parsed = atualizarPerfilSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues, code: 'VALIDATION_ERROR' }, 400)
  }

  const identidade = await db
    .select({
      membro: schema.membros,
      conta: schema.contasAcesso,
    })
    .from(schema.membros)
    .innerJoin(schema.contasAcesso, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(eq(schema.contasAcesso.id, contaAcessoId))
    .get()

  if (!identidade || identidade.membro.id !== membroId || !identidade.conta.pinHash) {
    return c.json({ error: 'Conta indisponível', code: 'CONTA_INDISPONIVEL' }, 409)
  }

  if (
    identidade.conta.bloqueadoAte &&
    new Date() < new Date(identidade.conta.bloqueadoAte)
  ) {
    return respostaPinAtualBloqueado(c, new Date(identidade.conta.bloqueadoAte))
  }

  const pepper = c.env?.PIN_PEPPER || 'test-pepper'
  const pinValido = await verifyPin(parsed.data.pinAtual, pepper, identidade.conta.pinHash)
  if (!pinValido) {
    const bloqueadoAte = await registrarFalhaPinAtual(
      db,
      identidade.conta,
      membroId
    )
    if (bloqueadoAte) {
      return respostaPinAtualBloqueado(c, new Date(bloqueadoAte))
    }
    return c.json({ error: 'PIN atual inválido', code: 'CREDENCIAIS_INVALIDAS' }, 401)
  }

  if (parsed.data.celular !== identidade.membro.celular) {
    const conflito = await db
      .select({ id: schema.membros.id })
      .from(schema.membros)
      .where(eq(schema.membros.celular, parsed.data.celular))
      .get()

    if (conflito && conflito.id !== membroId) {
      return c.json({ error: 'Celular já vinculado a outro membro', code: 'CELULAR_JA_VINCULADO' }, 409)
    }
  }

  const agora = new Date().toISOString()
  await executeAtomic(db, tx => [
    tx
      .update(schema.contasAcesso)
      .set({ tentativasPin: 0, bloqueadoAte: null, updatedAt: agora })
      .where(eq(schema.contasAcesso.id, contaAcessoId)),
    tx
      .update(schema.membros)
      .set({ celular: parsed.data.celular, updatedAt: agora })
      .where(eq(schema.membros.id, membroId)),
    tx.insert(schema.auditoriaLogs).values({
      id: crypto.randomUUID(),
      acao: 'PERFIL_CELULAR_ATUALIZADO',
      atorMembroId: membroId,
      atorContaAcessoId: contaAcessoId,
      recursoTipo: 'MEMBRO',
      recursoId: membroId,
      escopoTipo: 'CASA',
      escopoId: identidade.membro.casaId,
      contexto: JSON.stringify({ alteracao: 'CELULAR' }),
      criadoEm: agora,
    }),
  ])

  return c.json({ message: 'Celular atualizado com sucesso', celular: parsed.data.celular }, 200)
})

meApp.post('/alterar-pin', async c => {
  const membroId = c.get('membroId')
  const contaAcessoId = c.get('contaAcessoId')
  const db = c.get('db')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  const parsed = alterarPinSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues, code: 'VALIDATION_ERROR' }, 400)
  }

  const conta = await db
    .select()
    .from(schema.contasAcesso)
    .where(eq(schema.contasAcesso.id, contaAcessoId))
    .get()

  if (!conta || !conta.pinHash || conta.status !== 'ATIVA') {
    return c.json({ error: 'Conta indisponível', code: 'CONTA_INDISPONIVEL' }, 409)
  }

  if (conta.bloqueadoAte && new Date() < new Date(conta.bloqueadoAte)) {
    return respostaPinAtualBloqueado(c, new Date(conta.bloqueadoAte))
  }

  const pepper = c.env?.PIN_PEPPER || 'test-pepper'
  const pinValido = await verifyPin(parsed.data.pinAtual, pepper, conta.pinHash)
  if (!pinValido) {
    const bloqueadoAte = await registrarFalhaPinAtual(db, conta, membroId)
    if (bloqueadoAte) {
      return respostaPinAtualBloqueado(c, new Date(bloqueadoAte))
    }
    return c.json({ error: 'PIN atual inválido', code: 'CREDENCIAIS_INVALIDAS' }, 401)
  }

  const agora = new Date().toISOString()
  const salt = gerarSalt()
  const novoHash = await hashPin(parsed.data.novoPin, salt, pepper)

  await executeAtomic(db, tx => [
    tx
      .update(schema.contasAcesso)
      .set({
        pinHash: novoHash,
        pinSalt: salt,
        tentativasPin: 0,
        bloqueadoAte: null,
        updatedAt: agora,
      })
      .where(eq(schema.contasAcesso.id, contaAcessoId)),
    tx
      .update(schema.sessoes)
      .set({ revogadoEm: agora })
      .where(
        and(
          eq(schema.sessoes.contaAcessoId, contaAcessoId),
          isNull(schema.sessoes.revogadoEm)
        )
      ),
    tx.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId,
      membroId,
      tipo: 'ALTERACAO_PIN',
      sucesso: true,
    }),
    tx.insert(schema.auditoriaLogs).values({
      id: crypto.randomUUID(),
      acao: 'PIN_ALTERADO_PELO_USUARIO',
      atorMembroId: membroId,
      atorContaAcessoId: contaAcessoId,
      recursoTipo: 'CONTA_ACESSO',
      recursoId: contaAcessoId,
      contexto: JSON.stringify({ sessoesRevogadas: true }),
      criadoEm: agora,
    }),
  ])

  return c.json(
    {
      message: 'PIN alterado com sucesso. Entre novamente com o novo PIN.',
      requerNovoLogin: true,
    },
    200
  )
})

meApp.get('/vinculos', async c => {
  const contextoPermissoes = c.get('contextoPermissoes')
  return c.json(contextoPermissoes, 200)
})
