import { describe, expect, it } from 'vitest'
import {
  eMasterSistema,
  podeAdministrarRegional,
  regionaisAdministradas,
  type ContextoPermissoes,
} from '../security/permissoes'

function contexto(acessosAtivos: ContextoPermissoes['acessosAtivos']): ContextoPermissoes {
  return {
    membroId: 'membro-teste',
    contaAcessoId: 'conta-teste',
    acessosAtivos,
    vinculosAtivos: [],
  }
}

describe('Autorização administrativa por Regional — ACC-07', () => {
  it('reconhece Master somente quando o perfil é global', () => {
    expect(
      eMasterSistema(
        contexto([
          {
            id: 'a1',
            perfilCodigo: 'MASTER_SISTEMA',
            escopoTipo: 'GLOBAL',
            escopoId: null,
          },
        ])
      )
    ).toBe(true)

    expect(
      eMasterSistema(
        contexto([
          {
            id: 'a2',
            perfilCodigo: 'MASTER_SISTEMA',
            escopoTipo: 'REGIONAL',
            escopoId: 'regional-1',
          },
        ])
      )
    ).toBe(false)
  })

  it('lista somente Regionais administradas explicitamente', () => {
    const regionais = regionaisAdministradas(
      contexto([
        {
          id: 'a1',
          perfilCodigo: 'ADMINISTRADOR_SISTEMA',
          escopoTipo: 'REGIONAL',
          escopoId: 'regional-1',
        },
        {
          id: 'a2',
          perfilCodigo: 'GESTOR_AGENDA',
          escopoTipo: 'REGIONAL',
          escopoId: 'regional-2',
        },
        {
          id: 'a3',
          perfilCodigo: 'ADMINISTRADOR_SISTEMA',
          escopoTipo: 'REGIONAL',
          escopoId: 'regional-3',
        },
      ])
    )

    expect([...regionais].sort()).toEqual(['regional-1', 'regional-3'])
  })

  it('Master administra qualquer Regional', () => {
    const ctx = contexto([
      {
        id: 'master',
        perfilCodigo: 'MASTER_SISTEMA',
        escopoTipo: 'GLOBAL',
        escopoId: null,
      },
    ])

    expect(podeAdministrarRegional(ctx, 'regional-qualquer')).toBe(true)
  })

  it('Administrador administra somente a Regional atribuída', () => {
    const ctx = contexto([
      {
        id: 'admin',
        perfilCodigo: 'ADMINISTRADOR_SISTEMA',
        escopoTipo: 'REGIONAL',
        escopoId: 'regional-1',
      },
    ])

    expect(podeAdministrarRegional(ctx, 'regional-1')).toBe(true)
    expect(podeAdministrarRegional(ctx, 'regional-2')).toBe(false)
  })

  it('usuário comum não recebe capacidade administrativa por vínculo funcional', () => {
    const ctx = contexto([
      {
        id: 'usuario',
        perfilCodigo: 'USUARIO_COMUM',
        escopoTipo: 'CASA',
        escopoId: 'casa-1',
      },
    ])
    ctx.vinculosAtivos.push({
      funcaoId: 'responsavel-casa',
      regionalId: 'regional-1',
      administracaoId: 'administracao-1',
      setorId: 'setor-1',
      casaId: 'casa-1',
      grupoTrabalhoId: null,
    })

    expect(podeAdministrarRegional(ctx, 'regional-1')).toBe(false)
  })
})
