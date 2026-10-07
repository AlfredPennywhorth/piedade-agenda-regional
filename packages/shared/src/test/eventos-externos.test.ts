import { describe, expect, it } from 'vitest'
import { EventoCreate } from '../schemas/eventos'

const base = {
  titulo: 'Atendimento externo',
  modalidade: 'PRESENCIAL' as const,
  inicioEm: '2030-01-10T13:00:00.000Z',
  fimEm: '2030-01-10T14:00:00.000Z',
}

describe('Eventos externos', () => {
  it('aceita evento Nacional próprio sem Casa/Local da Regional', () => {
    const parsed = EventoCreate.safeParse({
      ...base,
      pessoal: true,
      abrangencia: 'NACIONAL',
      destinoUf: 'MG',
      destinoCidadeLocal: 'Belo Horizonte — atendimento',
    })

    expect(parsed.success).toBe(true)
  })

  it('aceita evento Internacional com país ISO e cidade/local', () => {
    const parsed = EventoCreate.safeParse({
      ...base,
      abrangencia: 'INTERNACIONAL',
      destinoPaisCodigo: 'PT',
      destinoCidadeLocal: 'Lisboa — atendimento',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejeita Nacional sem UF ou cidade/local', () => {
    const semUf = EventoCreate.safeParse({
      ...base,
      abrangencia: 'NACIONAL',
      destinoCidadeLocal: 'Belo Horizonte',
    })
    const semCidade = EventoCreate.safeParse({
      ...base,
      abrangencia: 'NACIONAL',
      destinoUf: 'MG',
    })

    expect(semUf.success).toBe(false)
    expect(semCidade.success).toBe(false)
  })

  it('rejeita Internacional sem país e código fora do catálogo ISO', () => {
    const semPais = EventoCreate.safeParse({
      ...base,
      abrangencia: 'INTERNACIONAL',
      destinoCidadeLocal: 'Lisboa',
    })
    const paisInvalido = EventoCreate.safeParse({
      ...base,
      abrangencia: 'INTERNACIONAL',
      destinoPaisCodigo: 'ZZ',
      destinoCidadeLocal: 'Cidade teste',
    })

    expect(semPais.success).toBe(false)
    expect(paisInvalido.success).toBe(false)
  })

  it('rejeita escopo ou Local territorial em evento externo', () => {
    const comCasa = EventoCreate.safeParse({
      ...base,
      abrangencia: 'NACIONAL',
      destinoUf: 'MG',
      destinoCidadeLocal: 'Belo Horizonte',
      casaId: '77777777-7777-4777-8777-777777777777',
    })
    const comLocal = EventoCreate.safeParse({
      ...base,
      abrangencia: 'INTERNACIONAL',
      destinoPaisCodigo: 'US',
      destinoCidadeLocal: 'Miami',
      localId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })

    expect(comCasa.success).toBe(false)
    expect(comLocal.success).toBe(false)
  })

  it('preserva validação territorial existente', () => {
    const online = EventoCreate.safeParse({
      titulo: 'Evento territorial',
      modalidade: 'ONLINE',
      inicioEm: '2030-01-10T13:00:00.000Z',
      fimEm: '2030-01-10T14:00:00.000Z',
      urlOnline: 'https://example.com/reuniao',
      regionalId: '11111111-1111-4111-8111-111111111111',
    })
    const presencialSemLocal = EventoCreate.safeParse({
      ...base,
      regionalId: '11111111-1111-4111-8111-111111111111',
    })

    expect(online.success).toBe(true)
    expect(presencialSemLocal.success).toBe(false)
  })
})
