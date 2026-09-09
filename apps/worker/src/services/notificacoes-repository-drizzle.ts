import { eq, and } from 'drizzle-orm'
import { convocacaoDestinatarios, pushSubscriptions, membros } from '../db/schema'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import type { NotificacoesRepository, PushSubscriptionAtiva } from './notificacoes-repository'

export function criarNotificacoesRepositoryD1(
  db: DrizzleD1Database<typeof schema>
): NotificacoesRepository {
  return {
    async listarMembrosDaConvocacao(convocacaoId: string): Promise<string[]> {
      const destinatarios = await db
        .select({
          membroId: convocacaoDestinatarios.membroId
        })
        .from(convocacaoDestinatarios)
        .innerJoin(membros, eq(convocacaoDestinatarios.membroId, membros.id))
        .where(
          and(
            eq(convocacaoDestinatarios.convocacaoId, convocacaoId),
            eq(membros.ativo, true)
          )
        )
        .all()

      return destinatarios.map((d: { membroId: string }) => d.membroId)
    },

    async listarSubscriptionsAtivas(membroId: string): Promise<PushSubscriptionAtiva[]> {
      const subs = await db
        .select({
          id: pushSubscriptions.id,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth
        })
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.membroId, membroId),
            eq(pushSubscriptions.ativo, true)
          )
        )
        .all()

      return subs
    },

    async inativarSubscription(id: string): Promise<void> {
      await db
        .update(pushSubscriptions)
        .set({ ativo: false, updatedAt: new Date().toISOString() })
        .where(eq(pushSubscriptions.id, id))
        .run()
    }
  }
}

export function criarNotificacoesRepositoryBetterSQLite(
  db: BetterSQLite3Database<typeof schema>
): NotificacoesRepository {
  return {
    async listarMembrosDaConvocacao(convocacaoId: string): Promise<string[]> {
      const destinatarios = await db
        .select({
          membroId: convocacaoDestinatarios.membroId
        })
        .from(convocacaoDestinatarios)
        .innerJoin(membros, eq(convocacaoDestinatarios.membroId, membros.id))
        .where(
          and(
            eq(convocacaoDestinatarios.convocacaoId, convocacaoId),
            eq(membros.ativo, true)
          )
        )
        .all()

      return destinatarios.map((d: { membroId: string }) => d.membroId)
    },

    async listarSubscriptionsAtivas(membroId: string): Promise<PushSubscriptionAtiva[]> {
      const subs = await db
        .select({
          id: pushSubscriptions.id,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth
        })
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.membroId, membroId),
            eq(pushSubscriptions.ativo, true)
          )
        )
        .all()

      return subs
    },

    async inativarSubscription(id: string): Promise<void> {
      await db
        .update(pushSubscriptions)
        .set({ ativo: false, updatedAt: new Date().toISOString() })
        .where(eq(pushSubscriptions.id, id))
        .run()
    }
  }
}
