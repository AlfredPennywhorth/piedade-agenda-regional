import { and, eq } from 'drizzle-orm'
import * as schema from '../db/schema'

export interface ItemFechamentoPortaria {
  tipoPessoa: 'MEMBRO' | 'CONVIDADO'
  origemId: string
  nome: string
  localidade: string | null
  situacao: 'PRESENTE' | 'AUSENTE' | 'PENDENTE'
  respostaRsvp: string | null
  formaPresenca: string | null
  registradoEm: string | null
}

export interface SnapshotFechamentoPortaria {
  itens: ItemFechamentoPortaria[]
  resumo: {
    totalConvocados: number
    totalConvocadosPresentes: number
    totalConvocadosAusentes: number
    totalConvidadosValidados: number
    totalConvidadosPendentes: number
    totalPresentes: number
  }
}

export async function montarSnapshotFechamentoPortaria(
  db: any,
  eventoId: string
): Promise<SnapshotFechamentoPortaria> {
  const registrosMembros = await db
    .select({
      membroId: schema.membros.id,
      membroNome: schema.membros.nome,
      casaNome: schema.casas.nome,
      respostaRsvp: schema.rsvp.resposta,
      checkinId: schema.checkins.id,
      formaCheckin: schema.checkins.forma,
      dataHoraCheckin: schema.checkins.dataHoraCheckin,
    })
    .from(schema.convocacaoDestinatarios)
    .innerJoin(
      schema.convocacoes,
      eq(schema.convocacaoDestinatarios.convocacaoId, schema.convocacoes.id)
    )
    .innerJoin(schema.membros, eq(schema.convocacaoDestinatarios.membroId, schema.membros.id))
    .leftJoin(schema.casas, eq(schema.membros.casaId, schema.casas.id))
    .leftJoin(schema.rsvp, eq(schema.convocacaoDestinatarios.id, schema.rsvp.convocacaoDestinatarioId))
    .leftJoin(
      schema.checkins,
      and(
        eq(schema.checkins.eventoId, eventoId),
        eq(schema.checkins.membroId, schema.membros.id),
        eq(schema.checkins.status, 'ATIVO')
      )
    )
    .where(
      and(
        eq(schema.convocacoes.eventoId, eventoId),
        eq(schema.convocacoes.status, 'PUBLICADA'),
        eq(schema.convocacoes.ativo, true)
      )
    )
    .all()

  const membrosUnicos = new Map<string, ItemFechamentoPortaria>()

  for (const reg of registrosMembros) {
    const atual = membrosUnicos.get(reg.membroId)
    const presente = Boolean(reg.checkinId)

    if (!atual) {
      membrosUnicos.set(reg.membroId, {
        tipoPessoa: 'MEMBRO',
        origemId: reg.membroId,
        nome: reg.membroNome,
        localidade: reg.casaNome ?? null,
        situacao: presente ? 'PRESENTE' : 'AUSENTE',
        respostaRsvp: reg.respostaRsvp ?? null,
        formaPresenca: presente ? reg.formaCheckin ?? null : null,
        registradoEm: presente ? reg.dataHoraCheckin ?? null : null,
      })
      continue
    }

    if (presente && atual.situacao !== 'PRESENTE') {
      atual.situacao = 'PRESENTE'
      atual.formaPresenca = reg.formaCheckin ?? null
      atual.registradoEm = reg.dataHoraCheckin ?? null
    }
    if (!atual.respostaRsvp && reg.respostaRsvp) {
      atual.respostaRsvp = reg.respostaRsvp
    }
  }

  const registrosConvidados = await db
    .select({
      id: schema.convidadosEvento.id,
      nome: schema.convidadosEvento.nome,
      localidade: schema.convidadosEvento.localidade,
      status: schema.convidadosEvento.status,
      presencaId: schema.presencasConvidadoEvento.id,
      forma: schema.presencasConvidadoEvento.forma,
      registradoEm: schema.presencasConvidadoEvento.registradoEm,
    })
    .from(schema.convidadosEvento)
    .leftJoin(
      schema.presencasConvidadoEvento,
      and(
        eq(schema.presencasConvidadoEvento.convidadoId, schema.convidadosEvento.id),
        eq(schema.presencasConvidadoEvento.eventoId, eventoId)
      )
    )
    .where(
      and(
        eq(schema.convidadosEvento.eventoId, eventoId),
        eq(schema.convidadosEvento.ativo, true)
      )
    )
    .all()

  const itensConvidados: ItemFechamentoPortaria[] = registrosConvidados.map((reg: typeof registrosConvidados[number]) => ({
    tipoPessoa: 'CONVIDADO',
    origemId: reg.id,
    nome: reg.nome,
    localidade: reg.localidade,
    situacao: reg.presencaId ? 'PRESENTE' : 'PENDENTE',
    respostaRsvp: null,
    formaPresenca: reg.presencaId ? reg.forma ?? null : null,
    registradoEm: reg.presencaId ? reg.registradoEm ?? null : null,
  }))

  const itens = [
    ...Array.from(membrosUnicos.values()),
    ...itensConvidados,
  ].sort((a, b) => {
    if (a.situacao !== b.situacao) {
      const ordem = { PRESENTE: 0, PENDENTE: 1, AUSENTE: 2 }
      return ordem[a.situacao] - ordem[b.situacao]
    }
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  const membros = Array.from(membrosUnicos.values())
  const totalConvocados = membros.length
  const totalConvocadosPresentes = membros.filter(item => item.situacao === 'PRESENTE').length
  const totalConvocadosAusentes = totalConvocados - totalConvocadosPresentes
  const totalConvidadosValidados = itensConvidados.filter(item => item.situacao === 'PRESENTE').length
  const totalConvidadosPendentes = itensConvidados.filter(item => item.situacao === 'PENDENTE').length

  return {
    itens,
    resumo: {
      totalConvocados,
      totalConvocadosPresentes,
      totalConvocadosAusentes,
      totalConvidadosValidados,
      totalConvidadosPendentes,
      totalPresentes: totalConvocadosPresentes + totalConvidadosValidados,
    },
  }
}
