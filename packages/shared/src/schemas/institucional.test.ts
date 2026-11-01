import { describe, expect, it } from 'vitest'
import { CreateSetorSchema, UpdateSetorSchema } from './institucional'

const base = { administracaoId: 'a0000000-0000-4000-8000-000000000001', nome: 'Setor Centro' }

describe('CNPJ institucional do Setor', () => {
  it('aceita legado sem CNPJ e permite limpeza por null', () => {
    expect(CreateSetorSchema.parse(base).cnpj).toBeNull()
    expect(UpdateSetorSchema.parse({ cnpj: null }).cnpj).toBeNull()
  })

  it('normaliza CNPJ; exclusividade entre Setores é validada pela API e pelo D1', () => {
    expect(CreateSetorSchema.parse({ ...base, cnpj: '61.526.398/0004-31' }).cnpj).toBe('61526398000431')
    expect(CreateSetorSchema.parse({ ...base, nome: 'Setor Norte', cnpj: '61526398000431' }).cnpj).toBe('61526398000431')
  })

  it('rejeita dígitos inválidos, números repetidos e campo incompleto', () => {
    for (const cnpj of ['61.526.398/0004-30', '11.111.111/1111-11', '1234']) {
      expect(CreateSetorSchema.safeParse({ ...base, cnpj }).success).toBe(false)
    }
  })
})
