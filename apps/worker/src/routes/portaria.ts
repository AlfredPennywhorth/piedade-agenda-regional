import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { eventos, convocacoes, convocacaoDestinatarios, membros, casas, rsvp, checkins, contasAcesso, portariasEvento, portariaOperadoresEvento, convidadosEvento, credenciaisCadastroPortariaEvento, credenciaisOperadorPortariaEvento, presencasConvidadoEvento, portariaFechamentos, portariaFechamentoItens, portariaSolicitacoesFechamento, portariaReaberturas } from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { eMasterSistema, eOperadorPortariaAutorizado, podeGerenciarAgendaNoEscopo } from '../security/permissoes'
import { executarOperacaoComAudit, extrairEscopoDoEvento } from '../services/auditoria'
import { PortariaEventosQuerySchema, getSaoPauloDateString, getSaoPauloEndOfDayIso } from '@piedade/shared'
import { gerarTokenAleatorio, hashToken } from '../security/tokens'
import { montarSnapshotFechamentoPortaria } from '../services/portaria-fechamento'

export const portariaRouter = new Hono<{ Variables: Variables }>()

portariaRouter.use('*', authMiddleware)


async function podeGerarCredencialOperador(db: any, membroId: string, contexto: any, evento: any) {
  if (eMasterSistema(contexto)) return true
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)
  if (!escopoTipo || !escopoId) return false
  return podeGerenciarAgendaNoEscopo(
    db,
    membroId,
    escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
    escopoId
  )
}

// POST /api/v1/portaria/eventos/:eventoId/credenciais-operador
// Gera acesso temporário sem exigir cadastro do porteiro.
portariaRouter.post('/eventos/:eventoId/credenciais-operador', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')

  const evento = await db.select().from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true))).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  if (!atorMembroId || !(await podeGerarCredencialOperador(db, atorMembroId, contexto, evento))) {
    return c.json({ error: 'Acesso não autorizado para gerar porteiro temporário', code: 'FORBIDDEN' }, 403)
  }

  const estado = await db.select().from(portariasEvento)
    .where(eq(portariasEvento.eventoId, eventoId)).get()
  if (estado?.status === 'FECHADA') {
    return c.json({ error: 'A Portaria desta reunião já foi fechada', code: 'PORTARIA_FECHADA' }, 409)
  }

  const token = gerarTokenAleatorio(16)
  const tokenHash = await hashToken(token)
  const agora = new Date().toISOString()
  const credencialId = crypto.randomUUID()
  const expiraEm = getSaoPauloEndOfDayIso(evento.inicioEm)
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => {
      const queries = []
      if (!estado) {
        queries.push(qdb.insert(portariasEvento).values({
          eventoId,
          status: 'ABERTA',
          createdAt: agora,
          updatedAt: agora,
        }))
      }
      queries.push(qdb.insert(credenciaisOperadorPortariaEvento).values({
        id: credencialId,
        eventoId,
        tokenHash,
        expiraEm,
        criadoPorMembroId: atorMembroId,
        ativo: true,
        createdAt: agora,
        updatedAt: agora,
      }))
      return queries
    },
    {
      acao: 'PORTARIA_CREDENCIAL_OPERADOR_CRIADA',
      atorMembroId,
      recursoTipo: 'CREDENCIAL_OPERADOR_PORTARIA',
      recursoId: credencialId,
      escopoTipo,
      escopoId,
      contexto: { eventoId },
    }
  )

  return c.json({
    id: credencialId,
    eventoId,
    expiraEm,
    acesso: {
      token,
      caminho: `/o/${encodeURIComponent(token)}`,
    },
  }, 201)
})

// GET /api/v1/portaria/eventos/:eventoId/credenciais-operador
portariaRouter.get('/eventos/:eventoId/credenciais-operador', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')

  const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
  if (!evento) return c.json({ error: 'Evento não encontrado', code: 'NOT_FOUND' }, 404)

  if (!atorMembroId || !(await podeGerarCredencialOperador(db, atorMembroId, contexto, evento))) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const data = await db.select({
    id: credenciaisOperadorPortariaEvento.id,
    eventoId: credenciaisOperadorPortariaEvento.eventoId,
    expiraEm: credenciaisOperadorPortariaEvento.expiraEm,
    ativo: credenciaisOperadorPortariaEvento.ativo,
    revogadoEm: credenciaisOperadorPortariaEvento.revogadoEm,
    ultimoAcessoEm: credenciaisOperadorPortariaEvento.ultimoAcessoEm,
    createdAt: credenciaisOperadorPortariaEvento.createdAt,
  }).from(credenciaisOperadorPortariaEvento)
    .where(eq(credenciaisOperadorPortariaEvento.eventoId, eventoId))
    .all()

  return c.json({ data }, 200)
})

