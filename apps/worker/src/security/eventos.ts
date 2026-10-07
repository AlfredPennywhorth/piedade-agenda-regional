import { and, eq, or, sql, type SQL } from 'drizzle-orm'
import * as schema from '../db/schema'
import {
  carregarContextoPermissoes,
  eMasterSistema,
  type AcessoTecnico,
  type ContextoPermissoes,
} from './permissoes'
import { extrairEscopoDoEvento } from '../services/auditoria'

// Autoridade de eventos descende da permissão concedida. Pertencer a uma Casa
// ou exercer uma função comum não autoriza consultar agendas de outras pessoas.
export function condicaoEscopo(acesso: AcessoTecnico): SQL | undefined {
  const id = acesso.escopoId
  if (!id) return undefined
  const e = schema.eventos
  switch (acesso.escopoTipo) {
    case 'REGIONAL':
      return or(
        eq(e.regionalId, id),
        sql`${e.administracaoId} IN (SELECT id FROM administracoes WHERE regional_id = ${id})`,
        sql`${e.setorId} IN (SELECT s.id FROM setores s JOIN administracoes a ON a.id = s.administracao_id WHERE a.regional_id = ${id})`,
        sql`${e.casaId} IN (SELECT c.id FROM casas c JOIN setores s ON s.id = c.setor_id JOIN administracoes a ON a.id = s.administracao_id WHERE a.regional_id = ${id})`,
        sql`${e.grupoTrabalhoId} IN (SELECT g.id FROM grupos_trabalho g
          LEFT JOIN setores s ON s.id = g.setor_id
          LEFT JOIN administracoes a ON a.id = COALESCE(g.administracao_id, s.administracao_id)
          WHERE COALESCE(g.regional_id, a.regional_id) = ${id})`
      )
    case 'ADMINISTRACAO':
      return or(
        eq(e.administracaoId, id),
        sql`${e.setorId} IN (SELECT id FROM setores WHERE administracao_id = ${id})`,
        sql`${e.casaId} IN (SELECT c.id FROM casas c JOIN setores s ON s.id = c.setor_id WHERE s.administracao_id = ${id})`
      )
    case 'SETOR':
      return or(
        eq(e.setorId, id),
        sql`${e.casaId} IN (SELECT id FROM casas WHERE setor_id = ${id})`
      )
    case 'CASA':
      return eq(e.casaId, id)
    case 'GRUPO_TRABALHO':
      return eq(e.grupoTrabalhoId, id)
    default:
      return undefined
  }
}


function condicaoEscoposTecnicosDaConta(
  contexto: ContextoPermissoes,
  perfisSql: string
): SQL {
  if (!contexto.contaAcessoId) return sql`0 = 1`
  const e = schema.eventos
  const perfis = sql.raw(perfisSql)
  return sql`EXISTS (
    SELECT 1
    FROM acessos_conta ac
    WHERE ac.conta_acesso_id = ${contexto.contaAcessoId}
      AND ac.ativo = 1
      AND ac.perfil_codigo IN (${perfis})
      AND (
        (ac.escopo_tipo = 'REGIONAL' AND (
          ${e.regionalId} = ac.escopo_id
          OR ${e.administracaoId} IN (
            SELECT id FROM administracoes WHERE regional_id = ac.escopo_id
          )
          OR ${e.setorId} IN (
            SELECT s.id FROM setores s
            JOIN administracoes a ON a.id = s.administracao_id
            WHERE a.regional_id = ac.escopo_id
          )
          OR ${e.casaId} IN (
            SELECT c.id FROM casas c
            JOIN setores s ON s.id = c.setor_id
            JOIN administracoes a ON a.id = s.administracao_id
            WHERE a.regional_id = ac.escopo_id
          )
          OR ${e.grupoTrabalhoId} IN (
            SELECT g.id FROM grupos_trabalho g
            LEFT JOIN setores s ON s.id = g.setor_id
            LEFT JOIN administracoes a ON a.id = COALESCE(g.administracao_id, s.administracao_id)
            WHERE COALESCE(g.regional_id, a.regional_id) = ac.escopo_id
          )
        ))
        OR (ac.escopo_tipo = 'ADMINISTRACAO' AND (
          ${e.administracaoId} = ac.escopo_id
          OR ${e.setorId} IN (
            SELECT id FROM setores WHERE administracao_id = ac.escopo_id
          )
          OR ${e.casaId} IN (
            SELECT c.id FROM casas c
            JOIN setores s ON s.id = c.setor_id
            WHERE s.administracao_id = ac.escopo_id
          )
        ))
        OR (ac.escopo_tipo = 'SETOR' AND (
          ${e.setorId} = ac.escopo_id
          OR ${e.casaId} IN (
            SELECT id FROM casas WHERE setor_id = ac.escopo_id
          )
        ))
        OR (ac.escopo_tipo = 'CASA' AND ${e.casaId} = ac.escopo_id)
        OR (ac.escopo_tipo = 'GRUPO_TRABALHO' AND ${e.grupoTrabalhoId} = ac.escopo_id)
      )
  )`
}

