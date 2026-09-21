import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('PORT-01 — operadores temporários por evento', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>

  const eventoId = 'evento-portaria-1'

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })
    app = createApp(db)

    sqlite.exec(\`
      INSERT INTO regionais (id, nome) VALUES ('regional-1', 'Regional 1');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('adm-1', 'regional-1', 'Administração 1');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('setor-1', 'adm-1', 'Setor 1');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('casa-1', 'setor-1', 'Casa 1');

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('membro-master', 'Master', 'casa-1', 1),
        ('porteiro-1', 'Porteiro 1', 'casa-1', 1),
        ('porteiro-2', 'Porteiro 2', 'casa-1', 1),
        ('participante-1', 'Participante 1', 'casa-1', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('conta-master', 'membro-master', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-p1', 'porteiro-1', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-p2', 'porteiro-2', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES ('acesso-master', 'conta-master', 'MASTER_SISTEMA', 'GLOBAL', NULL);

      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, setor_id, ativo)
      VALUES
        ('evento-portaria-1', 'Reunião Teste', 'PRESENCIAL',
         '2026-09-21T18:00:00.000Z', '2026-09-21T21:00:00.000Z',
         'setor-1', 1);

      INSERT INTO convocacoes
        (id, evento_id, status, ativo)
      VALUES ('conv-1', 'evento-portaria-1', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios
        (id, convocacao_id, membro_id)
      VALUES ('dest-1', 'conv-1', 'participante-1');
    \`)
  })

  async function sessao(
    id: string,
    contaId: string,
    membroId: string,
    token: string
  ) {
    const hash = await hashToken(token)
    const agora = new Date().toISOString()
    sqlite.prepare(\`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em,
         ultimo_acesso_em, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    \`).run(
      id,
      contaId,
      membroId,
      hash,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )
  }

  const auth = (token: string, json = false) => ({
    Authorization: \`Bearer \${token}\`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  })

  it('permite ao Master habilitar vários porteiros temporários no mesmo evento', async () => {
    await sessao('sessao-master', 'conta-master', 'membro-master', 'token-master')

    for (const membroId of ['porteiro-1', 'porteiro-2']) {
      const res = await app.request(\`/api/v1/portaria/eventos/\${eventoId}/operadores\`, {
        method: 'POST',
        headers: auth('token-master', true),
        body: JSON.stringify({ membroId }),
      })
      expect(res.status).toBe(201)
    }

    const ativos = sqlite.prepare(\`
      SELECT membro_id FROM portaria_operadores_evento
      WHERE evento_id = ? AND ativo = 1 ORDER BY membro_id
    \`).all(eventoId) as Array<{ membro_id: string }>

    expect(ativos.map(item => item.membro_id)).toEqual(['porteiro-1', 'porteiro-2'])
  })

  it('porteiro temporário acessa participantes sem possuir função permanente de Portaria', async () => {
    await sessao('sessao-master', 'conta-master', 'membro-master', 'token-master')
    await sessao('sessao-p1', 'conta-p1', 'porteiro-1', 'token-p1')

    const concessao = await app.request(\`/api/v1/portaria/eventos/\${eventoId}/operadores\`, {
      method: 'POST',
      headers: auth('token-master', true),
      body: JSON.stringify({ membroId: 'porteiro-1' }),
    })
    expect(concessao.status).toBe(201)

    const participantes = await app.request(
      \`/api/v1/portaria/eventos/\${eventoId}/participantes\`,
      { headers: auth('token-p1') }
    )

    expect(participantes.status).toBe(200)
  })

  it('usuário comum não pode nomear porteiro temporário', async () => {
    await sessao('sessao-p1', 'conta-p1', 'porteiro-1', 'token-p1')

    const res = await app.request(\`/api/v1/portaria/eventos/\${eventoId}/operadores\`, {
      method: 'POST',
      headers: auth('token-p1', true),
      body: JSON.stringify({ membroId: 'porteiro-2' }),
    })

    expect(res.status).toBe(403)
  })

  it('exige conta de acesso ativa para o porteiro temporário', async () => {
    await sessao('sessao-master', 'conta-master', 'membro-master', 'token-master')

    sqlite.exec(\`
      INSERT INTO membros (id, nome, casa_id, ativo)
      VALUES ('sem-conta', 'Sem Conta', 'casa-1', 1);
    \`)

    const res = await app.request(\`/api/v1/portaria/eventos/\${eventoId}/operadores\`, {
      method: 'POST',
      headers: auth('token-master', true),
      body: JSON.stringify({ membroId: 'sem-conta' }),
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'CONTA_INDISPONIVEL' })
  })

  it('porteiro temporário pode fechar a Portaria e isso encerra todos os operadores temporários', async () => {
    await sessao('sessao-master', 'conta-master', 'membro-master', 'token-master')
    await sessao('sessao-p1', 'conta-p1', 'porteiro-1', 'token-p1')

    for (const membroId of ['porteiro-1', 'porteiro-2']) {
      const res = await app.request(\`/api/v1/portaria/eventos/\${eventoId}/operadores\`, {
        method: 'POST',
        headers: auth('token-master', true),
        body: JSON.stringify({ membroId }),
      })
      expect(res.status).toBe(201)
    }

    const fechar = await app.request(\`/api/v1/portaria/eventos/\${eventoId}/fechar\`, {
      method: 'POST',
      headers: auth('token-p1'),
    })

    expect(fechar.status).toBe(200)
    expect(await fechar.json()).toMatchObject({ status: 'FECHADA' })

    const estado = sqlite.prepare(
      'SELECT status, fechada_por_membro_id FROM portarias_evento WHERE evento_id = ?'
    ).get(eventoId) as any
    expect(estado.status).toBe('FECHADA')
    expect(estado.fechada_por_membro_id).toBe('porteiro-1')

    const ativos = sqlite.prepare(
      'SELECT COUNT(*) AS total FROM portaria_operadores_evento WHERE evento_id = ? AND ativo = 1'
    ).get(eventoId) as any
    expect(ativos.total).toBe(0)
  })

  it('após fechamento, o mesmo porteiro perde acesso e novos check-ins ficam bloqueados', async () => {
    await sessao('sessao-master', 'conta-master', 'membro-master', 'token-master')
    await sessao('sessao-p1', 'conta-p1', 'porteiro-1', 'token-p1')

    await app.request(\`/api/v1/portaria/eventos/\${eventoId}/operadores\`, {
      method: 'POST',
      headers: auth('token-master', true),
      body: JSON.stringify({ membroId: 'porteiro-1' }),
    })

    const fechar = await app.request(\`/api/v1/portaria/eventos/\${eventoId}/fechar\`, {
      method: 'POST',
      headers: auth('token-p1'),
    })
    expect(fechar.status).toBe(200)

    const participantes = await app.request(
      \`/api/v1/portaria/eventos/\${eventoId}/participantes\`,
      { headers: auth('token-p1') }
    )
    expect(participantes.status).toBe(403)

    const checkin = await app.request('/api/v1/checkin/manual', {
      method: 'POST',
      headers: auth('token-p1', true),
      body: JSON.stringify({ convocacaoDestinatarioId: 'dest-1' }),
    })
    expect(checkin.status).toBe(403)
  })
})