// DELETE /api/v1/portaria/eventos/:eventoId/credenciais-operador/:credencialId
portariaRouter.delete('/eventos/:eventoId/credenciais-operador/:credencialId', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')
  const credencialId = c.req.param('credencialId')

  const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
  if (!evento) return c.json({ error: 'Evento não encontrado', code: 'NOT_FOUND' }, 404)

  if (!atorMembroId || !(await podeGerarCredencialOperador(db, atorMembroId, contexto, evento))) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const credencial = await db.select().from(credenciaisOperadorPortariaEvento)
    .where(and(
      eq(credenciaisOperadorPortariaEvento.id, credencialId),
      eq(credenciaisOperadorPortariaEvento.eventoId, eventoId),
      eq(credenciaisOperadorPortariaEvento.ativo, true)
    )).get()

  if (!credencial) {
    return c.json({ error: 'Credencial temporária não encontrada', code: 'NOT_FOUND' }, 404)
  }

  const agora = new Date().toISOString()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb.update(credenciaisOperadorPortariaEvento).set({
        ativo: false,
        revogadoEm: agora,
        updatedAt: agora,
      }).where(eq(credenciaisOperadorPortariaEvento.id, credencialId))
    ],
    {
      acao: 'PORTARIA_CREDENCIAL_OPERADOR_REVOGADA',
      atorMembroId,
      recursoTipo: 'CREDENCIAL_OPERADOR_PORTARIA',
      recursoId: credencialId,
      escopoTipo,
      escopoId,
      contexto: { eventoId },
    }
  )

  return c.json({ message: 'Credencial temporária revogada' }, 200)
})

// POST /api/v1/portaria/eventos/:eventoId/operadores
// Concessão temporária: somente Master até homologação de quem mais pode nomear porteiros.
portariaRouter.post('/eventos/:eventoId/operadores', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')

  if (!db || !atorMembroId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  if (!eMasterSistema(contexto)) {
    return c.json({ error: 'Somente Master pode nomear porteiro temporário', code: 'FORBIDDEN' }, 403)
  }

  let body: { membroId?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  if (!body.membroId) {
    return c.json({ error: 'membroId é obrigatório', code: 'VALIDATION_ERROR' }, 400)
  }

  const evento = await db.select().from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true))).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  const operador = await db
    .select({ membroId: membros.id, contaId: contasAcesso.id, status: contasAcesso.status })
    .from(membros)
    .innerJoin(contasAcesso, eq(contasAcesso.membroId, membros.id))
    .where(and(eq(membros.id, body.membroId), eq(membros.ativo, true)))
    .get()

  if (!operador || operador.status !== 'ATIVA') {
    return c.json(
      { error: 'O porteiro temporário precisa possuir conta de acesso ativa', code: 'CONTA_INDISPONIVEL' },
      409
    )
  }

  const estado = await db.select().from(portariasEvento)
    .where(eq(portariasEvento.eventoId, eventoId)).get()
  if (estado?.status === 'FECHADA') {
    return c.json({ error: 'A Portaria deste evento já foi fechada', code: 'PORTARIA_FECHADA' }, 409)
  }

  const existente = await db.select({ id: portariaOperadoresEvento.id })
    .from(portariaOperadoresEvento)
    .where(and(
      eq(portariaOperadoresEvento.eventoId, eventoId),
      eq(portariaOperadoresEvento.membroId, body.membroId),
      eq(portariaOperadoresEvento.ativo, true)
    )).get()
  if (existente) {
    return c.json({ error: 'Porteiro já autorizado neste evento', code: 'OPERADOR_DUPLICADO' }, 409)
  }

  const agora = new Date().toISOString()
  const autorizacaoId = crypto.randomUUID()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => {
      const queries = []
      if (!estado) {
        queries.push(qdb.insert(portariasEvento).values({
          eventoId,
          status: 'ABERTA',
          createdAt: agora,
          updatedAt: agora,
        }))
      }
      queries.push(qdb.insert(portariaOperadoresEvento).values({
        id: autorizacaoId,
        eventoId,
        membroId: body.membroId!,
        concedidoPorMembroId: atorMembroId,
        ativo: true,
        createdAt: agora,
        updatedAt: agora,
      }))
      return queries
    },
    {
      acao: 'PORTARIA_OPERADOR_TEMPORARIO_CONCEDIDO',
      atorMembroId,
      recursoTipo: 'PORTARIA_OPERADOR_EVENTO',
      recursoId: autorizacaoId,
      escopoTipo,
      escopoId,
      contexto: { eventoId, operadorMembroId: body.membroId },
    }
  )

  return c.json({
    id: autorizacaoId,
    eventoId,
    membroId: body.membroId,
    ativo: true,
    temporario: true,
  }, 201)
})

