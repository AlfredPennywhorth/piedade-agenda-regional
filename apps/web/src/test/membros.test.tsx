import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MembrosView } from '../components/membros/MembrosView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', async importOriginal => {
  const actual = await importOriginal<typeof import('../api/apiClient')>()
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
    postWithAuth: vi.fn(),
    patchWithAuth: vi.fn(),
  }
})

describe('S02-A — MembrosView (Diretório de Membros Frontend)', () => {
  const REGIONAL_ID = '11111111-1111-4111-8111-111111111111'
  const ADM_ID = '22222222-2222-4222-8222-222222222222'
  const SETOR_1_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const SETOR_2_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const CASA_1_ID = '33333333-3333-4333-8333-333333333333'
  const CASA_2_ID = '44444444-4444-4444-8444-444444444444'
  const MEMBRO_1_ID = '55555555-5555-4555-8555-555555555555'
  const MEMBRO_2_ID = '66666666-6666-4666-8666-666666666666'

  const mockRegionais = [{ id: REGIONAL_ID, nome: 'Regional São Paulo', ativo: true }]
  const mockAdministracoes = [{ id: ADM_ID, regionalId: REGIONAL_ID, nome: 'Administração Exemplo', ativo: true }]
  const mockSetores = [
    { id: SETOR_1_ID, administracaoId: ADM_ID, nome: 'Osasco', ativo: true },
    { id: SETOR_2_ID, administracaoId: ADM_ID, nome: 'Jundiaí', ativo: true },
  ]
  const mockCasas = [
    { id: CASA_1_ID, setorId: SETOR_1_ID, nome: 'Central de Osasco', codigo: 'C-OSC-01', ativo: true },
    { id: CASA_2_ID, setorId: SETOR_2_ID, nome: 'Jardim Samambaia', codigo: 'C-JND-02', ativo: true },
  ]
  const mockMembros = [
    {
      id: MEMBRO_1_ID,
      casaId: CASA_1_ID,
      nome: 'João da Silva',
      dataOrdenacao: '1990-05-10',
      codigoCarteirinha: 'CARTEIRA-001',
      celular: '11988887777',
      ativo: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: MEMBRO_2_ID,
      casaId: CASA_2_ID,
      nome: 'Maria Souza',
      dataOrdenacao: '2000-06-15',
      codigoCarteirinha: 'CARTEIRA-002',
      celular: null,
      ativo: false,
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ]

  const mockEstrutura = (membros = mockMembros) => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return membros
      if (endpoint === '/casas') return mockCasas
      if (endpoint === '/setores') return mockSetores
      if (endpoint === '/administracoes') return mockAdministracoes
      if (endpoint === '/regionais') return mockRegionais
      if (endpoint === `/membros/${MEMBRO_1_ID}`) return mockMembros[0]
      throw new Error(`Not found: ${endpoint}`)
    })
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Listar: carrega membros e Casas associadas', async () => {
    mockEstrutura()
    render(<MembrosView />)

    expect(await screen.findByText('João da Silva')).toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.getByText('Central de Osasco')).toBeInTheDocument()
    expect(screen.getByText('Jardim Samambaia')).toBeInTheDocument()
  })

  it('2. Filtrar: filtra membros por Setor', async () => {
    mockEstrutura()
    render(<MembrosView />)

    await screen.findByText('João da Silva')
    fireEvent.change(screen.getByLabelText(/Filtrar membros por Setor/i), {
      target: { value: SETOR_1_ID },
    })

    expect(screen.getByText('João da Silva')).toBeInTheDocument()
    expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument()
    expect(screen.getByText('Exibindo 1 de 2 membros')).toBeInTheDocument()
  })

  it('3. Vazio: exibe estado vazio sem registros', async () => {
    mockEstrutura([])
    render(<MembrosView />)

    expect(await screen.findByText('Nenhum membro encontrado.')).toBeInTheDocument()
  })

  it('4. Criar manual: usa hierarquia territorial e cadastra membro', async () => {
    mockEstrutura([])
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({})

    render(<MembrosView />)
    await screen.findByText('Nenhum membro encontrado.')

    fireEvent.click(screen.getByText('+ Cadastrar Membro'))
    fireEvent.click(screen.getByText('Novo membro manual'))

    expect((screen.getByLabelText('Regional') as HTMLSelectElement).value).toBe('')

    fireEvent.change(screen.getByLabelText('Regional'), { target: { value: REGIONAL_ID } })
    fireEvent.change(screen.getByLabelText('Administração'), { target: { value: ADM_ID } })
    fireEvent.change(screen.getByLabelText('Setor'), { target: { value: SETOR_1_ID } })
    fireEvent.change(screen.getByLabelText(/^Casa de Oração \*/i), { target: { value: CASA_1_ID } })
    fireEvent.change(screen.getByLabelText(/Nome Completo \*/i), { target: { value: 'Pedro Henrique' } })
    fireEvent.change(screen.getByLabelText(/Código da Carteirinha \*/i), { target: { value: 'CARTEIRA-003' } })
    fireEvent.change(screen.getByLabelText(/Data de Ordenação \*/i), { target: { value: '2010-01-20' } })

    fireEvent.click(screen.getByText('Salvar Membro'))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/membros', {
        casaId: CASA_1_ID,
        nome: 'Pedro Henrique',
        dataOrdenacao: '2010-01-20',
        codigoCarteirinha: 'CARTEIRA-003',
        celular: null,
        ativo: true,
      })
    })
  })

  it('5. Validação: mostra feedback de nome e celular inválidos', async () => {
    mockEstrutura([])
    render(<MembrosView />)
    await screen.findByText('Nenhum membro encontrado.')

    fireEvent.click(screen.getByText('+ Cadastrar Membro'))
    fireEvent.click(screen.getByText('Novo membro manual'))

    fireEvent.change(screen.getByLabelText('Regional'), { target: { value: REGIONAL_ID } })
    fireEvent.change(screen.getByLabelText('Administração'), { target: { value: ADM_ID } })
    fireEvent.change(screen.getByLabelText('Setor'), { target: { value: SETOR_1_ID } })
    fireEvent.change(screen.getByLabelText(/^Casa de Oração \*/i), { target: { value: CASA_1_ID } })
    fireEvent.change(screen.getByLabelText(/Nome Completo \*/i), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText(/Código da Carteirinha \*/i), { target: { value: 'CARTEIRA-VALIDACAO' } })
    fireEvent.change(screen.getByLabelText(/Data de Ordenação \*/i), { target: { value: '2010-01-20' } })
    fireEvent.change(screen.getByLabelText(/Celular/i), { target: { value: '119' } })

    fireEvent.click(screen.getByText('Salvar Membro'))

    expect(await screen.findByText('Nome deve ter no mínimo 2 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Formato de celular inválido')).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('6. Editar: carrega hierarquia e atualiza membro', async () => {
    mockEstrutura([mockMembros[0]])
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue({})

    render(<MembrosView />)
    fireEvent.click((await screen.findAllByText('Editar'))[0])

    expect(await screen.findByText('Editar Membro')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome Completo \*/i)
    await waitFor(() => expect((inputNome as HTMLInputElement).value).toBe('João da Silva'))

    fireEvent.change(inputNome, { target: { value: 'João da Silva Silva' } })
    fireEvent.click(screen.getByLabelText(/Membro Ativo/i))
    fireEvent.click(screen.getByText('Atualizar Membro'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/membros/${MEMBRO_1_ID}`, {
        casaId: CASA_1_ID,
        nome: 'João da Silva Silva',
        dataOrdenacao: '1990-05-10',
        codigoCarteirinha: 'CARTEIRA-001',
        celular: '11988887777',
        ativo: false,
      })
    })
  })

  it('7. Pré-cadastro: diferencia homônimos com RRM, Administração e ordenação', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return []
      if (endpoint === '/casas') return mockCasas
      if (endpoint === '/setores') return mockSetores
      if (endpoint === '/administracoes') return mockAdministracoes
      if (endpoint === '/regionais') return mockRegionais
      if (endpoint.includes('/admin/pre-cadastros-ministeriais?')) {
        return {
          data: [
            {
              id: 'pre-joao-1',
              nome: 'João da Silva',
              ministerio: 'Diácono',
              rrm: 'RRM-001',
              regionalId: REGIONAL_ID,
              administracaoOrigem: 'Administração Centro',
              localidadeOrigem: 'Brás',
              codigoCasaReferencia: 'BRAS-01',
              casaId: null,
              dataOrdenacao: '2001-05-10',
              statusOrigem: null,
              membroId: null,
              vinculado: false,
            },
            {
              id: 'pre-joao-2',
              nome: 'João da Silva',
              ministerio: 'Diácono',
              rrm: 'RRM-002',
              regionalId: REGIONAL_ID,
              administracaoOrigem: 'Administração Leste',
              localidadeOrigem: 'Tatuapé',
              codigoCasaReferencia: 'TAT-02',
              casaId: null,
              dataOrdenacao: '2012-08-20',
              statusOrigem: null,
              membroId: null,
              vinculado: false,
            },
          ],
          meta: { busca: 'João', limit: 20, totalRetornado: 2 },
        }
      }
      throw new Error(`Not found: ${endpoint}`)
    })

    render(<MembrosView />)
    await screen.findByText('Nenhum membro encontrado.')
    fireEvent.click(screen.getByText('+ Cadastrar Membro'))

    fireEvent.change(screen.getByLabelText(/Localizar pré-cadastro pelo nome/i), {
      target: { value: 'João' },
    })

    expect(await screen.findAllByText('João da Silva')).toHaveLength(2)
    expect(screen.getByText(/RRM: RRM-001/)).toHaveTextContent('Administração: Administração Centro')
    expect(screen.getByText(/RRM: RRM-001/)).toHaveTextContent('Ordenação: 2001-05-10')
    expect(screen.getByText(/RRM: RRM-002/)).toHaveTextContent('Administração: Administração Leste')
    expect(screen.getByText(/RRM: RRM-002/)).toHaveTextContent('Ordenação: 2012-08-20')
  })

  it('8. Pré-cadastro: ignora resposta antiga quando a busca muda', async () => {
    let resolveAntiga: ((value: any) => void) | undefined

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return []
      if (endpoint === '/casas') return mockCasas
      if (endpoint === '/setores') return mockSetores
      if (endpoint === '/administracoes') return mockAdministracoes
      if (endpoint === '/regionais') return mockRegionais
      if (endpoint.includes('busca=Jo')) {
        return await new Promise(resolve => {
          resolveAntiga = resolve
        })
      }
      if (endpoint.includes('busca=Maria')) {
        return { data: [{ id: 'pre-2', nome: 'Maria Atual', vinculado: false }], meta: {} }
      }
      throw new Error(`Not found: ${endpoint}`)
    })

    render(<MembrosView />)
    await screen.findByText('Nenhum membro encontrado.')
    fireEvent.click(screen.getByText('+ Cadastrar Membro'))

    const busca = screen.getByLabelText(/Localizar pré-cadastro pelo nome/i)
    fireEvent.change(busca, { target: { value: 'Jo' } })
    await new Promise(resolve => setTimeout(resolve, 350))

    fireEvent.change(busca, { target: { value: 'Maria' } })
    expect(await screen.findByText('Maria Atual')).toBeInTheDocument()

    resolveAntiga?.({ data: [{ id: 'pre-1', nome: 'João Antigo', vinculado: false }], meta: {} })
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(screen.queryByText('João Antigo')).not.toBeInTheDocument()
    expect(screen.getByText('Maria Atual')).toBeInTheDocument()
  })

  it('9. Excluir: remove cadastro indevido após confirmação', async () => {
    mockEstrutura([mockMembros[0]])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string, options?: RequestInit) => {
      if (endpoint === `/membros/${MEMBRO_1_ID}` && options?.method === 'DELETE') {
        return { message: 'Membro excluído', id: MEMBRO_1_ID } as any
      }
      if (endpoint === '/membros') return [mockMembros[0]] as any
      if (endpoint === '/casas') return mockCasas as any
      if (endpoint === '/setores') return mockSetores as any
      if (endpoint === '/administracoes') return mockAdministracoes as any
      if (endpoint === '/regionais') return mockRegionais as any
      throw new Error(`Not found: ${endpoint}`)
    })

    render(<MembrosView />)
    await screen.findByText('João da Silva')

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    await waitFor(() => {
      expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(
        `/membros/${MEMBRO_1_ID}`,
        { method: 'DELETE' }
      )
    })
    expect(window.confirm).toHaveBeenCalled()
  })

})
