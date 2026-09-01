import { Context, Next } from 'hono'
import { eq, and, isNull, gt } from 'drizzle-orm'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { carregarContextoPermissoes, ContextoPermissoes } from '../security/permissoes'

export type Variables = {
  db: any
  membroId: string
  contextoPermissoes: ContextoPermissoes
}

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

  // Busca a sessão e o membro manualmente com JOIN
  const agora = new Date().toISOString()
  
  const [result] = await db
    .select({
      sessao: schema.sessoes,
      membro: schema.membros
    })
    .from(schema.sessoes)
    .innerJoin(schema.membros, eq(schema.sessoes.membroId, schema.membros.id))
    .where(
      and(
        eq(schema.sessoes.tokenHash, hashedToken),
        isNull(schema.sessoes.revogadoEm),
        gt(schema.sessoes.expiraEm, agora)
      )
    )
    .limit(1)

  if (!result || !result.membro) {
    return c.json({ error: 'Sessão inválida ou expirada', code: 'UNAUTHORIZED' }, 401)
  }

  const { sessao, membro } = result

  // Verifica se membro está ativo e tem autenticação ativa
  if (!membro.ativo || !membro.autenticacaoAtiva) {
    return c.json({ error: 'Acesso bloqueado', code: 'FORBIDDEN' }, 403)
  }

  // Atualizar último acesso em background
  if (c.executionCtx) {
    c.executionCtx.waitUntil(
      db.update(schema.sessoes)
        .set({ ultimoAcessoEm: agora })
        .where(eq(schema.sessoes.id, sessao.id))
        .execute()
    )
  }

  // Carrega permissões
  const contextoPermissoes = await carregarContextoPermissoes(db, sessao.membroId)

  c.set('membroId', sessao.membroId)
  c.set('contextoPermissoes', contextoPermissoes)

  await next()
}