// GET /api/v1/portaria/eventos/:eventoId/operadores
portariaRouter.get('/eventos/:eventoId/operadores', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')

  if (!eMasterSistema(contexto)) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const operadores = await db
    .select({
      id: portariaOperadoresEvento.id,
      membroId: portariaOperadoresEvento.membroId,
      nome: membros.nome,
      ativo: portariaOperadoresEvento.ativo,
      revogadoEm: portariaOperadoresEvento.revogadoEm,
    })
    .from(portariaOperadoresEvento)
    .innerJoin(membros, eq(portariaOperadoresEvento.membroId, membros.id))
    .where(eq(portariaOperadoresEvento.eventoId, eventoId))
    .all()

  return c.json({ data: operadores }, 200)
})

// DELETE /api/v1/portaria/eventos/:eventoId/operadores/:membroId
portariaRouter.delete('/eventos/:eventoId/operadores/:membroId', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')
  const operadorMembroId = c.req.param('membroId')

  if (!eMasterSistema(contexto)) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const autorizacao = await db.select().from(portariaOperadoresEvento)
    .where(and(
      eq(portariaOperadoresEvento.eventoId, eventoId),
      eq(portariaOperadoresEvento.membroId, operadorMembroId),
      eq(portariaOperadoresEvento.ativo, true)
    )).get()

  if (!autorizacao) {
    return c.json({ error: 'Autorização temporária não encontrada', code: 'NOT_FOUND' }, 404)
  }

  const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
  const agora = new Date().toISOString()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb.update(portariaOperadoresEvento).set({
        ativo: false,
        revogadoEm: agora,
        updatedAt: agora,
      }).where(eq(portariaOperadoresEvento.id, autorizacao.id)),
    ],
    {
      acao: 'PORTARIA_OPERADOR_TEMPORARIO_REVOGADO',
      atorMembroId,
      recursoTipo: 'PORTARIA_OPERADOR_EVENTO',
      recursoId: autorizacao.id,
      escopoTipo,
      escopoId,
      contexto: { eventoId, operadorMembroId },
    }
  )

  return c.json({ message: 'Autorização temporária revogada' }, 200)
})

// GET /api/v1/portaria/eventos/:eventoId/fechamento-solicitacao
portariaRouter.get('/eventos/:eventoId/fechamento-solicitacao', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')

  const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
  if (!evento) return c.json({ error: 'Evento não encontrado', code: 'NOT_FOUND' }, 404)

  const operador = await eOperadorPortariaAutorizado(db, atorMembroId, evento)
  const gestor = Boolean(
    atorMembroId && await podeGerarCredencialOperador(db, atorMembroId, contexto, evento)
  )
  if (!operador && !gestor) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const solicitacao = await db.select().from(portariaSolicitacoesFechamento)
    .where(eq(portariaSolicitacoesFechamento.eventoId, eventoId)).get()
  const estado = await db.select().from(portariasEvento)
    .where(eq(portariasEvento.eventoId, eventoId)).get()

  return c.json({
    statusPortaria: estado?.status ?? 'ABERTA',
    solicitada: Boolean(solicitacao && !solicitacao.confirmadoEm),
    solicitadoEm: solicitacao?.solicitadoEm ?? null,
    podeConfirmar: gestor,
  }, 200)
})

// POST /api/v1/portaria/eventos/:eventoId/solicitar-fechamento
portariaRouter.post('/eventos/:eventoId/solicitar-fechamento', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')

  const evento = await db.select().from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true))).get()
  if (!evento) return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)

  const operador = await eOperadorPortariaAutorizado(db, atorMembroId, evento)
  const gestor = Boolean(
    atorMembroId && await podeGerarCredencialOperador(db, atorMembroId, contexto, evento)
  )
  if (!operador && !gestor) {
    return c.json({ error: 'Acesso não autorizado para solicitar encerramento', code: 'FORBIDDEN' }, 403)
  }

  const estado = await db.select().from(portariasEvento)
    .where(eq(portariasEvento.eventoId, eventoId)).get()
  if (estado?.status === 'FECHADA') {
    return c.json({ error: 'A Portaria já está fechada', code: 'PORTARIA_FECHADA' }, 409)
  }

  const existente = await db.select().from(portariaSolicitacoesFechamento)
    .where(eq(portariaSolicitacoesFechamento.eventoId, eventoId)).get()
  if (existente && !existente.confirmadoEm) {
    return c.json({
      status: 'AGUARDANDO_CONFIRMACAO',
      solicitadoEm: existente.solicitadoEm,
      message: 'Encerramento já solicitado e aguardando confirmação do gestor.',
    }, 200)
  }

  const agora = new Date().toISOString()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb.insert(portariaSolicitacoesFechamento).values({
        eventoId,
        solicitadoPorMembroId: atorMembroId,
        solicitadoPorCredencialId: null,
        solicitadoEm: agora,
        confirmadoPorMembroId: null,
        confirmadoEm: null,
        createdAt: agora,
        updatedAt: agora,
      }).onConflictDoUpdate({
        target: portariaSolicitacoesFechamento.eventoId,
        set: {
          solicitadoPorMembroId: atorMembroId,
          solicitadoPorCredencialId: null,
          solicitadoEm: agora,
          confirmadoPorMembroId: null,
          confirmadoEm: null,
          updatedAt: agora,
        },
      }),
    ],
    {
      acao: 'PORTARIA_FECHAMENTO_SOLICITADO',
      atorMembroId,
      recursoTipo: 'PORTARIA',
      recursoId: eventoId,
      escopoTipo,
      escopoId,
      contexto: { eventoId },
    }
  )

  return c.json({
    status: 'AGUARDANDO_CONFIRMACAO',
    solicitadoEm: agora,
    message: 'Solicitação enviada ao gestor da reunião.',
  }, 202)
})

