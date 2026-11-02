
import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'
import { LGPD_VERSAO } from '../security/lgpd-termos'

describe('LGPD — ciência obrigatória no primeiro acesso', () => {
  let sqlite: Database.Database
  let app: ReturnType<typeof createApp>
  const token = 'token-lgpd-teste'
  const auth = { Authorization: `Bearer ${token}` }

  beforeEach(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    const db = drizzle(sqlite, { schema })
    // Neste teste, habilitar a mesma exigência aplicada pelo Worker real.
    app = createApp(db, { enforceLgpd: true })
    const tokenHash = await hashToken(token)
    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('reg-lgpd', 'Regional SP');
      INSERT INTO administracoes (id, regional_id, nome) VALUES ('adm-lgpd', 'reg-lgpd', 'Administração');
      INSERT INTO setores (id, administracao_id, nome) VALUES ('set-lgpd', 'adm-lgpd', 'Setor');
      INSERT INTO casas (id, setor_id, nome) VALUES ('casa-lgpd', 'set-lgpd', 'Casa');
      INSERT INTO membros (id, nome, casa_id) VALUES ('mem-lgpd', 'Pessoa Teste', 'casa-lgpd');
      INSERT INTO contas_acesso (id, membro_id, status) VALUES ('conta-lgpd', 'mem-lgpd', 'ATIVA');
    `)
    const agora = new Date().toISOString()
    sqlite.prepare(`INSERT INTO sessoes (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('sess-lgpd', 'conta-lgpd', 'mem-lgpd', tokenHash,
      new Date(Date.now() + 3600000).toISOString(), agora, agora)
  })

  it('bloqueia a API de negócio, mas mantém identidade, aviso e logout acessíveis', async () => {
    const bloqueada = await app.request('/api/v1/auth/me/vinculos', { headers: auth })
    expect(bloqueada.status).toBe(403)
    expect(await bloqueada.json()).toMatchObject({ code: 'CIENCIA_PRIVACIDADE_PENDENTE', versao: LGPD_VERSAO })
    const identidade = await app.request('/api/v1/auth/me', { headers: auth })
    expect(identidade.status).toBe(200)
    const aviso = await app.request('/api/v1/lgpd', { headers: auth })
    expect(aviso.status).toBe(200)
    expect(await aviso.json()).toMatchObject({ versao: LGPD_VERSAO, ciente: false })
  })

  it('não aceita versão/hash diferentes ou confirmação incompleta', async () => {
    const aviso = await (await app.request('/api/v1/lgpd', { headers: auth })).json() as any
    for (const body of [
      { versao: aviso.versao, hash: 'outro', leituraConfirmada: true, tratamentoNecessarioCiente: true },
      { versao: 'versao-antiga', hash: aviso.hash, leituraConfirmada: true, tratamentoNecessarioCiente: true },
      { versao: aviso.versao, hash: aviso.hash, leituraConfirmada: true, tratamentoNecessarioCiente: false },
    ]) {
      const resposta = await app.request('/api/v1/lgpd/ciencia', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      expect(resposta.status).toBe(400)
    }
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM ciencias_privacidade').get()).toMatchObject({ total: 0 })
  })

  it('registra uma ciência por titular e versão, reabre a API e é idempotente', async () => {
    const aviso = await (await app.request('/api/v1/lgpd', { headers: auth })).json() as any
    const body = JSON.stringify({
      versao: aviso.versao, hash: aviso.hash,
      leituraConfirmada: true, tratamentoNecessarioCiente: true,
    })
    const enviar = () => app.request('/api/v1/lgpd/ciencia', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body,
    })
    expect((await enviar()).status).toBe(200)
    expect((await enviar()).status).toBe(200)
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM ciencias_privacidade').get()).toMatchObject({ total: 1 })
    const liberada = await app.request('/api/v1/auth/me/vinculos', { headers: auth })
    expect(liberada.status).toBe(200)
    const avisoAtual = await (await app.request('/api/v1/lgpd', { headers: auth })).json() as any
    expect(avisoAtual.ciente).toBe(true)
  })

  it('ciência de versão antiga não libera nova versão do aviso', async () => {
    sqlite.prepare(`INSERT INTO ciencias_privacidade
      (id, membro_id, conta_acesso_id, versao, texto_hash, leitura_confirmada, tratamento_necessario_ciente, registrado_em)
      VALUES ('id-antigo', 'mem-lgpd', 'conta-lgpd', '2025-01', 'hash-antigo', 1, 1, ?)`)
      .run(new Date().toISOString())
    const resposta = await app.request('/api/v1/auth/me/vinculos', { headers: auth })
    expect(resposta.status).toBe(403)
  })
})
