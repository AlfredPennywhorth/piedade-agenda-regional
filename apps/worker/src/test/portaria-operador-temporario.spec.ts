import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'
import { validarCredencialOperadorPortaria } from '../services/portaria-operador-temporario'
import { createApp } from '../index'

describe('PORT — credencial temporária do operador', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('regional-1', 'Regional 1');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('adm-1', 'regional-1', 'Administração 1');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('setor-1', 'adm-1', 'Setor 1');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('casa-1', 'setor-1', 'Casa 1');
      INSERT INTO eventos (
        id, titulo, modalidade, inicio_em, fim_em, casa_id, ativo
      ) VALUES (
        'evento-1', 'Reunião Teste', 'PRESENCIAL',
        '2099-01-01T15:00:00.000Z', '2099-01-01T18:00:00.000Z',
        'casa-1', 1
      );
    `)

    const tokenHash = await hashToken('token-operador-valido')
    sqlite.prepare(`
      INSERT INTO credenciais_operador_portaria_evento
        (id, evento_id, token_hash, expira_em, ativo)
      VALUES (?, ?, ?, ?, 1)
    `).run('cred-1', 'evento-1', tokenHash, '2099-01-02T02:59:59.000Z')
  })

  it('aceita token ativo e vincula somente ao evento da credencial', async () => {
    const resultado = await validarCredencialOperadorPortaria(db, 'token-operador-valido')

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.credencial.id).toBe('cred-1')
      expect(resultado.credencial.eventoId).toBe('evento-1')
      expect(resultado.credencial.evento.titulo).toBe('Reunião Teste')
    }
  })

  it('rejeita token desconhecido', async () => {
    const resultado = await validarCredencialOperadorPortaria(db, 'token-inexistente')

    expect(resultado).toMatchObject({
      ok: false,
      status: 401,
      code: 'CREDENCIAL_INVALIDA',
    })
  })

  it('rejeita credencial revogada', async () => {
    sqlite.exec(`
      UPDATE credenciais_operador_portaria_evento
      SET ativo = 0, revogado_em = CURRENT_TIMESTAMP
      WHERE id = 'cred-1';
    `)

    const resultado = await validarCredencialOperadorPortaria(db, 'token-operador-valido')
    expect(resultado).toMatchObject({
      ok: false,
      status: 401,
      code: 'CREDENCIAL_INVALIDA',
    })
  })

  it('credencial temporária solicita fechamento sem encerrar a Portaria', async () => {
    const resposta = await app.request('/api/v1/portaria-operador-publica/solicitar-fechamento', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-operador-valido' },
    })

    expect(resposta.status).toBe(202)
    expect(await resposta.json()).toMatchObject({ status: 'AGUARDANDO_CONFIRMACAO' })

    const solicitacao = sqlite.prepare(
      'SELECT solicitado_por_credencial_id, confirmado_em FROM portaria_solicitacoes_fechamento WHERE evento_id = ?'
    ).get('evento-1') as any
    expect(solicitacao.solicitado_por_credencial_id).toBe('cred-1')
    expect(solicitacao.confirmado_em).toBeNull()

    const fechamento = sqlite.prepare(
      'SELECT id FROM portaria_fechamentos WHERE evento_id = ?'
    ).get('evento-1')
    expect(fechamento).toBeUndefined()
  })

  it('rejeita acesso depois do fechamento da Portaria', async () => {
    sqlite.exec(`
      INSERT INTO portarias_evento (evento_id, status)
      VALUES ('evento-1', 'FECHADA');
    `)

    const resultado = await validarCredencialOperadorPortaria(db, 'token-operador-valido')
    expect(resultado).toMatchObject({
      ok: false,
      status: 409,
      code: 'PORTARIA_FECHADA',
    })
  })
})
