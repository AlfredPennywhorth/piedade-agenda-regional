import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { setupDb } from './setup'
import { eq, and } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

describe('S11 - Checkins e Portaria', () => {
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>
  let app: ReturnType<typeof createApp>

  const req = async (path: string, options?: RequestInit) => {
    const request = new Request(`http://localhost${path}`, options)
    return app.request(request)
  }

  const orgId = 'org-1'
  const membroId1 = 'mem-1'
  const membroId2 = 'mem-2'
  const membroInativoId = 'mem-inativo'
  
  let sessionOrg = ''
  let sessionMem1 = ''
  let sessionMem2 = ''
  let sessionMemInativo = ''

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
      
      INSERT INTO membros (id, nome, celular, casa_id, ativo)
      VALUES 
        ('${orgId}', 'Organizador', '11000000000', 'casa-1', 1),
        ('${membroId1}', 'Membro 1', '11111111111', 'casa-1', 1),
        ('${membroId2}', 'Membro 2', '11222222222', 'casa-1', 1),
        ('${membroInativoId}', 'Membro Inativo', '11333333333', 'casa-1', 0);

      INSERT INTO locais (id, nome, endereco, numero, cidade, uf) 
      VALUES ('loc-1', 'Local 1', 'End 1', '1', 'SP', 'SP');

      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, organizador_membro_id, ativo)
      VALUES 
        ('evt-1', 'Evento Ativo', 'PRESENCIAL', '2030-01-01T10:00:00Z', '2030-01-01T12:00:00Z', '${regionalId}', '${orgId}', 1),
        ('evt-inativo', 'Evento Inativo', 'PRESENCIAL', '2030-01-01T10:00:00Z', '2030-01-01T12:00:00Z', '${regionalId}', '${orgId}', 0);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES 
        ('conv-pub-1', 'evt-1', 'PUBLICADA', 1),
        ('conv-rasc', 'evt-1', 'RASCUNHO', 1),
        ('conv-inat', 'evt-1', 'PUBLICADA', 0),
        ('conv-pub-inativo', 'evt-inativo', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES 
        ('dest-1', 'conv-pub-1', '${membroId1}'),
        ('dest-2', 'conv-rasc', '${membroId2}'),
        ('dest-3', 'conv-inat', '${membroId2}'),
        ('dest-4', 'conv-pub-inativo', '${membroId1}');
    `
    sqlite.exec(baseSql)

    const genSession = async (mid: string, cel: string) => {
      const resLink = await req(`/api/v1/admin/membros/${mid}/link-ativacao`, { method: 'POST' })
      const linkJson = await resLink.json() as { token: string }
      const resAtivar = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: linkJson.token, celular: cel, pin: '123456', confirmacaoPin: '123456' })
      })
      const ativarJson = await resAtivar.json() as { sessionToken: string }
      return ativarJson.sessionToken
    }

    sessionOrg = await genSession(orgId, '11000000000')
    sessionMem1 = await genSession(membroId1, '11111111111')
    sessionMem2 = await genSession(membroId2, '11222222222')
    sessionMemInativo = crypto.randomUUID()
    sqlite.exec(`INSERT INTO sessoes (id, membro_id, token_hash, expira_em) VALUES ('sess-inat', '${membroInativoId}', '${sessionMemInativo}', '2040-01-01T00:00:00Z')`)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Emissão de Credencial', () => {
    it('1. credencial para destinatário de convocação PUBLICADA -> 200', async () => {
      const res = await req('/api/v1/eventos/evt-1/credencial-checkin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionMem1}` }
      })
      expect(res.status).toBe(200)
      const data = await res.json() as { token: string, expiraEm: string }
      expect(data.token).toBeDefined()
      expect(data.expiraEm).toBeDefined()
    })

    it('2. evento inexistente na emissão -> 404', async () => {
      const res = await req('/api/v1/eventos/evt-inexistente/credencial-checkin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionMem1}` }
      })
      expect(res.status).toBe(404)
    })

    it('3. evento inativo -> 403', async () => {
      const res = await req('/api/v1/eventos/evt-inativo/credencial-checkin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionMem1}` }
      })
      expect(res.status).toBe(403)
    })

    it('4. convocação RASCUNHO -> 403 (ou 403 de acesso negado)', async () => {
      const res = await req('/api/v1/eventos/evt-1/credencial-checkin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionMem2}` }
      })
      expect(res.status).toBe(403)
    })

    it('6. membro não destinatário -> 403', async () => {
      const res = await req('/api/v1/eventos/evt-1/credencial-checkin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}` }
      })
      expect(res.status).toBe(403)
    })

    it('7. emissão produz token e expiraEm; 8. token puro NÃO aparece; 9. hash persistido', async () => {
      const res = await req('/api/v1/eventos/evt-1/credencial-checkin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionMem1}` }
      })
      expect(res.status).toBe(200)
      const data = await res.json() as { token: string, expiraEm: string }

      const tokens = await db.select().from(schema.checkinTokens).where(eq(schema.checkinTokens.ativo, true)).all()
      
      expect(tokens.length).toBeGreaterThan(0)
      const rawInDb = tokens.find(t => t.tokenHash === data.token)
      expect(rawInDb).toBeUndefined()

      const encoder = new TextEncoder()
      const dataBuf = encoder.encode(data.token)
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuf)
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')

      const hashedInDb = tokens.find(t => t.tokenHash === hashHex)
      expect(hashedInDb).toBeDefined()
    })

    it('10. nova emissão inativa token anterior', async () => {
      const t1 = await req('/api/v1/eventos/evt-1/credencial-checkin', { method: 'POST', headers: { Authorization: `Bearer ${sessionMem1}` } })
      const json1 = await t1.json() as { token: string }
      
      await req('/api/v1/eventos/evt-1/credencial-checkin', { method: 'POST', headers: { Authorization: `Bearer ${sessionMem1}` } })
      
      const encoder = new TextEncoder()
      const hbuf = await crypto.subtle.digest('SHA-256', encoder.encode(json1.token))
      const hashHex1 = Array.from(new Uint8Array(hbuf)).map((b) => b.toString(16).padStart(2, '0')).join('')

      const tokenAntigo = await db.select().from(schema.checkinTokens).where(eq(schema.checkinTokens.tokenHash, hashHex1)).get()
      expect(tokenAntigo?.ativo).toBe(false)
    })
  })

  describe('Check-in QR e Manual', () => {
    it('11. check-in QR válido -> 201 REGISTRADO', async () => {
      const emissao = await req('/api/v1/eventos/evt-1/credencial-checkin', { method: 'POST', headers: { Authorization: `Bearer ${sessionMem1}` } })
      const json = await emissao.json() as { token: string }

      const res = await req('/api/v1/eventos/evt-1/checkins/qr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: json.token })
      })

      expect(res.status).toBe(201)
      const d = await res.json() as any
      expect(d.status).toBe('REGISTRADO')
      expect(d.registradoEm).toBeDefined()
    })

    it('12. segundo scan -> 200 JA_REGISTRADO', async () => {
      const emissao = await req('/api/v1/eventos/evt-1/credencial-checkin', { method: 'POST', headers: { Authorization: `Bearer ${sessionMem1}` } })
      const json = await emissao.json() as { token: string }

      await req('/api/v1/eventos/evt-1/checkins/qr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: json.token })
      })

      const res = await req('/api/v1/eventos/evt-1/checkins/qr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: json.token })
      })

      expect(res.status).toBe(200)
      const d = await res.json() as any
      expect(d.status).toBe('JA_REGISTRADO')
    })

    it('13. token expirado -> rejeitado', async () => {
      const emissao = await req('/api/v1/eventos/evt-1/credencial-checkin', { method: 'POST', headers: { Authorization: `Bearer ${sessionMem1}` } })
      const json = await emissao.json() as { token: string }

      const hbuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json.token))
      const hashHex = Array.from(new Uint8Array(hbuf)).map((b) => b.toString(16).padStart(2, '0')).join('')
      await db.update(schema.checkinTokens).set({ expiraEm: '2000-01-01T00:00:00Z' }).where(eq(schema.checkinTokens.tokenHash, hashHex)).run()

      const res = await req('/api/v1/eventos/evt-1/checkins/qr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: json.token })
      })

      expect(res.status).toBe(400)
    })

    it('15. check-in manual convocado -> 201', async () => {
      await db.update(schema.checkins).set({ ativo: false }).run()

      const res = await req('/api/v1/eventos/evt-1/checkins/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ membroId: membroId1 })
      })

      expect(res.status).toBe(201)
    })

    it('16. check-in manual não convocado -> 201 e FK destinatário null', async () => {
      await db.update(schema.checkins).set({ ativo: false }).run()
      const res = await req('/api/v1/eventos/evt-1/checkins/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ membroId: membroId2 })
      })

      expect(res.status).toBe(201)
      const d = await res.json() as any
      const chk = await db.select().from(schema.checkins).where(eq(schema.checkins.id, d.checkinId)).get()
      expect(chk?.convocacaoDestinatarioId).toBeNull()
    })

    it('17. membro inativo -> 404', async () => {
      const res = await req('/api/v1/eventos/evt-1/checkins/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ membroId: membroInativoId })
      })

      expect(res.status).toBe(404)
    })

    it('18. não organizador -> 403', async () => {
      const res = await req('/api/v1/eventos/evt-1/checkins/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionMem1}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ membroId: membroId2 })
      })
      expect(res.status).toBe(403)
    })

    it('19. evento inexistente na portaria -> 404', async () => {
      const res = await req('/api/v1/eventos/inexistente/checkins/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ membroId: membroId1 })
      })
      expect(res.status).toBe(404)
    })
  })

  describe('Inativação e Portaria', () => {
    it('20. inativação -> INATIVADO', async () => {
      await db.update(schema.checkins).set({ ativo: false }).run()
      const man = await req('/api/v1/eventos/evt-1/checkins/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ membroId: membroId1 })
      })
      const chk = await man.json() as any

      const res = await req(`/api/v1/eventos/evt-1/checkins/${chk.checkinId}/inativar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${sessionOrg}` }
      })

      expect(res.status).toBe(200)
      const j = await res.json() as any
      expect(j.status).toBe('INATIVADO')
    })

    it('21. segunda inativação -> JA_INATIVO', async () => {
      await db.update(schema.checkins).set({ ativo: false }).run()
      const man = await req('/api/v1/eventos/evt-1/checkins/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ membroId: membroId1 })
      })
      const chk = await man.json() as any

      await req(`/api/v1/eventos/evt-1/checkins/${chk.checkinId}/inativar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${sessionOrg}` }
      })

      const res2 = await req(`/api/v1/eventos/evt-1/checkins/${chk.checkinId}/inativar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${sessionOrg}` }
      })

      expect(res2.status).toBe(200)
      const j = await res2.json() as any
      expect(j.status).toBe('JA_INATIVO')
    })

    it('22. novo check-in após inativação -> REGISTRADO', async () => {
      await db.update(schema.checkins).set({ ativo: false }).run()
      const res = await req('/api/v1/eventos/evt-1/checkins/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ membroId: membroId1 })
      })
      expect(res.status).toBe(201)
    })

    it('23, 24, 25, 26. Busca manual regras', async () => {
      const res1 = await req('/api/v1/eventos/evt-1/portaria/membros?q=1', { headers: { Authorization: `Bearer ${sessionOrg}` } })
      expect(res1.status).toBe(400)

      const res2 = await req('/api/v1/eventos/evt-1/portaria/membros?q=Membro', { headers: { Authorization: `Bearer ${sessionOrg}` } })
      expect(res2.status).toBe(200)
      const d = await res2.json() as any[]
      expect(d.length).toBeLessThanOrEqual(20)
      expect(d.some(m => m.membroId === membroInativoId)).toBe(false)
      
      const item = d.find(m => m.membroId === membroId1)
      expect(item).toBeDefined()
      expect(item.nome).toBeDefined()
      expect(item.convocado).toBeDefined()
      expect(item.checkinAtivo).toBeDefined()
      expect(item.celular).toBeUndefined()
      expect(item.dataNascimento).toBeUndefined()
      expect(item.pin).toBeUndefined()
      expect(item.token).toBeUndefined()
    })

    it('27. check-in não modifica RSVP', async () => {
      sqlite.exec(`INSERT INTO rsvp (id, convocacao_destinatario_id, resposta, respondido_em, atualizado_em) VALUES ('rsvp-1', 'dest-1', 'PARTICIPAREI', '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z')`)
      
      await req('/api/v1/eventos/evt-1/checkins/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ membroId: membroId1 })
      })

      const rsvp = await db.select().from(schema.rsvp).where(eq(schema.rsvp.id, 'rsvp-1')).get()
      expect(rsvp?.resposta).toBe('PARTICIPAREI')
    })

    it('Concorrência / Idempotência real', async () => {
      await db.update(schema.checkins).set({ ativo: false }).run()

      const emissao = await req('/api/v1/eventos/evt-1/credencial-checkin', { method: 'POST', headers: { Authorization: `Bearer ${sessionMem1}` } })
      const json = await emissao.json() as { token: string }

      const body = JSON.stringify({ token: json.token })

      const req1 = req('/api/v1/eventos/evt-1/checkins/qr', { method: 'POST', headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' }, body })
      const req2 = req('/api/v1/eventos/evt-1/checkins/qr', { method: 'POST', headers: { Authorization: `Bearer ${sessionOrg}`, 'Content-Type': 'application/json' }, body })

      const [r1, r2] = await Promise.all([req1, req2])
      
      const st1 = r1.status
      const st2 = r2.status
      expect([st1, st2].includes(201)).toBe(true)
      expect([st1, st2].includes(200)).toBe(true)

      const chks = await db.select().from(schema.checkins).where(and(eq(schema.checkins.eventoId, 'evt-1'), eq(schema.checkins.membroId, membroId1), eq(schema.checkins.ativo, true))).all()
      expect(chks.length).toBe(1)
    })
  })
})
