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
function condicaoEscopo(acesso: AcessoTecnico): SQL | undefined {
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
        sql`${e.grupoTrabalhoId} IN (SELECT id FROM grupos_trabalho WHERE regional_id = ${id})`
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

export async function condicaoEventosVisiveis(db: any, contexto: ContextoPermissoes): Promise<SQL> {
  if (eMasterSistema(contexto)) return sql`1 = 1`
  const e = schema.eventos
  const membroId = contexto.membroId
  const perfis = new Set([
    'ADMINISTRADOR_SISTEMA',
    'GESTOR_AGENDA',
    'GESTOR_RELATORIOS',
    'AUDITOR',
    'OPERADOR_PORTARIA_PERMANENTE',
  ])
  const escopos = contexto.acessosAtivos
    .filter(a => perfis.has(a.perfilCodigo))
    .map(condicaoEscopo)
    .filter((c): c is SQL => !!c)

  // Compatibilidade com os vínculos legados que já conferiam leitura operacional.
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

  return or(
    eq(e.criadorMembroId, membroId),
    and(
      eq(e.pessoal, false),
      or(
        eq(e.organizadorMembroId, membroId),
        ...escopos,
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
  const escopos = contexto.acessosAtivos
    .filter(a => ['ADMINISTRADOR_SISTEMA', 'GESTOR_AGENDA'].includes(a.perfilCodigo))
    .map(condicaoEscopo)
    .filter((c): c is SQL => !!c)
  return or(
    and(eq(e.pessoal, true), eq(e.criadorMembroId, contexto.membroId)),
    and(
      eq(e.pessoal, false),
      or(
        ...escopos,
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
