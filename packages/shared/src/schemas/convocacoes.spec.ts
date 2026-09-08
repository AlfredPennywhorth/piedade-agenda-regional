import { describe, it, expect } from 'vitest'
import { RsvpUpsert, TipoRefeicao } from './convocacoes'
import { EventoRefeicaoCreate } from './eventos'

describe('S09 - Shared - Convocacoes', () => {
  it('1. PeriodosParticipacao aceita MANHA, TARDE, NOITE e rejeita invalidos', () => {
    // Valid values
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: ['MANHA'] }).success).toBe(true)
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: ['TARDE'] }).success).toBe(true)
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: ['NOITE'] }).success).toBe(true)
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: ['MANHA', 'TARDE'] }).success).toBe(true)
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: ['MANHA', 'NOITE'] }).success).toBe(true)
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: ['TARDE', 'NOITE'] }).success).toBe(true)
    expect(RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: ['MANHA', 'TARDE', 'NOITE'] }).success).toBe(true)
    
    // Invalid values
    const resString = RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: 'MANHA' })
    expect(resString.success).toBe(false)
    const resIntegral = RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: ['INTEGRAL'] })
    expect(resIntegral.success).toBe(false)
    const resVazio = RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI', periodosParticipacao: ['QUALQUER'] })
    expect(resVazio.success).toBe(false)
  })

  it('2. TipoRefeicao aceita CAFE_MANHA, ALMOCO, LANCHE, JANTAR e rejeita LANCHE_TARDE/JANTA', () => {
    expect(TipoRefeicao.safeParse('CAFE_MANHA').success).toBe(true)
    expect(TipoRefeicao.safeParse('ALMOCO').success).toBe(true)
    expect(TipoRefeicao.safeParse('LANCHE').success).toBe(true)
    expect(TipoRefeicao.safeParse('JANTAR').success).toBe(true)
    
    expect(TipoRefeicao.safeParse('LANCHE_TARDE').success).toBe(false)
    expect(TipoRefeicao.safeParse('JANTA').success).toBe(false)
  })

  it('3. RsvpUpsert rejeita período inválido', () => {
    const res = RsvpUpsert.safeParse({ 
      resposta: 'PARTICIPAREI', 
      periodosParticipacao: ['MADRUGADA']
    })
    expect(res.success).toBe(false)
  })

  it('4. NAO_SEI com periodosParticipacao deve ser aceito e depois limpo no worker', () => {
    const res = RsvpUpsert.safeParse({ 
      resposta: 'NAO_SEI', 
      periodosParticipacao: ['MANHA'] 
    })
    expect(res.success).toBe(true)
  })

  it('5. NAO_PARTICIPAREI com periodosParticipacao deve ser aceito e depois limpo no worker', () => {
    const res = RsvpUpsert.safeParse({ 
      resposta: 'NAO_PARTICIPAREI', 
      justificativa: 'ok',
      periodosParticipacao: ['MANHA']
    })
    expect(res.success).toBe(true)
  })

  it('6. NAO_PARTICIPAREI sem justificativa deve falhar', () => {
    const res = RsvpUpsert.safeParse({ 
      resposta: 'NAO_PARTICIPAREI'
    })
    expect(res.success).toBe(false)
  })

  it('7. NAO_PARTICIPAREI com justificativa valida deve sucesso', () => {
    const res = RsvpUpsert.safeParse({ 
      resposta: 'NAO_PARTICIPAREI',
      justificativa: 'ok'
    })
    expect(res.success).toBe(true)
  })
})

describe('S09 - Shared - EventoRefeicaoCreate', () => {
  it('8. aceita tipo de refeição válido', () => {
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'CAFE_MANHA' }).success).toBe(true)
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'ALMOCO' }).success).toBe(true)
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'LANCHE' }).success).toBe(true)
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'JANTAR' }).success).toBe(true)
  })

  it('9. rejeita tipo de refeição inválido', () => {
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'LANCHE_TARDE' }).success).toBe(false)
    expect(EventoRefeicaoCreate.safeParse({ tipo: 'JANTA' }).success).toBe(false)
    expect(EventoRefeicaoCreate.safeParse({ tipo: '' }).success).toBe(false)
    expect(EventoRefeicaoCreate.safeParse({}).success).toBe(false)
  })
})