// POST /api/v1/portaria/eventos/:eventoId/fechar
portariaRouter.post('/eventos/:eventoId/fechar', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  const evento = await db.select().from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true))).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  const estado = await db.select().from(portariasEvento)
    .where(eq(portariasEvento.eventoId, eventoId)).get()
  if (estado?.status === 'FECHADA') {
    return c.json({ error: 'A Portaria já está fechada', code: 'PORTARIA_FECHADA' }, 409)
  }

  const contexto = c.get('contextoPermissoes')
  const autorizado =
    Boolean(atorMembroId) &&
    await podeGerarCredencialOperador(db, atorMembroId, contexto, evento)
  if (!autorizado) {
    return c.json(
      { error: 'Somente o gestor autorizado da reunião pode confirmar o encerramento', code: 'FORBIDDEN' },
      403
    )
  }

  const solicitacao = await db.select().from(portariaSolicitacoesFechamento)
    .where(eq(portariaSolicitacoesFechamento.eventoId, eventoId)).get()
  if (!solicitacao || solicitacao.confirmadoEm) {
    return c.json(
      { error: 'O encerramento precisa ser solicitado pelo porteiro antes da confirmação', code: 'SOLICITACAO_FECHAMENTO_NECESSARIA' },
      409
    )
  }

  const existente = await db.select({ id: portariaFechamentos.id })
    .from(portariaFechamentos)
    .where(eq(portariaFechamentos.eventoId, eventoId)).get()
  if (existente) {
    return c.json({ error: 'Fechamento final já materializado', code: 'FECHAMENTO_EXISTENTE' }, 409)
  }

  const snapshot = await montarSnapshotFechamentoPortaria(db, eventoId)
  const agora = new Date().toISOString()
  const fechamentoId = crypto.randomUUID()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => {
      const queries = []

      if (estado) {
        queries.push(qdb.update(portariasEvento).set({
          status: 'FECHADA',
          fechadaEm: agora,
          fechadaPorMembroId: atorMembroId,
          updatedAt: agora,
        }).where(eq(portariasEvento.eventoId, eventoId)))
      } else {
        queries.push(qdb.insert(portariasEvento).values({
          eventoId,
          status: 'FECHADA',
          fechadaEm: agora,
          fechadaPorMembroId: atorMembroId,
          createdAt: agora,
          updatedAt: agora,
        }))
      }

      queries.push(
        qdb.update(portariaOperadoresEvento).set({
          ativo: false,
          revogadoEm: agora,
          updatedAt: agora,
        }).where(and(
          eq(portariaOperadoresEvento.eventoId, eventoId),
          eq(portariaOperadoresEvento.ativo, true)
        ))
      )

      queries.push(
        qdb.update(credenciaisCadastroPortariaEvento).set({
          ativo: false,
          revogadoEm: agora,
          updatedAt: agora,
        }).where(and(
          eq(credenciaisCadastroPortariaEvento.eventoId, eventoId),
          eq(credenciaisCadastroPortariaEvento.ativo, true)
        ))
      )

      queries.push(
        qdb.update(credenciaisOperadorPortariaEvento).set({
          ativo: false,
          revogadoEm: agora,
          updatedAt: agora,
        }).where(and(
          eq(credenciaisOperadorPortariaEvento.eventoId, eventoId),
          eq(credenciaisOperadorPortariaEvento.ativo, true)
        ))
      )

      queries.push(
        qdb.update(portariaSolicitacoesFechamento).set({
          confirmadoPorMembroId: atorMembroId,
          confirmadoEm: agora,
          updatedAt: agora,
        }).where(and(
          eq(portariaSolicitacoesFechamento.eventoId, eventoId),
          eq(portariaSolicitacoesFechamento.solicitadoEm, solicitacao.solicitadoEm)
        ))
      )

      queries.push(qdb.insert(portariaFechamentos).values({
        id: fechamentoId,
        eventoId,
        fechadoPorMembroId: atorMembroId,
        fechadoEm: agora,
        ...snapshot.resumo,
        createdAt: agora,
        updatedAt: agora,
      }))

      for (const item of snapshot.itens) {
        queries.push(qdb.insert(portariaFechamentoItens).values({
          id: crypto.randomUUID(),
          fechamentoId,
          eventoId,
          tipoPessoa: item.tipoPessoa,
          origemId: item.origemId,
          nome: item.nome,
          localidade: item.localidade,
          situacao: item.situacao,
          respostaRsvp: item.respostaRsvp,
          formaPresenca: item.formaPresenca,
          registradoEm: item.registradoEm,
          createdAt: agora,
          updatedAt: agora,
        }))
      }

      return queries
    },
    {
      acao: 'PORTARIA_FECHADA_COM_SNAPSHOT',
      atorMembroId,
      recursoTipo: 'PORTARIA_FECHAMENTO',
      recursoId: fechamentoId,
      escopoTipo,
      escopoId,
      contexto: {
        eventoId,
        solicitadoEm: solicitacao.solicitadoEm,
        ...snapshot.resumo,
      },
    }
  )

  return c.json({
    status: 'FECHADA',
    fechamento: {
      id: fechamentoId,
      eventoId,
      fechadoEm: agora,
      fechadoPorMembroId: atorMembroId,
    },
    resumo: snapshot.resumo,
    itens: snapshot.itens,
  }, 200)
})

