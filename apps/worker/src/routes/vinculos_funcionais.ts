import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { vinculosFuncionais } from '../db/schema'
import { CreateVinculoFuncionalSchema, UpdateVinculoFuncionalSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { exigirMasterParaEscrita } from '../middleware/master-write'

export const vinculosFuncionaisRouter = new Hono<any>()

vinculosFuncionaisRouter.use('*', authMiddleware)
vinculosFuncionaisRouter.use('*', exigirMasterParaEscrita)

vinculosFuncionaisRouter.get('/', async (c) => {
  const db = c.get('db')
  const data = await db.select().from(vinculosFuncionais).all()
  return c.json(data)
})

vinculosFuncionaisRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(vinculosFuncionais).where(eq(vinculosFuncionais.id, id)).get()
  
  if (!data) return c.json({ error: 'Vínculo funcional não encontrado' }, 404)
  return c.json(data)
})

vinculosFuncionaisRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateVinculoFuncionalSchema.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(vinculosFuncionais).values({ id, ...parsed }).returning().get()
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
  try {
    const body = await c.req.json()
    const parsed = UpdateVinculoFuncionalSchema.parse(body)
    
    const existing = await db.select().from(vinculosFuncionais).where(eq(vinculosFuncionais.id, id)).get()
    if (!existing) return c.json({ error: 'Vínculo funcional não encontrado' }, 404)

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

    const updated = await db.update(vinculosFuncionais)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(vinculosFuncionais.id, id))
      .returning().get()
      
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