export async function carregarEscoposOperacionaisLegados(db: any, membroId: string): Promise<SQL[]> {
  const legados = await db
    .select({ vinculo: schema.vinculosFuncionais, codigo: schema.funcoes.codigo })
    .from(schema.vinculosFuncionais)
    .innerJoin(schema.funcoes, eq(schema.vinculosFuncionais.funcaoId, schema.funcoes.id))
    .where(
      and(
        eq(schema.vinculosFuncionais.membroId, membroId),
        eq(schema.vinculosFuncionais.ativo, true),
        eq(schema.funcoes.ativo, true)
      )
    )
    .all()
  const escopos: SQL[] = []
  for (const { vinculo, codigo } of legados) {
    if (!['GESTOR_RELATORIOS', 'OPERADOR_PORTARIA', 'AUDITOR_SISTEMA'].includes(codigo)) continue
    const escopo = extrairEscopoDoEvento(vinculo)
    const condicao = condicaoEscopo({
      id: vinculo.id,
      perfilCodigo: codigo,
      escopoTipo: escopo.escopoTipo as AcessoTecnico['escopoTipo'],
      escopoId: escopo.escopoId,
    })
    if (condicao) escopos.push(condicao)
  }

  return escopos
}

export async function condicaoEventosVisiveis(db: any, contexto: ContextoPermissoes): Promise<SQL> {
  if (eMasterSistema(contexto)) return sql`1 = 1`
  const e = schema.eventos
  const membroId = contexto.membroId
  const escoposLegados = await carregarEscoposOperacionaisLegados(db, membroId)
  const escoposTecnicos = condicaoEscoposTecnicosDaConta(
    contexto,
    "'ADMINISTRADOR_SISTEMA','GESTOR_AGENDA','GESTOR_RELATORIOS','AUDITOR','OPERADOR_PORTARIA_PERMANENTE'"
  )

  return or(
    eq(e.criadorMembroId, membroId),
    and(
      eq(e.pessoal, false),
      or(
        eq(e.organizadorMembroId, membroId),
        escoposTecnicos,
        ...escoposLegados,
        sql`EXISTS (SELECT 1 FROM convocacoes c JOIN convocacao_destinatarios d ON d.convocacao_id = c.id WHERE c.evento_id = ${e.id} AND c.status = 'PUBLICADA' AND c.ativo = 1 AND d.membro_id = ${membroId})`
      )
    )
  )!
}

export async function podeLerEvento(
  db: any,
  contexto: ContextoPermissoes,
  eventoId: string
): Promise<boolean> {
  const condicao = await condicaoEventosVisiveis(db, contexto)
  return !!(await db
    .select({ id: schema.eventos.id })
    .from(schema.eventos)
    .where(and(eq(schema.eventos.id, eventoId), condicao))
    .get())
}

export function condicaoEventosGerenciaveis(contexto: ContextoPermissoes): SQL {
  if (eMasterSistema(contexto)) return sql`1 = 1`
  const e = schema.eventos
  const escoposTecnicos = condicaoEscoposTecnicosDaConta(
    contexto,
    "'ADMINISTRADOR_SISTEMA','GESTOR_AGENDA'"
  )
  return or(
    and(eq(e.pessoal, true), eq(e.criadorMembroId, contexto.membroId)),
    and(
      eq(e.pessoal, false),
      or(
        escoposTecnicos,
        and(
          or(
            eq(e.criadorMembroId, contexto.membroId),
            eq(e.organizadorMembroId, contexto.membroId)
          ),
          sql`${e.casaId} IN (SELECT casa_id FROM membros WHERE id = ${contexto.membroId} AND ativo = 1)`
        )
      )
    )
  )!
}

export async function podeGerenciarEvento(
  db: any,
  membroId: string,
  evento: any
): Promise<boolean> {
  const contexto = await carregarContextoPermissoes(db, membroId)
  return !!(await db
    .select({ id: schema.eventos.id })
    .from(schema.eventos)
    .where(and(eq(schema.eventos.id, evento.id), condicaoEventosGerenciaveis(contexto)))
    .get())
}
