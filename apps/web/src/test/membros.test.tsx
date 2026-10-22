import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
      if (endpoint.startsWith('/membros/paginados?')) {
        const params = new URLSearchParams(endpoint.split('?')[1])
        const busca = (params.get('busca') || '').toLocaleLowerCase('pt-BR')
        const setorId = params.get('setorId')
        const pagina = Number(params.get('pagina') || 1)
        const limite = Number(params.get('limite') || 50)
        const filtrados = membros.filter(membro => {
          const casa = mockCasas.find(c => c.id === membro.casaId)
          if (setorId && !mockSetores.some(s => s.id === setorId && s.id === casa?.setorId)) return false
          return !busca || membro.nome.toLocaleLowerCase('pt-BR').includes(busca)
            || membro.codigoCarteirinha?.toLocaleLowerCase('pt-BR').includes(busca)
            || (casa?.nome || '').toLocaleLowerCase('pt-BR').includes(busca)
        })
        return { itens: filtrados.slice((pagina - 1) * limite, pagina * limite), total: filtrados.length,
          totalPaginas: Math.max(1, Math.ceil(filtrados.length / limite)) }
      }
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
    const { container } = render(<MembrosView />)

    expect(await screen.findByText('João da Silva')).toBeInTheDocument()
    expect(container.querySelector('.master-table-scroll')).toBeInTheDocument()
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
    await waitFor(() => expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument())
    expect(screen.getByText('1 membros encontrados — exibindo 1 nesta página')).toBeInTheDocument()
  })

  it('pagina listas extensas e mantém a pesquisa sobre todos os membros', async () => {
    const lista = Array.from({ length: 51 }, (_, index) => ({
      ...mockMembros[0], id: 'membro-' + index, nome: 'Membro ' + String(index).padStart(3, '0'),
    }))
    mockEstrutura(lista)
    render(<MembrosView />)
    await screen.findByText('Membro 000')
    expect(screen.getByText('Membro 049')).toBeInTheDocument()
    expect(screen.queryByText('Membro 050')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(await screen.findByText('Membro 050')).toBeInTheDocument()
    expect(screen.queryByText('Membro 000')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Buscar membro ou Casa/i), { target: { value: 'Membro 000' } })
    expect(await screen.findByText('Membro 000')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Próxima' })).not.toBeInTheDocument())
  })

  it('3. Vazio: exibe estado vazio sem registros', async () => {
    mockEstrutura([])
    render(<MembrosView />)

    expect(await screen.findByText('Nenhum membro encontrado.')).toBeInTheDocument()
  })

  it('4. Criar manual: usa hierarquia territorial e cadastra membro', async () => {
    mockEstrutura([])
    const lista: typeof mockMembros = []
    mockEstrutura(lista)
    vi.mocked(apiClient.postWithAuth).mockImplementation(async () => {
      lista.push({ ...mockMembros[0], nome: 'Pedro Henrique' })
      return {}
    })

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
    expect(await screen.findByText('Pedro Henrique')).toBeInTheDocument()
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
    const lista = [{ ...mockMembros[0] }]
    mockEstrutura(lista)
    vi.mocked(apiClient.patchWithAuth).mockImplementation(async () => {
      lista[0].nome = 'João da Silva Silva'
      lista[0].ativo = false
      return {}
    })

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
    expect(await screen.findByText('João da Silva Silva')).toBeInTheDocument()
    expect(screen.queryByText('João da Silva')).not.toBeInTheDocument()
  })

  it('7. Pré-cadastro: diferencia homônimos com RRM, Administração e ordenação', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/membros/paginados?')) return { itens: [], total: 0, totalPaginas: 1 }
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
      if (endpoint.startsWith('/membros/paginados?')) return { itens: [], total: 0, totalPaginas: 1 }
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
    await waitFor(() => expect(resolveAntiga).toBeDefined())

    fireEvent.change(busca, { target: { value: 'Maria' } })
    expect(await screen.findByText('Maria Atual')).toBeInTheDocument()

    await act(async () => {
      resolveAntiga?.({ data: [{ id: 'pre-1', nome: 'João Antigo', vinculado: false }], meta: {} })
    })

    expect(screen.queryByText('João Antigo')).not.toBeInTheDocument()
    expect(screen.getByText('Maria Atual')).toBeInTheDocument()
  })

  it('9. Excluir: remove cadastro indevido após confirmação', async () => {
    mockEstrutura([mockMembros[0]])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let excluido = false
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string, options?: RequestInit) => {
      if (endpoint === `/membros/${MEMBRO_1_ID}` && options?.method === 'DELETE') {
        excluido = true
        return { message: 'Membro excluído', id: MEMBRO_1_ID } as any
      }
      if (endpoint.startsWith('/membros/paginados?')) return { itens: excluido ? [] : [mockMembros[0]], total: excluido ? 0 : 1, totalPaginas: 1 } as any
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
    await screen.findByText('Nenhum membro encontrado.')
    expect(screen.queryByText('João da Silva')).not.toBeInTheDocument()
  })

  it('corrige a página após excluir o último membro e recarrega a página válida', async () => {
    const lista = Array.from({ length: 51 }, (_, i) => ({ ...mockMembros[0], id: `m-${i}`, nome: `Pessoa ${i}` }))
    mockEstrutura(lista)
    const buscar = vi.mocked(apiClient.fetchWithAuth).getMockImplementation()!
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint, options) => {
      if (options?.method === 'DELETE') {
        lista.pop()
        return {}
      }
      return buscar(endpoint, options)
    })
    render(<MembrosView />)
    await screen.findByText('Pessoa 0')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await screen.findByText('Pessoa 50')
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    await screen.findByText('Pessoa 0')
    expect(screen.queryByText('Pessoa 50')).not.toBeInTheDocument()
    expect(screen.getByText('50 membros encontrados — exibindo 50 nesta página')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Páginas de membros' })).not.toBeInTheDocument()
  })

  it('ignora resposta obsoleta da lista paginada, inclusive sua página inválida', async () => {
    mockEstrutura()
    const buscar = vi.mocked(apiClient.fetchWithAuth).getMockImplementation()!
    let responder: ((value: any) => void) | undefined
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint, options) => {
      if (endpoint.includes('busca=Antiga')) return new Promise(resolve => { responder = resolve })
      return buscar(endpoint, options)
    })
    render(<MembrosView />)
    await screen.findByText('João da Silva')
    const busca = screen.getByLabelText(/Buscar membro ou Casa/i)
    fireEvent.change(busca, { target: { value: 'Antiga' } })
    await waitFor(() => expect(responder).toBeDefined())
    fireEvent.change(busca, { target: { value: 'Maria' } })
    await waitFor(() => expect(screen.queryByText('João da Silva')).not.toBeInTheDocument())
    await act(async () => {
      responder!({ itens: [{ ...mockMembros[0], nome: 'Resposta Antiga' }], total: 0, totalPaginas: 0 })
    })
    await waitFor(() => expect(screen.getByText('1 membros encontrados — exibindo 1 nesta página')).toBeInTheDocument())
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.queryByText('Resposta Antiga')).not.toBeInTheDocument()
  })

  it('recarrega os filtros atuais quando uma exclusão termina após mudar a pesquisa', async () => {
    const lista = [...mockMembros, { ...mockMembros[0], id: 'terceiro', nome: 'Pedro Atual' }]
    mockEstrutura(lista)
    const buscar = vi.mocked(apiClient.fetchWithAuth).getMockImplementation()!
    let concluir: (() => void) | undefined
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint, options) => {
      if (options?.method === 'DELETE') {
        await new Promise<void>(resolve => { concluir = resolve })
        lista.splice(0, 1)
        return {}
      }
      return buscar(endpoint, options)
    })
    render(<MembrosView />)
    await screen.findByText('João da Silva')
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0])
    await waitFor(() => expect(concluir).toBeDefined())
    fireEvent.change(screen.getByLabelText(/Buscar membro ou Casa/i), { target: { value: 'Maria' } })
    await waitFor(() => expect(screen.queryByText('Pedro Atual')).not.toBeInTheDocument())
    await act(async () => { concluir!() })
    await screen.findByText('Membro excluído com sucesso.')
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.queryByText('Pedro Atual')).not.toBeInTheDocument()
    expect(screen.getByText('1 membros encontrados — exibindo 1 nesta página')).toBeInTheDocument()
  })

  it.each(['/casas', '/setores', '/administracoes', '/regionais'])(
    'preserva erro de %s após a lista paginada carregar e ser pesquisada', async endpointComFalha => {
      mockEstrutura()
      const buscar = vi.mocked(apiClient.fetchWithAuth).getMockImplementation()!
      let carregarLista: ((value: unknown) => void) | undefined
      let primeiraConsulta = true
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint, options) => {
        if (endpoint === endpointComFalha) throw new Error('Estrutura territorial indisponível')
        if (endpoint.startsWith('/membros/paginados?') && primeiraConsulta) {
          primeiraConsulta = false
          return new Promise(resolve => { carregarLista = resolve })
        }
        return buscar(endpoint, options)
      })
      render(<MembrosView />)
      expect(await screen.findByRole('alert')).toHaveTextContent('Estrutura territorial indisponível')
      await waitFor(() => expect(carregarLista).toBeDefined())
      await act(async () => {
        carregarLista!({ itens: mockMembros, total: 2, totalPaginas: 1 })
      })
      expect(await screen.findByText('João da Silva')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('Estrutura territorial indisponível')
      fireEvent.change(screen.getByLabelText(/Buscar membro ou Casa/i), { target: { value: 'Maria' } })
      await waitFor(() => expect(screen.queryByText('João da Silva')).not.toBeInTheDocument())
      expect(screen.getByRole('alert')).toHaveTextContent('Estrutura territorial indisponível')
      fireEvent.click(screen.getByRole('button', { name: 'Fechar erro de território' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    }
  )

  it('recupera o erro da lista sem apagar o erro territorial', async () => {
    mockEstrutura()
    const buscar = vi.mocked(apiClient.fetchWithAuth).getMockImplementation()!
    let falharLista = true
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint, options) => {
      if (endpoint === '/casas') throw new Error('Falha territorial persistente')
      if (endpoint.startsWith('/membros/paginados?') && falharLista) throw new Error('Falha na lista')
      return buscar(endpoint, options)
    })
    render(<MembrosView />)
    await screen.findByText('Falha na lista')
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    falharLista = false
    fireEvent.change(screen.getByLabelText(/Buscar membro ou Casa/i), { target: { value: 'Maria' } })
    await screen.findByText('Maria Souza')
    expect(screen.queryByText('Falha na lista')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Falha territorial persistente')
  })

})
