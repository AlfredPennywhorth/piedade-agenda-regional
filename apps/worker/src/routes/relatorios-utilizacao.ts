export type OcorrenciaUtilizacao = {
  id: string; inicioEm: string; fimEm: string; localId: string | null; espacoId: string | null
}
export type CadastroUtilizacao = { id: string; nome: string; proprietarioMembroId: string | null }
export type ResumoUtilizacao = {
  localId: string; localNome: string; espacoId: string | null; espacoNome: string | null
  totalEventos: number; minutosAgendados: number
}
export function lotesIds(ids: string[], tamanho = 80): string[][] {
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > 80) throw new RangeError('Lote inválido')
  const lotes: string[][] = []
  for (let i = 0; i < ids.length; i += tamanho) lotes.push(ids.slice(i, i + tamanho))
  return lotes
}
export function consolidarUtilizacao(
  ocorrencias: OcorrenciaUtilizacao[], locais: CadastroUtilizacao[],
  espacos: CadastroUtilizacao[], membroId: string
): { totalOcorrencias: number; totalComLocal: number; ranking: ResumoUtilizacao[] } {
  const locaisPrivados = new Set(locais.filter(l => l.proprietarioMembroId && l.proprietarioMembroId !== membroId).map(l => l.id))
  const espacosPrivados = new Set(espacos.filter(e => e.proprietarioMembroId && e.proprietarioMembroId !== membroId).map(e => e.id))
  const nomesLocal = new Map(locais.map(l => [l.id, l.nome]))
  const nomesEspaco = new Map(espacos.map(e => [e.id, e.nome]))
  const grupos = new Map<string, ResumoUtilizacao>()
  for (const e of ocorrencias) {
    if (!e.localId || locaisPrivados.has(e.localId) || (e.espacoId && espacosPrivados.has(e.espacoId))) continue
    const chave = JSON.stringify([e.localId, e.espacoId])
    let item = grupos.get(chave)
    if (!item) {
      item = {
        localId: e.localId, localNome: nomesLocal.get(e.localId) ?? 'Local não encontrado',
        espacoId: e.espacoId, espacoNome: e.espacoId ? nomesEspaco.get(e.espacoId) ?? 'Espaço não encontrado' : null,
        totalEventos: 0, minutosAgendados: 0,
      }
      grupos.set(chave, item)
    }
    item.totalEventos++
    const duracao = new Date(e.fimEm).getTime() - new Date(e.inicioEm).getTime()
    if (Number.isFinite(duracao) && duracao > 0) item.minutosAgendados += Math.round(duracao / 60000)
  }
  const ranking = [...grupos.values()].sort((a, b) =>
    b.totalEventos - a.totalEventos || b.minutosAgendados - a.minutosAgendados ||
    a.localNome.localeCompare(b.localNome, 'pt-BR'))
  return { totalOcorrencias: ocorrencias.length, totalComLocal: ranking.reduce((n, item) => n + item.totalEventos, 0), ranking }
}
