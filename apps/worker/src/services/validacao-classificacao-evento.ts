import { eq } from 'drizzle-orm'
import { pontosAtendimento, tiposReuniao } from '../db/schema'

export async function validarClassificacaoEvento(db: any, data: {
  pontoAtendimentoId?: string | null
  tipoReuniaoId?: string | null
  setorId?: string | null
}, anterior?: { pontoAtendimentoId: string | null; tipoReuniaoId: string | null }) {
  if (data.pontoAtendimentoId) {
    const ponto = await db.select().from(pontosAtendimento).where(eq(pontosAtendimento.id, data.pontoAtendimentoId)).get()
    if (!ponto || ponto.setorId !== data.setorId || (!ponto.ativo && anterior?.pontoAtendimentoId !== ponto.id)) {
      return { error: 'Ponto inexistente, inativo ou de outro Setor', code: 'PONTO_ATENDIMENTO_INVALIDO' }
    }
  }
  if (data.tipoReuniaoId) {
    const tipo = await db.select().from(tiposReuniao).where(eq(tiposReuniao.id, data.tipoReuniaoId)).get()
    if (!tipo || (!tipo.ativo && anterior?.tipoReuniaoId !== tipo.id)) {
      return { error: 'Tipo de Reunião inexistente ou inativo', code: 'TIPO_REUNIAO_INVALIDO' }
    }
  }
  return null
}

