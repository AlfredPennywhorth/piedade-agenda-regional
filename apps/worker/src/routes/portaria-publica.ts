import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { executarOperacaoComAudit, extrairEscopoDoEvento } from '../services/auditoria'

export const portariaPublicaRouter = new Hono<any>()

async function carregarCredencial(db: any, token: string) {
  const tokenHash = await hashToken(token)

  return db
    .select({
      credencial: schema.credenciaisCadastroPortariaEvento,
      evento: schema.eventos,
      portaria: schema.portariasEvento,
    })
    .from(schema.credenciaisCadastroPortariaEvento)
    .innerJoin(schema.eventos, eq(schema.credenciaisCadastroPortariaEvento.eventoId, schema.eventos.id))
    .leftJoin(schema.portariasEvento, eq(schema.eventos.id, schema.portariasEvento.eventoId))
    .where(eq(schema.credenciaisCadastroPortariaEvento.tokenHash, tokenHash))
    .get()
}

function validarCredencial(credencial: any) {
  if (!credencial) {
    return { status: 404, body: { error: 'Credencial inválida', code: 'NOT_FOUND' } }
  }
  if (credencial.portaria?.status === 'FECHADA') {
    return { status: 409, body: { error: 'Portaria fechada', code: 'PORTARIA_FECHADA' } }
  }
  if (
    credencial.credencial.revogadoEm ||
    !credencial.credencial.ativo ||
    !credencial.evento.ativo
  ) {
    return {
      status: 409,
      body: { error: 'Credencial indisponível', code: 'CREDENCIAL_INDISPONIVEL' },
    }
  }
  if (Date.parse(credencial.credencial.expiraEm) <= Date.now()) {
    return { status: 410, body: { error: 'Credencial expirada', code: 'CREDENCIAL_EXPIRADA' } }
  }
  return null
}

portariaPublicaRouter.get('/cadastro/:token', async c => {
  const db = c.get('db')
  const token = c.req.param('token')

  if (!db || !token) {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  const credencial = await carregarCredencial(db, token)
  const erro = validarCredencial(credencial)
  if (erro) return c.json(erro.body, erro.status as 404 | 409 | 410)

  return c.json({
    evento: {
      id: credencial.evento.id,
      titulo: credencial.evento.titulo,
      inicioEm: credencial.evento.inicioEm,
      fimEm: credencial.evento.fimEm,
    },
    campos: {
      nome: { obrigatorio: true, maximo: 120 },
      localidade: { obrigatorio: true, maximo: 120 },
      referencia: { obrigatorio: false, maximo: 120 },
      observacoes: { obrigatorio: false, maximo: 300 },
    },
  }, 200)
})

portariaPublicaRouter.post('/cadastro/:token', async c => {
  const db = c.get('db')
  const token = c.req.param('token')

  if (!db || !token) {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  const credencial = await carregarCredencial(db, token)
  const erro = validarCredencial(credencial)
  if (erro) return c.json(erro.body, erro.status as 404 | 409 | 410)

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
  const referencia = body.referencia?.trim() || null
  const observacoes = body.observacoes?.trim() || null

  if (
    !nome ||
    nome.length < 2 ||
    nome.length > 120 ||
    !localidade ||
    localidade.length > 120 ||
    (referencia && referencia.length > 120) ||
    (observacoes && observacoes.length > 300)
  ) {
    return c.json({ error: 'Dados do convidado inválidos', code: 'VALIDATION_ERROR' }, 400)
  }

  const agora = new Date().toISOString()
  const convidadoId = crypto.randomUUID()
  const { escopoTipo, escopoId } = extrairEscopoDoEvento(credencial.evento)

  await executarOperacaoComAudit(
    db,
    qdb => [
      qdb.insert(schema.convidadosEvento).values({
        id: convidadoId,
        eventoId: credencial.evento.id,
        nome,
        localidade,
        referencia,
        observacoes,
        status: 'PENDENTE',
        criadoPorMembroId: null,
        ativo: true,
        createdAt: agora,
        updatedAt: agora,
      }),
    ],
    {
      acao: 'PORTARIA_CONVIDADO_AUTOCADASTRADO',
      atorMembroId: null,
      recursoTipo: 'CONVIDADO_EVENTO',
      recursoId: convidadoId,
      escopoTipo,
      escopoId,
      contexto: { eventoId: credencial.evento.id },
    }
  )

  return c.json({
    cadastrado: true,
    convidado: {
      id: convidadoId,
      nome,
      localidade,
      status: 'PENDENTE',
    },
    mensagem: 'Cadastro enviado. Aguarde a validação do porteiro para confirmar a presença.',
  }, 201)
})
