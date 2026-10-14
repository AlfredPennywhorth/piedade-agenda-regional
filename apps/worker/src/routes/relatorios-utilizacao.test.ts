import { describe, expect, it } from 'vitest'
import { consolidarUtilizacao, lotesIds, type OcorrenciaUtilizacao } from './relatorios-utilizacao'

const evento = (id: string, localId: string | null, espacoId: string | null = null): OcorrenciaUtilizacao => ({
  id, localId, espacoId, inicioEm: '2026-10-01T12:00:00.000Z', fimEm: '2026-10-01T13:30:00.000Z',
})

describe('lotes do relatório de utilização', () => {
  it('fragmenta mais de cem IDs mantendo tamanho de até oitenta', () => {
    const ids = Array.from({ length: 201 }, (_, i) => 'id-' + i)
    const lotes = lotesIds(ids)
    expect(lotes.map(l => l.length)).toEqual([80, 80, 41])
    expect(lotes.flat()).toEqual(ids)
  })
  it('não cria consulta vazia', () => expect(lotesIds([])).toEqual([]))
})

describe('agregação e privacidade no relatório', () => {
  const locais = [
    { id: 'publico', nome: 'Salão', proprietarioMembroId: null },
    { id: 'outro', nome: 'Local particular', proprietarioMembroId: 'pessoa-2' },
    { id: 'proprio', nome: 'Meu local', proprietarioMembroId: 'pessoa-1' },
  ]
  const espacos = [
    { id: 'sala', nome: 'Sala pública', proprietarioMembroId: null },
    { id: 'privado', nome: 'Sala particular', proprietarioMembroId: 'pessoa-2' },
  ]
  it('preserva total mas não inclui dados particulares de terceiros no ranking', () => {
    const resumo = consolidarUtilizacao([
      evento('1', 'publico', 'sala'), evento('2', 'outro'),
      evento('3', 'publico', 'privado'), evento('4', 'proprio'), evento('5', null),
    ], locais, espacos, 'pessoa-1')
    expect(resumo.totalOcorrencias).toBe(5)
    expect(resumo.totalComLocal).toBe(2)
    expect(resumo.ranking.map(r => r.localId).sort()).toEqual(['proprio', 'publico'])
    expect(JSON.stringify(resumo.ranking)).not.toContain('particular')
  })
  it('conta ocorrências individualmente e agrega duração', () => {
    const resumo = consolidarUtilizacao([evento('a', 'publico'), evento('b', 'publico')], locais, espacos, 'pessoa-1')
    expect(resumo.totalOcorrencias).toBe(2)
    expect(resumo.ranking[0].totalEventos).toBe(2)
    expect(resumo.ranking[0].minutosAgendados).toBe(180)
  })
  it('permite resultado vazio sem subestimar eventos', () => {
    const resumo = consolidarUtilizacao([evento('a', 'outro')], locais, espacos, 'pessoa-1')
    expect(resumo.totalOcorrencias).toBe(1)
    expect(resumo.totalComLocal).toBe(0)
    expect(resumo.ranking).toEqual([])
  })
})