// POST /api/v1/portaria/eventos/:eventoId/reabrir
portariaRouter.post('/eventos/:eventoId/reabrir', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')

  const evento = await db.select().from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true))).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  if (!atorMembroId || !(await podeGerarCredencialOperador(db, atorMembroId, contexto, evento))) {
    return c.json(
      { error: 'Somente o gestor autorizado da reunião pode reabrir a Portaria', code: 'FORBIDDEN' },
      403
    )
  }

  const estado = await db.select().from(portariasEvento)
    .where(eq(portariasEvento.eventoId, eventoId)).get()
  if (estado?.status !== 'FECHADA') {
    return c.json({ error: 'A Portaria não está fechada', code: 'PORTARIA_NAO_FECHADA' }, 409)
  }

  const fechamento = await db.select().from(portariaFechamentos)
    .where(eq(portariaFechamentos.eventoId, eventoId)).get()
  if (!fechamento) {
    return c.json({ error: 'Fechamento final não encontrado', code: 'FECHAMENTO_NAO_ENCONTRADO' }, 409)
  }

  let body: { motivo?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }
  const motivo = body.motivo?.trim() ?? ''
  if (motivo.length < 5 || motivo.length > 200) {
    return c.json(
      { error: 'Informe um motivo entre 5 e 200 caracteres para reabrir a Portaria', code: 'VALIDATION_ERROR' },
      400
    )
  }

  const agora = new Date().toISOString()
  const reaberturaId = crypto.randomUUID()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb.delete(portariaFechamentoItens)
        .where(eq(portariaFechamentoItens.fechamentoId, fechamento.id)),
      qdb.delete(portariaFechamentos)
        .where(eq(portariaFechamentos.id, fechamento.id)),
      qdb.delete(portariaSolicitacoesFechamento)
        .where(eq(portariaSolicitacoesFechamento.eventoId, eventoId)),
      qdb.update(portariasEvento).set({
        status: 'ABERTA',
        fechadaEm: null,
        fechadaPorMembroId: null,
        updatedAt: agora,
      }).where(eq(portariasEvento.eventoId, eventoId)),
      qdb.insert(portariaReaberturas).values({
        id: reaberturaId,
        eventoId,
        fechamentoAnteriorId: fechamento.id,
        reabertaPorMembroId: atorMembroId,
        motivo,
        reabertaEm: agora,
        createdAt: agora,
        updatedAt: agora,
      }),
    ],
    {
      acao: 'PORTARIA_REABERTA',
      atorMembroId,
      recursoTipo: 'PORTARIA',
      recursoId: eventoId,
      escopoTipo,
      escopoId,
      contexto: {
        eventoId,
        fechamentoAnteriorId: fechamento.id,
        motivo,
        credenciaisTemporariasReativadas: false,
      },
    }
  )

  return c.json({
    status: 'ABERTA',
    reabertura: {
      id: reaberturaId,
      eventoId,
      reabertaEm: agora,
      reabertaPorMembroId: atorMembroId,
      motivo,
    },
    message: 'Portaria reaberta. Habilite novos porteiros se necessário e faça novo fechamento ao final.',
  }, 200)
})

