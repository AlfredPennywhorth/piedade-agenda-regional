import { describe, it } from 'vitest'

describe('MVP-AGENDA-01 — governança de Agenda pendente', () => {
  it.todo('usuário comum autenticado não pode criar evento')
  it.todo('GESTOR_AGENDA pode criar evento somente dentro do próprio escopo')
  it.todo('GESTOR_AGENDA recebe 403 ao criar evento em outro escopo')
  it.todo('usuário comum não pode alterar evento de outro organizador/escopo')
  it.todo('GESTOR_AGENDA pode criar e editar convocação somente no próprio escopo')
  it.todo('usuário comum não pode publicar convocação')
  it.todo('GESTOR_AGENDA recebe 403 ao publicar convocação fora do próprio escopo')
  it.todo('Master mantém governança global de contingência conforme baseline')
})
