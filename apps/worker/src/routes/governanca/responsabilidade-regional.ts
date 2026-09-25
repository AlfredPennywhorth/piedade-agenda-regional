import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { authMiddleware, Variables } from '../../middleware/auth'
import { executeAtomic } from '../../db/batch'
import { RESPONSABILIDADE_PMO_VERSAO_ATUAL } from '../../security/responsabilidade-pmo'

export const RESPONSABILIDADE_PMO_VERSAO = RESPONSABILIDADE_PMO_VERSAO_ATUAL

export const RESPONSABILIDADE_PMO_TEXTO = `Ao assumir a responsabilidade de PMO da Regional, declaro ciência de que devo: utilizar os dados exclusivamente para finalidades institucionais autorizadas; respeitar a necessidade de acesso e o menor privilégio; manter os cadastros corretos e atualizados; conceder, revisar, bloquear e revogar acessos de forma tempestiva; não compartilhar credenciais, PINs, links de ativação ou exportações não autorizadas; preservar a confidencialidade de dados pessoais, relatórios nominais e registros de auditoria; priorizar dados agregados sempre que a identificação não for necessária; comunicar incidentes ou suspeitas de uso indevido; e observar as regras institucionais, a LGPD e os procedimentos de auditoria aplicáveis. Esta marcação registra ciência das responsabilidades e não constitui consentimento para tratamento de dados pessoais.`

async function hashTexto(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const responsabilidadeRegionalApp = new Hono<{ Variables: Variables }>()

responsabilidadeRegionalApp.use('*', authMiddleware)

responsabilidadeRegionalApp.get('/', async c => {
  const db = c.get('db')
  const contaAcessoId = c.get('contaAcessoId')

  const acessos = await db
    .select({
      acessoContaId: schema.acessosConta.id,
      regionalId: schema.acessosConta.escopoId,
      regionalNome: schema.regionais.nome,
      cienteEm: schema.cienciasResponsabilidade.cienteEm,
      versaoRegistrada: schema.cienciasResponsabilidade.versaoTexto,
    })
    .from(schema.acessosConta)
    .leftJoin(
      schema.regionais,
      eq(schema.regionais.id, schema.acessosConta.escopoId)
    )
    .leftJoin(
      schema.cienciasResponsabilidade,
      and(
        eq(schema.cienciasResponsabilidade.acessoContaId, schema.acessosConta.id),
        eq(schema.cienciasResponsabilidade.contaAcessoId, contaAcessoId),
        eq(schema.cienciasResponsabilidade.tipo, 'RESPONSAVEL_REGIONAL_PMO'),
        eq(schema.cienciasResponsabilidade.versaoTexto, RESPONSABILIDADE_PMO_VERSAO)
      )
    )
    .where(
      and(
        eq(schema.acessosConta.contaAcessoId, contaAcessoId),
        eq(schema.acessosConta.perfilCodigo, 'ADMINISTRADOR_SISTEMA'),
        eq(schema.acessosConta.escopoTipo, 'REGIONAL'),
        eq(schema.acessosConta.ativo, true)
      )
    )
    .all()

  if (acessos.length === 0) {
    return c.json({ error: 'Responsabilidade regional não atribuída', code: 'FORBIDDEN' }, 403)
  }

  return c.json({
    tipo: 'RESPONSAVEL_REGIONAL_PMO',
    natureza: 'CIENCIA_DE_RESPONSABILIDADE',
    versao: RESPONSABILIDADE_PMO_VERSAO,
    texto: RESPONSABILIDADE_PMO_TEXTO,
    acessos: acessos.map((acesso: any) => ({
      acessoContaId: acesso.acessoContaId,
      regionalId: acesso.regionalId,
      regionalNome: acesso.regionalNome,
      ciente: Boolean(acesso.cienteEm),
      cienteEm: acesso.cienteEm,
      versaoRegistrada: acesso.versaoRegistrada,
    })),
  })
})

responsabilidadeRegionalApp.post('/ciencia', async c => {
  const db = c.get('db')
  const contaAcessoId = c.get('contaAcessoId')
  const membroId = c.get('membroId')

  let body: { acessoContaId?: string; versao?: string; ciente?: boolean }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Requisição inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  if (
    !body.acessoContaId ||
    body.versao !== RESPONSABILIDADE_PMO_VERSAO ||
    body.ciente !== true
  ) {
    return c.json(
      { error: 'É necessário confirmar ciência do texto vigente', code: 'VALIDATION_ERROR' },
      400
    )
  }

  const acesso = await db
    .select()
    .from(schema.acessosConta)
    .where(
      and(
        eq(schema.acessosConta.id, body.acessoContaId),
        eq(schema.acessosConta.contaAcessoId, contaAcessoId),
        eq(schema.acessosConta.perfilCodigo, 'ADMINISTRADOR_SISTEMA'),
        eq(schema.acessosConta.escopoTipo, 'REGIONAL'),
        eq(schema.acessosConta.ativo, true)
      )
    )
    .get()

  if (!acesso) {
    return c.json({ error: 'Responsabilidade regional não atribuída', code: 'FORBIDDEN' }, 403)
  }

  const existente = await db
    .select({ id: schema.cienciasResponsabilidade.id })
    .from(schema.cienciasResponsabilidade)
    .where(
      and(
        eq(schema.cienciasResponsabilidade.contaAcessoId, contaAcessoId),
        eq(schema.cienciasResponsabilidade.acessoContaId, acesso.id),
        eq(schema.cienciasResponsabilidade.tipo, 'RESPONSAVEL_REGIONAL_PMO'),
        eq(schema.cienciasResponsabilidade.versaoTexto, RESPONSABILIDADE_PMO_VERSAO)
      )
    )
    .get()

  if (existente) {
    return c.json({ error: 'Ciência já registrada', code: 'CIENCIA_JA_REGISTRADA' }, 409)
  }

  const agora = new Date().toISOString()
  const cienciaId = crypto.randomUUID()
  const textoHash = await hashTexto(RESPONSABILIDADE_PMO_TEXTO)

  await executeAtomic(db, tx => [
    tx.insert(schema.cienciasResponsabilidade).values({
      id: cienciaId,
      contaAcessoId,
      acessoContaId: acesso.id,
      tipo: 'RESPONSAVEL_REGIONAL_PMO',
      versaoTexto: RESPONSABILIDADE_PMO_VERSAO,
      textoHash,
      cienteEm: agora,
    }),
    tx.insert(schema.auditoriaLogs).values({
      id: crypto.randomUUID(),
      acao: 'CIENCIA_RESPONSABILIDADE_PMO',
      atorMembroId: membroId,
      atorContaAcessoId: contaAcessoId,
      recursoTipo: 'CIENCIA_RESPONSABILIDADE',
      recursoId: cienciaId,
      escopoTipo: 'REGIONAL',
      escopoId: acesso.escopoId,
      contexto: JSON.stringify({
        tipo: 'RESPONSAVEL_REGIONAL_PMO',
        versaoTexto: RESPONSABILIDADE_PMO_VERSAO,
        textoHash,
      }),
      criadoEm: agora,
    }),
  ])

  return c.json(
    {
      message: 'Ciência registrada',
      cienciaId,
      versao: RESPONSABILIDADE_PMO_VERSAO,
      cienteEm: agora,
    },
    201
  )
})