// GET /api/v1/portaria/eventos/:eventoId/fechamento
portariaRouter.get('/eventos/:eventoId/fechamento', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  const eventoId = c.req.param('eventoId')

  const fechamento = await db.select().from(portariaFechamentos)
    .where(eq(portariaFechamentos.eventoId, eventoId)).get()

  if (!fechamento) {
    return c.json({ error: 'Fechamento final ainda não disponível', code: 'NOT_FOUND' }, 404)
  }

  const podeConsultar =
    eMasterSistema(contexto) ||
    fechamento.fechadoPorMembroId === atorMembroId

  if (!podeConsultar) {
    return c.json({ error: 'Acesso não autorizado ao fechamento', code: 'FORBIDDEN' }, 403)
  }

  const itens = await db.select().from(portariaFechamentoItens)
    .where(eq(portariaFechamentoItens.fechamentoId, fechamento.id)).all()

  itens.sort((a: typeof itens[number], b: typeof itens[number]) => {
    const ordem = { PRESENTE: 0, PENDENTE: 1, AUSENTE: 2 } as const
    const situacaoA = a.situacao as keyof typeof ordem
    const situacaoB = b.situacao as keyof typeof ordem
    if (situacaoA !== situacaoB) return ordem[situacaoA] - ordem[situacaoB]
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  return c.json({
    fechamento: {
      id: fechamento.id,
      eventoId: fechamento.eventoId,
      fechadoEm: fechamento.fechadoEm,
      fechadoPorMembroId: fechamento.fechadoPorMembroId,
    },
    resumo: {
      totalConvocados: fechamento.totalConvocados,
      totalConvocadosPresentes: fechamento.totalConvocadosPresentes,
      totalConvocadosAusentes: fechamento.totalConvocadosAusentes,
      totalConvidadosValidados: fechamento.totalConvidadosValidados,
      totalConvidadosPendentes: fechamento.totalConvidadosPendentes,
      totalPresentes: fechamento.totalPresentes,
    },
    itens: itens.map((item: typeof itens[number]) => ({
      tipoPessoa: item.tipoPessoa,
      origemId: item.origemId,
      nome: item.nome,
      localidade: item.localidade,
      situacao: item.situacao,
      respostaRsvp: item.respostaRsvp,
      formaPresenca: item.formaPresenca,
      registradoEm: item.registradoEm,
    })),
  }, 200)
})

// POST /api/v1/portaria/eventos/:eventoId/cadastro-convidados/credencial
portariaRouter.post('/eventos/:eventoId/cadastro-convidados/credencial', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  const evento = await db.select().from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true))).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  const autorizado = await eOperadorPortariaAutorizado(db, atorMembroId, evento)
  if (!autorizado) {
    return c.json({ error: 'Operador não autorizado para este evento', code: 'FORBIDDEN' }, 403)
  }

  const token = gerarTokenAleatorio(24)
  const tokenHash = await hashToken(token)
  const agora = new Date().toISOString()
  const credencialId = crypto.randomUUID()
  const expiraEm = getSaoPauloEndOfDayIso(evento.inicioEm)
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb.update(credenciaisCadastroPortariaEvento).set({
        ativo: false,
        revogadoEm: agora,
        updatedAt: agora,
      }).where(and(
        eq(credenciaisCadastroPortariaEvento.eventoId, eventoId),
        eq(credenciaisCadastroPortariaEvento.ativo, true)
      )),
      qdb.insert(credenciaisCadastroPortariaEvento).values({
        id: credencialId,
        eventoId,
        tokenHash,
        expiraEm,
        criadoPorMembroId: atorMembroId,
        ativo: true,
        createdAt: agora,
        updatedAt: agora,
      }),
    ],
    {
      acao: 'PORTARIA_CREDENCIAL_AUTOCADASTRO_CRIADA',
      atorMembroId,
      recursoTipo: 'CREDENCIAL_CADASTRO_PORTARIA',
      recursoId: credencialId,
      escopoTipo,
      escopoId,
      contexto: { eventoId },
    }
  )

  return c.json({
    eventoId,
    credencial: {
      token,
      expiraEm,
      caminhoCadastro: `/c?p=${encodeURIComponent(token)}`,
      endpointCadastro: `/api/v1/portaria-publica/cadastro/${token}`,
    },
  }, 201)
})

// POST /api/v1/portaria/eventos/:eventoId/convidados
// Contingência operacional: cadastro manual pelo porteiro.
portariaRouter.post('/eventos/:eventoId/convidados', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  const evento = await db.select().from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true))).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  const autorizado = await eOperadorPortariaAutorizado(db, atorMembroId, evento)
  if (!autorizado) {
    return c.json({ error: 'Operador não autorizado para este evento', code: 'FORBIDDEN' }, 403)
  }

  let body: {
    nome?: string
    localidade?: string
    referencia?: string | null
    observacoes?: string | null
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  const nome = body.nome?.trim()
  const localidade = body.localidade?.trim()
  if (!nome || nome.length < 2 || nome.length > 120 || !localidade || localidade.length > 120) {
    return c.json({ error: 'Nome ou localidade inválidos', code: 'VALIDATION_ERROR' }, 400)
  }

  const agora = new Date().toISOString()
  const convidadoId = crypto.randomUUID()
  const presencaId = crypto.randomUUID()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb.insert(convidadosEvento).values({
        id: convidadoId,
        eventoId,
        nome,
        localidade,
        referencia: body.referencia?.trim() || null,
        observacoes: body.observacoes?.trim() || null,
        status: 'VALIDADO',
        criadoPorMembroId: atorMembroId,
        validadoPorMembroId: atorMembroId,
        validadoEm: agora,
        ativo: true,
        createdAt: agora,
        updatedAt: agora,
      }),
      qdb.insert(presencasConvidadoEvento).values({
        id: presencaId,
        convidadoId,
        eventoId,
        forma: 'MANUAL',
        registradoPorMembroId: atorMembroId,
        registradoEm: agora,
        createdAt: agora,
        updatedAt: agora,
      }),
    ],
    {
      acao: 'PORTARIA_CONVIDADO_MANUAL_VALIDADO',
      atorMembroId,
      recursoTipo: 'CONVIDADO_EVENTO',
      recursoId: convidadoId,
      escopoTipo,
      escopoId,
      contexto: { eventoId, forma: 'MANUAL' },
    }
  )

  return c.json({ id: convidadoId, eventoId, nome, localidade, status: 'VALIDADO' }, 201)
})

