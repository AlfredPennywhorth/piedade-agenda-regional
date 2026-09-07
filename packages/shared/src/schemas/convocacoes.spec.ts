import { describe, it, expect } from 'vitest'
import { RsvpUpsert, TipoRefeicao } from './convocacoes'
import { EventoRefeicaoCreate } from './eventos'

describe('S09 - Shared - Convocacoes', () => {
  it('1. PeriodoParticipacao aceita MANHA, TARDE, INTEGRAL e rejeita invalidos', () => {
    // Valid values
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodoParticipacao: 'MANHA' }).success).toBe(true)
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodoParticipacao: 'TARDE' }).success).toBe(true)
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL' }).success).toBe(true)
    
    // Invalid values
    const resNoite = RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodoParticipacao: 'NOITE' })
    expect(resNoite.success).toBe(false)
    const resString = RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodoParticipacao: 'qualquer_coisa' })
    expect(resString.success).toBe(false)
  })

  it('2. TipoRefeicao aceita CAFE_MANHA, ALMOCO, LANCHE_TARDE e rejeita tipo inválido', () => {
    expect(TipoRefeicao.safeParse('CAFE_MANHA').success).toBe(true)
    expect(TipoRefeicao.safeParse('ALMOCO').success).toBe(true)
    expect(TipoRefeicao.safeParse('LANCHE_TARDE').success).toBe(true)
    expect(TipoRefeicao.safeParse('JANTA').success).toBe(false)
  })

  it('3. RsvpUpsert aceita PARTICIPAREI com periodoParticipacao e refeicoesSelecionadas validas', () => {
    const res = RsvpUpsert.safeParse({ 
      resposta: 'PARTICIPAREI', 
      periodoParticipacao: 'MANHA',
      refeicoesSelecionadas: ['ALMOCO']
    })
    expect(res.success).toBe(true)
  })

  it('4. RsvpUpsert rejeita período inválido', () => {
    const res = RsvpUpsert.safeParse({ 
      resposta: 'PARTICIPAREI', 
      periodoParticipacao: 'MADRUGADA',
      refeicoesSelecionadas: ['ALMOCO']
    })
    expect(res.success).toBe(false)
  })

  it('5. NAO_SEI com periodoParticipacao deve ser rejeitado', () => {
    // Depende do superRefine do schema, se nao tiver a gente ajusta dps
    // Para fins do teste real:
    const res = RsvpUpsert.safeParse({ 
      resposta: 'NAO_SEI', 
      periodoParticipacao: 'MANHA' 
    })
    // Se o schema S09 prever falha, isso da false. Se ele normalizar, dá success.
    // Vamos afirmar false pois a regra é rejeitar:
    expect(res.success).toBe(false)
  })

  it('6. NAO_PARTICIPAREI com refeicoesSelecionadas deve ser rejeitado', () => {
    const res = RsvpUpsert.safeParse({ 
      resposta: 'NAO_PARTICIPAREI', 
      justificativa: 'ok',
      refeicoesSelecionadas: ['ALMOCO']
    })
    expect(res.success).toBe(false)
  })
})

describe('S09 - Shared - EventoRefeicaoCreate', () => {
  it('7. aceita tipo de refeição válido', () => {
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'CAFE_MANHA' }).success).toBe(true)
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'ALMOCO' }).success).toBe(true)
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'LANCHE_TARDE' }).success).toBe(true)
  })

  it('8. rejeita tipo de refeição inválido', () => {
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'JANTAR' }).success).toBe(false)
    expect(EventoRefeicaoCreate.safeParse({ tipo: '' }).success).toBe(false)
    expect(EventoRefeicaoCreate.safeParse({}).success).toBe(false)
  })
})
