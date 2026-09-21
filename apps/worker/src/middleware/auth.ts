import { Context, Next } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { carregarContextoPermissoes, ContextoPermissoes } from '../security/permissoes'

export type Variables = {
  db: any
  membroId: string
  contaAcessoId: string
  contextoPermissoes: ContextoPermissoes
}

const INATIVIDADE_MAXIMA_MS = 12 * 60 * 60 * 1000
const VALIDADE_ABSOLUTA_MS = 30 * 24 * 60 * 60 * 1000
const INTERVALO_ATUALIZACAO_ATIVIDADE_MS = 5 * 60 * 1000

export async function authMiddleware(c: Context<{ Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED' }, 401)
  }

  const token = authHeader.substring(7)

  if (!token) {
    return c.json({ error: 'Token inválido', code: 'UNAUTHORIZED' }, 401)
  }

  const hashedToken = await hashToken(token)
  const db = c.get('db')

  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const agora = new Date().toISOString()

  const [result] = await db
    .select({
      sessao: schema.sessoes,
      conta: schema.contasAcesso,
      membro: schema.membros,
    })
    .from(schema.sessoes)
    .innerJoin(
      schema.contasAcesso,
      eq(schema.sessoes.contaAcessoId, schema.contasAcesso.id)
    )
    .innerJoin(schema.membros, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(and(eq(schema.sessoes.tokenHash, hashedToken), isNull(schema.sessoes.revogadoEm)))
    .limit(1)

  if (!result || !result.membro || !result.conta) {
    return c.json({ error: 'Sessão inválida ou expirada', code: 'UNAUTHORIZED' }, 401)
  }

  const { sessao, conta, membro } = result
  const instanteAtual = Date.now()
  const criadaEm = new Date(sessao.createdAt).getTime()
  const ultimoAcessoEm = new Date(sessao.ultimoAcessoEm ?? sessao.createdAt).getTime()
  const expiradaPorInatividade = instanteAtual - ultimoAcessoEm >= INATIVIDADE_MAXIMA_MS
  const expiradaPorIdade = instanteAtual - criadaEm >= VALIDADE_ABSOLUTA_MS
  const expiradaPorPrazo = new Date(sessao.expiraEm).getTime() <= instanteAtual

  if (expiradaPorInatividade || expiradaPorIdade || expiradaPorPrazo) {
    return c.json({ error: 'Sessão inválida ou expirada', code: 'UNAUTHORIZED' }, 401)
  }

  if (!membro.ativo || conta.status !== 'ATIVA') {
    return c.json({ error: 'Acesso bloqueado', code: 'FORBIDDEN' }, 403)
  }

  if (instanteAtual - ultimoAcessoEm >= INTERVALO_ATUALIZACAO_ATIVIDADE_MS) {
    await db
      .update(schema.sessoes)
      .set({ ultimoAcessoEm: agora })
      .where(eq(schema.sessoes.id, sessao.id))
      .execute()
  }

  const contextoPermissoes = await carregarContextoPermissoes(db, membro.id)

  c.set('membroId', membro.id)
  c.set('contaAcessoId', conta.id)
  c.set('contextoPermissoes', contextoPermissoes)

  await next()
}