// GET /api/v1/portaria/eventos/:eventoId/convidados
portariaRouter.get('/eventos/:eventoId/convidados', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  const evento = await db.select().from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true))).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  const autorizado = await eOperadorPortariaAutorizado(db, atorMembroId, evento)
  if (!autorizado) {
    return c.json({ error: 'Operador não autorizado para este evento', code: 'FORBIDDEN' }, 403)
  }

  const convidados = await db
    .select({
      id: convidadosEvento.id,
      nome: convidadosEvento.nome,
      localidade: convidadosEvento.localidade,
      referencia: convidadosEvento.referencia,
      observacoes: convidadosEvento.observacoes,
      status: convidadosEvento.status,
      validadoEm: convidadosEvento.validadoEm,
      presencaId: presencasConvidadoEvento.id,
      registradoEm: presencasConvidadoEvento.registradoEm,
      forma: presencasConvidadoEvento.forma,
    })
    .from(convidadosEvento)
    .leftJoin(
      presencasConvidadoEvento,
      and(
        eq(presencasConvidadoEvento.convidadoId, convidadosEvento.id),
        eq(presencasConvidadoEvento.eventoId, eventoId)
      )
    )
    .where(and(
      eq(convidadosEvento.eventoId, eventoId),
      eq(convidadosEvento.ativo, true)
    ))
    .all()

  return c.json({ data: convidados }, 200)
})

// POST /api/v1/portaria/eventos/:eventoId/convidados/:convidadoId/validar
portariaRouter.post('/eventos/:eventoId/convidados/:convidadoId/validar', async c => {
  const db = c.get('db')
  const atorMembroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')
  const convidadoId = c.req.param('convidadoId')

  const evento = await db.select().from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true))).get()
  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  const autorizado = await eOperadorPortariaAutorizado(db, atorMembroId, evento)
  if (!autorizado) {
    return c.json({ error: 'Operador não autorizado para este evento', code: 'FORBIDDEN' }, 403)
  }

  const convidado = await db.select().from(convidadosEvento)
    .where(and(
      eq(convidadosEvento.id, convidadoId),
      eq(convidadosEvento.eventoId, eventoId),
      eq(convidadosEvento.ativo, true)
    )).get()

  if (!convidado) {
    return c.json({ error: 'Convidado não encontrado', code: 'NOT_FOUND' }, 404)
  }
  if (convidado.status === 'VALIDADO') {
    return c.json({ error: 'Convidado já validado', code: 'PRESENCA_DUPLICADA' }, 409)
  }

  const agora = new Date().toISOString()
  const presencaId = crypto.randomUUID()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)

  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb.update(convidadosEvento).set({
        status: 'VALIDADO',
        validadoPorMembroId: atorMembroId,
        validadoEm: agora,
        updatedAt: agora,
      }).where(eq(convidadosEvento.id, convidadoId)),
      qdb.insert(presencasConvidadoEvento).values({
        id: presencaId,
        convidadoId,
        eventoId,
        forma: 'VALIDACAO_PORTEIRO',
        registradoPorMembroId: atorMembroId,
        registradoEm: agora,
        createdAt: agora,
        updatedAt: agora,
      }),
    ],
    {
      acao: 'PORTARIA_CONVIDADO_VALIDADO',
      atorMembroId,
      recursoTipo: 'PRESENCA_CONVIDADO_EVENTO',
      recursoId: presencaId,
      escopoTipo,
      escopoId,
      contexto: { eventoId, convidadoId },
    }
  )

  return c.json({
    convidadoId,
    eventoId,
    status: 'VALIDADO',
    forma: 'VALIDACAO_PORTEIRO',
    registradoEm: agora,
  }, 201)
})

