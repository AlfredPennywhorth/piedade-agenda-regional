import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { loginSchema } from '@piedade/shared'
import * as schema from '../../db/schema'
import { verifyPin } from '../../security/pin'
import { hashToken, gerarTokenAleatorio } from '../../security/tokens'

export const loginApp = new Hono<{ Variables: { db: any } }>()

const LIMITE_TENTATIVAS = 5
const TEMPO_BLOQUEIO_MS = 15 * 60 * 1000 // 15 minutos

loginApp.post('/', async (c) => {
  const body = await c.req.json()
  const result = loginSchema.safeParse(body)

  if (!result.success) {
    return c.json({ error: 'Credenciais inválidas' }, 400)
  }

  const { identificador, pin } = result.data
  
  const db = c.get('db')
  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const agora = new Date()

  const [membro] = await db
    .select()
    .from(schema.membros)
    .where(eq(schema.membros.celular, identificador))
    .limit(1)

  // Mensagem genérica para não enumerar usuários
  const errorMsg = 'Credenciais inválidas'

  if (!membro || !membro.ativo || !membro.autenticacaoAtiva) {
    await db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      membroId: membro?.id || null,
      tipo: 'LOGIN_PIN',
      sucesso: false,
      motivo: !membro ? 'Membro não encontrado' : 'Membro inativo ou não ativado'
    })
    return c.json({ error: errorMsg }, 401)
  }

  if (membro.bloqueadoAte) {
    const bloqueadoAte = new Date(membro.bloqueadoAte)
    if (agora < bloqueadoAte) {
      await db.insert(schema.tentativasAcesso).values({
        id: crypto.randomUUID(),
        membroId: membro.id,
        tipo: 'LOGIN_PIN',
        sucesso: false,
        motivo: 'Conta temporariamente bloqueada'
      })
      return c.json({ error: 'Muitas tentativas inválidas. Tente novamente mais tarde.' }, 429)
    }
  }

  // Verificar PIN
  const pinValido = await verifyPin(pin, membro.pinSalt!, membro.pinHash!)

  if (!pinValido) {
    const tentativas = membro.tentativasPin + 1
    const bloqueadoAteStr = tentativas >= LIMITE_TENTATIVAS 
      ? new Date(agora.getTime() + TEMPO_BLOQUEIO_MS).toISOString() 
      : null

    await db.batch([
      db.update(schema.membros)
        .set({
          tentativasPin: tentativas,
          bloqueadoAte: bloqueadoAteStr,
          updatedAt: agora.toISOString()
        })
        .where(eq(schema.membros.id, membro.id)),
      db.insert(schema.tentativasAcesso).values({
        id: crypto.randomUUID(),
        membroId: membro.id,
        tipo: 'LOGIN_PIN',
        sucesso: false,
        motivo: 'PIN inválido'
      })
    ] as any)

    return c.json({ error: errorMsg }, 401)
  }

  // Sucesso no PIN
  const sessionToken = gerarTokenAleatorio()
  const hashedSessionToken = await hashToken(sessionToken)
  const expiraEm = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 dias

  await db.batch([
    // Zera contadores
    db.update(schema.membros)
      .set({
        tentativasPin: 0,
        bloqueadoAte: null,
        updatedAt: agora.toISOString()
      })
      .where(eq(schema.membros.id, membro.id)),
    // Cria sessão
    db.insert(schema.sessoes).values({
      id: crypto.randomUUID(),
      membroId: membro.id,
      tokenHash: hashedSessionToken,
      expiraEm,
      userAgent: c.req.header('User-Agent') || null
    }),
    // Registra tentativa
    db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      membroId: membro.id,
      tipo: 'LOGIN_PIN',
      sucesso: true
    })
  ] as any)

  return c.json({ sessionToken }, 200)
})
