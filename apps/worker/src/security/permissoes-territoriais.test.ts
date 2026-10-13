import { describe, expect, it } from 'vitest'
import { podeGerenciarCadastroTerritorial, type ContextoPermissoes } from './permissoes'

const contexto = (
  perfilCodigo: string,
  escopoTipo: 'GLOBAL' | 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
  escopoId: string | null,
): ContextoPermissoes => ({
  membroId: 'membro-1',
  contaAcessoId: 'conta-1',
  acessosAtivos: [{ id: 'acesso-1', perfilCodigo, escopoTipo, escopoId }],
  vinculosAtivos: [],
})

const dbEscopo = (regionalId = 'regional-1', administracaoId = 'adm-1') => ({
  select: (campos: Record<string, unknown>) => ({
    from: () => ({
      innerJoin: () => ({
        innerJoin: () => ({ where: () => ({ get: async () => ({ regionalId }) }) }),
        where: () => ({ get: async () => ({ regionalId }) }),
      }),
      where: () => ({
        get: async () => Object.prototype.hasOwnProperty.call(campos, 'administracaoId')
          ? { administracaoId }
          : Object.prototype.hasOwnProperty.call(campos, 'id')
            ? { id: regionalId }
            : { regionalId },
      }),
    }),
  }),
})

describe('permissão de cadastro institucional territorial', () => {
  it('permite apenas ao Master global ignorar jurisdição', async () => {
    expect(await podeGerenciarCadastroTerritorial(null, contexto('MASTER_SISTEMA', 'GLOBAL', null), 'SETOR', 's-1')).toBe(true)
  })
  it('nega usuário sem perfil administrativo', async () => {
    expect(await podeGerenciarCadastroTerritorial(dbEscopo(), contexto('USUARIO_COMUM', 'SETOR', 's-1'), 'SETOR', 's-1')).toBe(false)
  })
  it('autoriza administrador do próprio Setor', async () => {
    expect(await podeGerenciarCadastroTerritorial(dbEscopo(), contexto('ADMINISTRADOR_SISTEMA', 'SETOR', 's-1'), 'SETOR', 's-1')).toBe(true)
  })
  it('nega Setor diferente, mesmo dentro da mesma Regional', async () => {
    expect(await podeGerenciarCadastroTerritorial(dbEscopo(), contexto('ADMINISTRADOR_SISTEMA', 'SETOR', 's-2'), 'SETOR', 's-1')).toBe(false)
  })
  it('autoriza Administração ancestral do Setor', async () => {
    expect(await podeGerenciarCadastroTerritorial(dbEscopo(), contexto('ADMINISTRADOR_SISTEMA', 'ADMINISTRACAO', 'adm-1'), 'SETOR', 's-1')).toBe(true)
  })
  it('nega Administração não ancestral', async () => {
    expect(await podeGerenciarCadastroTerritorial(dbEscopo(), contexto('ADMINISTRADOR_SISTEMA', 'ADMINISTRACAO', 'adm-2'), 'SETOR', 's-1')).toBe(false)
  })
  it('autoriza Regional ancestral', async () => {
    expect(await podeGerenciarCadastroTerritorial(dbEscopo(), contexto('ADMINISTRADOR_SISTEMA', 'REGIONAL', 'regional-1'), 'SETOR', 's-1')).toBe(true)
  })
  it('nega Regional diferente', async () => {
    expect(await podeGerenciarCadastroTerritorial(dbEscopo(), contexto('ADMINISTRADOR_SISTEMA', 'REGIONAL', 'regional-2'), 'SETOR', 's-1')).toBe(false)
  })
})
