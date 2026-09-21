import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import type { AcessoTecnico, ContextoPermissoes } from './permissoes'

export type EscopoTipo = AcessoTecnico['escopoTipo']

export function eMaster(contexto: ContextoPermissoes): boolean {
  return contexto.acessosAtivos.some(
    acesso =>
      acesso.perfilCodigo === 'MASTER_SISTEMA' &&
      acesso.escopoTipo === 'GLOBAL' &&
      acesso.escopoId === null
  )
}

export function regionaisAdministradas(contexto: ContextoPermissoes): Set<string> {
  return new Set(
    contexto.acessosAtivos
      .filter(
        acesso =>
          acesso.perfilCodigo === 'ADMINISTRADOR_SISTEMA' &&
          acesso.escopoTipo === 'REGIONAL' &&
          acesso.escopoId
      )
      .map(acesso => acesso.escopoId as string)
  )
}

export function podeAdministrarRegional(
  contexto: ContextoPermissoes,
  regionalId: string
): boolean {
  return eMaster(contexto) || regionaisAdministradas(contexto).has(regionalId)
}

export async function regionalDoEscopo(
  db: any,
  escopoTipo: EscopoTipo,
  escopoId: string | null
): Promise<string | null> {
  if (escopoTipo === 'GLOBAL' || !escopoId) return null
  if (escopoTipo === 'REGIONAL') {
    const item = await db.select({ id: schema.regionais.id })
      .from(schema.regionais).where(eq(schema.regionais.id, escopoId)).get()
    return item?.id ?? null
  }
  if (escopoTipo === 'ADMINISTRACAO') {
    const item = await db.select({ regionalId: schema.administracoes.regionalId })
      .from(schema.administracoes).where(eq(schema.administracoes.id, escopoId)).get()
    return item?.regionalId ?? null
  }
  if (escopoTipo === 'SETOR') {
    const item = await db.select({ regionalId: schema.administracoes.regionalId })
      .from(schema.setores)
      .innerJoin(schema.administracoes, eq(schema.setores.administracaoId, schema.administracoes.id))
      .where(eq(schema.setores.id, escopoId)).get()
    return item?.regionalId ?? null
  }
  if (escopoTipo === 'CASA') {
    const item = await db.select({ regionalId: schema.administracoes.regionalId })
      .from(schema.casas)
      .innerJoin(schema.setores, eq(schema.casas.setorId, schema.setores.id))
      .innerJoin(schema.administracoes, eq(schema.setores.administracaoId, schema.administracoes.id))
      .where(eq(schema.casas.id, escopoId)).get()
    return item?.regionalId ?? null
  }

  const item = await db.select({
    regionalId: schema.gruposTrabalho.regionalId,
    regionalAdministracao: schema.administracoes.regionalId,
  })
    .from(schema.gruposTrabalho)
    .leftJoin(schema.administracoes, eq(schema.gruposTrabalho.administracaoId, schema.administracoes.id))
    .where(eq(schema.gruposTrabalho.id, escopoId))
    .get()

  if (item?.regionalId) return item.regionalId
  if (item?.regionalAdministracao) return item.regionalAdministracao

  const viaSetor = await db.select({ regionalId: schema.administracoes.regionalId })
    .from(schema.gruposTrabalho)
    .innerJoin(schema.setores, eq(schema.gruposTrabalho.setorId, schema.setores.id))
    .innerJoin(schema.administracoes, eq(schema.setores.administracaoId, schema.administracoes.id))
    .where(eq(schema.gruposTrabalho.id, escopoId))
    .get()

  return viaSetor?.regionalId ?? null
}

export async function regionalDoMembro(db: any, membroId: string): Promise<string | null> {
  const item = await db.select({ regionalId: schema.administracoes.regionalId })
    .from(schema.membros)
    .innerJoin(schema.casas, eq(schema.membros.casaId, schema.casas.id))
    .innerJoin(schema.setores, eq(schema.casas.setorId, schema.setores.id))
    .innerJoin(schema.administracoes, eq(schema.setores.administracaoId, schema.administracoes.id))
    .where(eq(schema.membros.id, membroId))
    .get()

  return item?.regionalId ?? null
}
