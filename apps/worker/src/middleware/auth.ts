import { Context, Next } from 'hono'
import { env } from 'hono/adapter'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { carregarContextoPermissoes, ContextoPermissoes } from '../security/permissoes'

type Bindings = {
  DB: D1Database
}

export type Variables = {
  membroId: string
  contextoPermissoes: ContextoPermissoes
}

export async function authMiddleware(c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED' }, 401)
  }

  const token = authHeader.substring(7)
  
  if (!token) {
    return c.json({ error: 'Token inválido', code: 'UNAUTHORIZED' }, 401)
  }

  const hashedToken = await hashToken(token)

  const db = drizzle(c.env.DB, { schema })

  // Busca a sessão
  const agora = new Date().toISOString()
  
  const sessao = await db.query.sessoes.findFirst({
    where: and(
      eq(schema.sessoes.tokenHash, hashedToken),
      isNull(schema.sessoes.revogadoEm),
      gt(schema.sessoes.expiraEm, agora)
    ),
    with: {
      membro: true
    }
  })

  if (!sessao || !sessao.membro) {
    return c.json({ error: 'Sessão inválida ou expirada', code: 'UNAUTHORIZED' }, 401)
  }

  // Verifica se membro está ativo e tem autenticação ativa
  if (!sessao.membro.ativo || !sessao.membro.autenticacaoAtiva) {
    return c.json({ error: 'Acesso bloqueado', code: 'FORBIDDEN' }, 403)
  }

  // Atualizar último acesso em background (promises.all ou apenas ignorar o await no Hono context? No Cloudflare Workers, waitUntil() é o ideal, mas por agora atualizamos sync ou ignoramos para simplificar na S03)
  // Vamos usar waitUntil() se c.executionCtx estiver disponível
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