// GET /api/v1/portaria/eventos
portariaRouter.get('/eventos', async (c) => {
  const db = c.get('db')
  const membroSessaoId = c.get('membroId')

  if (!db || !membroSessaoId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  try {
    const rawData = c.req.query('data')
    const parsedQuery = PortariaEventosQuerySchema.parse({ data: rawData })
    
    let targetDateStr = parsedQuery.data
    if (!targetDateStr) {
      // Formato YYYY-MM-DD usando o fuso horário de São Paulo
      const formatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      targetDateStr = formatter.format(new Date())
    }

    const candidateEvents = await db
      .select()
      .from(eventos)
      .where(eq(eventos.ativo, true))
      .all()

    const authorizedEvents = []

    for (const evento of candidateEvents) {
      // Filtrar pela data paulista com helper
      try {
        if (getSaoPauloDateString(evento.inicioEm) !== targetDateStr) {
          continue
        }
      } catch {
        continue
      }

      const contexto = c.get('contextoPermissoes')
      const isAuthorized = await eOperadorPortariaAutorizado(
        db,
        membroSessaoId,
        evento,
        contexto
      )
      const isGestor = await podeGerarCredencialOperador(db, membroSessaoId, contexto, evento)
      if (isAuthorized || isGestor) {
        const estadoPortaria = await db.select({ status: portariasEvento.status })
          .from(portariasEvento)
          .where(eq(portariasEvento.eventoId, evento.id))
          .get()
        authorizedEvents.push({
          id: evento.id,
          titulo: evento.titulo,
          inicioEm: evento.inicioEm,
          fimEm: evento.fimEm,
          modalidade: evento.modalidade,
          statusPortaria: estadoPortaria?.status ?? 'ABERTA',
          podeOperarPortaria: isAuthorized,
          podeConfirmarFechamento: isGestor,
        })
      }
    }

    authorizedEvents.sort((a, b) => a.inicioEm.localeCompare(b.inicioEm))

    return c.json({ data: authorizedEvents }, 200)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'issues' in err) {
      return c.json({ error: 'Payload inválido', details: (err as { issues: unknown }).issues }, 400)
    }
    const message = err instanceof Error ? err.message : 'Erro ao carregar eventos da portaria'
    return c.json({ error: message }, 400)
  }
})

// GET /api/v1/portaria/eventos/:eventoId/participantes
portariaRouter.get('/eventos/:eventoId/participantes', async (c) => {
  const db = c.get('db')
  const membroSessaoId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !membroSessaoId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  // 1. Busca o evento
  const evento = await db
    .select()
    .from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true)))
    .get()

  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  // 2. Valida se o operador é OPERADOR_PORTARIA autorizado no escopo do evento
  const autorizado = await eOperadorPortariaAutorizado(db, membroSessaoId, evento)
  if (!autorizado) {
    return c.json({ error: 'Operador não autorizado para operar portaria neste evento', code: 'FORBIDDEN' }, 403)
  }

  // 3. Consulta todos os destinatários de convocações PUBLICADAS para o evento
  const registros = await db
    .select({
      destinatario: convocacaoDestinatarios,
      convocacao: convocacoes,
      membro: membros,
      casa: casas,
      rsvp: rsvp,
      checkin: checkins
    })
    .from(convocacaoDestinatarios)
    .innerJoin(convocacoes, eq(convocacaoDestinatarios.convocacaoId, convocacoes.id))
    .innerJoin(membros, eq(convocacaoDestinatarios.membroId, membros.id))
    .leftJoin(casas, eq(membros.casaId, casas.id))
    .leftJoin(rsvp, eq(convocacaoDestinatarios.id, rsvp.convocacaoDestinatarioId))
    .leftJoin(
      checkins,
      and(
        eq(checkins.eventoId, eventoId),
        eq(checkins.membroId, membros.id),
        eq(checkins.status, 'ATIVO')
      )
    )
    .where(
      and(
        eq(convocacoes.eventoId, eventoId),
        eq(convocacoes.status, 'PUBLICADA'),
        eq(convocacoes.ativo, true)
      )
    )
    .all()

  // 4. Desduplicação por pessoa (membro.id) para que a listagem operacional apresente cada participante uma única vez
  const mapaMembros = new Map<string, any>()

  for (const reg of registros) {
    if (!mapaMembros.has(reg.membro.id)) {
      mapaMembros.set(reg.membro.id, {
        convocacaoDestinatarioId: reg.destinatario.id,
        membro: {
          id: reg.membro.id,
          nome: reg.membro.nome,
          casaNome: reg.casa ? reg.casa.nome : null
        },
        rsvpResposta: reg.rsvp ? reg.rsvp.resposta : null,
        checkin: reg.checkin ? {
          id: reg.checkin.id,
          dataHoraCheckin: reg.checkin.dataHoraCheckin,
          forma: reg.checkin.forma,
          operadorMembroId: reg.checkin.operadorMembroId
        } : null
      })
    }
  }

  const participantes = Array.from(mapaMembros.values())

  return c.json({
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      inicioEm: evento.inicioEm,
      fimEm: evento.fimEm
    },
    totalParticipantes: participantes.length,
    participantes
  }, 200)
})
