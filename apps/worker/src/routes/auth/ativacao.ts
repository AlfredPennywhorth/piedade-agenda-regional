import { Hono } from 'hono'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { ativacaoSchema } from '@piedade/shared'
import * as schema from '../../db/schema'
import { hashToken, gerarTokenAleatorio } from '../../security/tokens'
import { gerarSalt, hashPin } from '../../security/pin'
import { executeAtomic } from '../../db/batch'

export const ativacaoApp = new Hono<{ Variables: { db: any } }>()

ativacaoApp.post('/', async (c) => {
  const body = await c.req.json()
  const result = ativacaoSchema.safeParse(body)

  if (!result.success) {
    return c.json({ error: 'Dados inválidos', details: result.error.flatten() }, 400)
  }

  const { token, celular, dataNascimento, pin } = result.data
  const hashedToken = await hashToken(token)

  const db = c.get('db')
  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const agora = new Date().toISOString()

  // Buscar link de ativação válido e membro
  const [queryResult] = await db
    .select({
      link: schema.linksAtivacao,
      membro: schema.membros
    })
    .from(schema.linksAtivacao)
    .innerJoin(schema.membros, eq(schema.linksAtivacao.membroId, schema.membros.id))
    .where(
      and(
        eq(schema.linksAtivacao.tokenHash, hashedToken),
        isNull(schema.linksAtivacao.utilizadoEm),
        isNull(schema.linksAtivacao.revogadoEm),
        gt(schema.linksAtivacao.expiraEm, agora)
      )
    )
    .limit(1)

  if (!queryResult || !queryResult.membro) {
    // Registrar tentativa falha sem expor erro específico de membro
    await db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      membroId: queryResult?.link?.membroId || null,
      tipo: 'ATIVACAO',
      sucesso: false,
      motivo: 'Token inválido, expirado ou revogado'
    })
    return c.json({ error: 'Link de ativação inválido ou expirado' }, 400)
  }

  const { link, membro } = queryResult

  if (!membro.ativo) {
    await db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      membroId: membro.id,
      tipo: 'ATIVACAO',
      sucesso: false,
      motivo: 'Membro inativo'
    })
    return c.json({ error: 'Link de ativação inválido ou expirado' }, 400)
  }

  if (membro.celular !== celular || membro.dataNascimento !== dataNascimento) {
    await db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      membroId: membro.id,
      tipo: 'ATIVACAO',
      sucesso: false,
      motivo: 'Dados cadastrais não conferem'
    })
    return c.json({ error: 'Dados informados não conferem com o cadastro' }, 400)
  }

  // Gera salt e hash do PIN
  const salt = gerarSalt()
  const hashedPin = await hashPin(pin, salt)

  // 4. (Opcional - Requisito) Criar sessão automática
  const sessionToken = gerarTokenAleatorio()
  const hashedSessionToken = await hashToken(sessionToken)
  const expiraEmSessao = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 dias

  // Executa as operações
  await executeAtomic(db, (tx) => {
    const dbBatch = []

    // 1. Marcar link como utilizado
    dbBatch.push(
      tx.update(schema.linksAtivacao)
        .set({ utilizadoEm: agora, updatedAt: agora })
        .where(eq(schema.linksAtivacao.id, link.id))
    )

    // 2. Atualizar membro
    dbBatch.push(
      tx.update(schema.membros)
        .set({
          autenticacaoAtiva: true,
          pinHash: hashedPin,
          pinSalt: salt,
          tentativasPin: 0,
          bloqueadoAte: null,
          ativadoEm: agora,
          updatedAt: agora
        })
        .where(eq(schema.membros.id, membro.id))
    )

    // 3. Registrar tentativa de sucesso
    dbBatch.push(
      tx.insert(schema.tentativasAcesso).values({
        id: crypto.randomUUID(),
        membroId: membro.id,
        tipo: 'ATIVACAO',
        sucesso: true
      })
    )

    // 4. (Opcional - Requisito) Criar sessão automática
    dbBatch.push(
      tx.insert(schema.sessoes).values({
        id: crypto.randomUUID(),
        membroId: membro.id,
        tokenHash: hashedSessionToken,
        expiraEm: expiraEmSessao,
        userAgent: c.req.header('User-Agent') || null
      })
    )

    return dbBatch
  })

  return c.json({
    message: 'Ativação concluída com sucesso',
    sessionToken // Token puro retornado 1 única vez
  }, 200)
})
