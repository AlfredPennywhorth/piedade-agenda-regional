import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { setupDb } from './setup'
import { eq } from 'drizzle-orm'
import { enviarAvisosConvocacao } from '../services/notificacoes-service'
import * as webPush from '../services/web-push'

describe('S10 - Notificações (Web Push)', () => {
  let sqlite: any
  let db: ReturnType<typeof drizzle>
  let app: any

  const req = async (path: string, options?: RequestInit) => {
    const request = new Request(`http://localhost${path}`, options)
    return app.request(request)
  }

  const membroId = 'mem-1'
  const membroIdOutro = 'mem-2'
  let sessionToken = ''
  let sessionTokenOutro = ''

  const regionalId = crypto.randomUUID()

  beforeAll(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    app = createApp(db, { enableAdminRoutes: true })
    setupDb(sqlite)

    const baseSql = `
      INSERT INTO regionais (id, nome) VALUES ('${regionalId}', 'Reg 1');
      INSERT INTO administracoes (id, regional_id, nome) VALUES ('adm-1', '${regionalId}', 'Adm 1');
      INSERT INTO setores (id, administracao_id, nome) VALUES ('set-1', 'adm-1', 'Set 1');
      INSERT INTO casas (id, setor_id, nome) VALUES ('casa-1', 'set-1', 'Casa 1');
      
      INSERT INTO membros (id, nome, celular, data_nascimento, casa_id, ativo)
      VALUES 
        ('${membroId}', 'João Silva', '11999999999', '1990-01-01', 'casa-1', 1),
        ('${membroIdOutro}', 'Maria Souza', '11888888888', '1990-01-02', 'casa-1', 1);

      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES 
        ('ev-1', 'Evento Teste', 'ONLINE', '2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z', '${regionalId}', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES 
        ('conv-1', 'ev-1', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES 
        ('dest-1', 'conv-1', '${membroId}'),
        ('dest-2', 'conv-1', '${membroId}'); -- Simula múltiplos destinatários lógicos pro mesmo membro
    `
    sqlite.exec(baseSql)

    const genSession = async (mid: string, cel: string, dataNascimento: string) => {
      const resLink = await req(`/api/v1/admin/membros/${mid}/link-ativacao`, { method: 'POST' })
      const linkJson = await resLink.json() as any
      const resAtivar = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: linkJson.token, celular: cel, dataNascimento, pin: '123456', confirmacaoPin: '123456' })
      })
      const ativarJson = await resAtivar.json() as any
      return ativarJson.sessionToken
    }

    sessionToken = await genSession(membroId, '11999999999', '1990-01-01')
    sessionTokenOutro = await genSession(membroIdOutro, '11888888888', '1990-01-02')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. Membro autenticado registra própria subscription', async () => {
    const res = await req('/api/v1/minha-agenda/notificacoes/subscribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/123',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' }
      })
    })
    expect(res.status).toBe(201)
    
    const subs = await db.select().from(schema.pushSubscriptions).all()
    expect(subs.length).toBe(1)
    expect(subs[0].membroId).toBe(membroId)
    expect(subs[0].endpoint).toBe('https://push.example.com/123')
  })

  it('2. Registrar mesma subscription atualiza sem criar duplicata e reativa', async () => {
    // Inativa primeiro
    await db.update(schema.pushSubscriptions).set({ ativo: false }).run()

    const res = await req('/api/v1/minha-agenda/notificacoes/subscribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/123',
        keys: { p256dh: 'new-key', auth: 'new-auth' }
      })
    })
    expect(res.status).toBe(200) // updated
    
    const subs = await db.select().from(schema.pushSubscriptions).all()
    expect(subs.length).toBe(1) // Continua sendo 1 registro
    expect(subs[0].ativo).toBe(true)
    expect(subs[0].p256dh).toBe('new-key')
  })

  it('3. Outro membro tentando registrar o mesmo endpoint recebe erro (proteção cross-member)', async () => {
    const res = await req('/api/v1/minha-agenda/notificacoes/subscribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionTokenOutro}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/123',
        keys: { p256dh: 'x', auth: 'y' }
      })
    })
    expect(res.status).toBe(403)
  })

  it('4. Membro pode inativar própria subscription', async () => {
    const res = await req('/api/v1/minha-agenda/notificacoes/unsubscribe', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/123'
      })
    })
    expect(res.status).toBe(200)

    const sub = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, 'https://push.example.com/123')).get()
    expect(sub!.ativo).toBe(false)
  })

  it('5. Membro não pode inativar subscription de outro', async () => {
    // Cria uma sub do "membro outro"
    await req('/api/v1/minha-agenda/notificacoes/subscribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionTokenOutro}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example.com/outro', keys: { p256dh: 'x', auth: 'y' } })
    })

    const res = await req('/api/v1/minha-agenda/notificacoes/unsubscribe', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/outro'
      })
    })
    expect(res.status).toBe(404)
  })

  describe('Serviço de Envio (Internal)', () => {
    const vapid = { publicKey: '', privateKey: '', subject: '' }

    it('6. Deve enviar 1 notificação por membro (filtrando múltiplos destinatários lógicos)', async () => {
      await db.update(schema.pushSubscriptions).set({ ativo: true }).where(eq(schema.pushSubscriptions.endpoint, 'https://push.example.com/123')).run()
      
      const spy = vi.spyOn(webPush, 'enviarNotificacao').mockResolvedValue({ success: true, status: 201 })
      
      const result = await enviarAvisosConvocacao(db, 'conv-1', 'Tit', 'Msg', vapid, '/app/agenda')
      
      expect(result.totais).toBe(1) // Embora houvesse 2 destinatários 'dest-1' e 'dest-2' para o mesmo membro, enviou pra 1 membro
      expect(result.enviados).toBe(1)
      expect(spy).toHaveBeenCalledTimes(1)
      
      const payload = JSON.parse(spy.mock.calls[0][1])
      expect(payload.titulo).toBe('Tit')
      expect(payload.url).toBe('/app/agenda')
      // Não deve ter token, justificativa ou info sensível
      expect(payload.sessionToken).toBeUndefined()
    })

    it('7. Erro 404/410 inativa subscription automaticamente', async () => {
      const spy = vi.spyOn(webPush, 'enviarNotificacao').mockResolvedValue({ success: false, status: 410 })
      
      const result = await enviarAvisosConvocacao(db, 'conv-1', 'Tit', 'Msg', vapid, '/app')
      
      expect(result.enviados).toBe(0)
      expect(result.inativados).toBe(1)

      const sub = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, 'https://push.example.com/123')).get()
      expect(sub!.ativo).toBe(false)
    })

    it('8. Erro 5xx (transiente) não apaga/inativa subscription', async () => {
      await db.update(schema.pushSubscriptions).set({ ativo: true }).where(eq(schema.pushSubscriptions.endpoint, 'https://push.example.com/123')).run()
      const spy = vi.spyOn(webPush, 'enviarNotificacao').mockResolvedValue({ success: false, status: 502 })
      
      const result = await enviarAvisosConvocacao(db, 'conv-1', 'Tit', 'Msg', vapid, '/app')
      
      expect(result.inativados).toBe(0)
      expect(result.falhas).toBe(1)

      const sub = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, 'https://push.example.com/123')).get()
      expect(sub!.ativo).toBe(true) // Permanece ativo
    })
  })
})
