import { describe, it, expect } from 'vitest'
import { RetificarCheckinSchema } from '../schemas/checkin'

describe('RetificarCheckinSchema', () => {
  it('aceita motivo técnico válido e retorna o valor já trimado', () => {
    const result = RetificarCheckinSchema.safeParse({ motivo: '   Bipado por engano   ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.motivo).toBe('Bipado por engano')
    }
  })

  it('rejeita string vazia/apenas espaços', () => {
    const result1 = RetificarCheckinSchema.safeParse({ motivo: '' })
    const result2 = RetificarCheckinSchema.safeParse({ motivo: '    ' })
    
    expect(result1.success).toBe(false)
    expect(result2.success).toBe(false)
  })

  it('rejeita motivo com menos de 5 caracteres', () => {
    // "Erro" tem 4 caracteres
    const result = RetificarCheckinSchema.safeParse({ motivo: 'Erro' })
    expect(result.success).toBe(false)
  })

  it('rejeita motivo com mais de 100 caracteres', () => {
    const motivoLongo = 'A'.repeat(101)
    const result = RetificarCheckinSchema.safeParse({ motivo: motivoLongo })
    expect(result.success).toBe(false)
  })

  it('rejeita campo extra, por ser strict', () => {
    const result = RetificarCheckinSchema.safeParse({ 
      motivo: 'Bipado por engano', 
      hackerField: true 
    })
    expect(result.success).toBe(false)
  })
})
