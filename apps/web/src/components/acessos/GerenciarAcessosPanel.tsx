import { useEffect, useMemo, useState } from 'react'
import { ApiError, fetchWithAuth, postWithAuth } from '../../api/apiClient'

type Acesso = {
  id: string
  perfilCodigo: string
  escopoTipo: string
  escopoId: string | null
}

type Unidade = {
  id: string
  nome: string
}

type Props = {
  contaAcessoId: string
  nomePessoa: string
  acessos: Acesso[]
  onAtualizado: () => Promise<void> | void
  onFechar: () => void
}

const PERFIS = [
  ['ADMINISTRADOR_SISTEMA', 'Administrador do Sistema'],
  ['GESTOR_AGENDA', 'Gestor de Agenda'],
  ['OPERADOR_PORTARIA_PERMANENTE', 'Operador de Portaria'],
  ['GESTOR_RELATORIOS', 'Gestor de Relatórios'],
  ['AUDITOR', 'Auditor'],
  ['USUARIO_COMUM', 'Usuário comum'],
  ['MASTER_SISTEMA', 'Master do Sistema'],
] as const

const NIVEIS = [
  ['REGIONAL', 'Regional'],
  ['ADMINISTRACAO', 'Administração'],
  ['SETOR', 'Setor'],
  ['CASA', 'Casa de Oração'],
  ['GRUPO_TRABALHO', 'Grupo de Trabalho'],
] as const

function endpointDoNivel(nivel: string) {
  if (nivel === 'REGIONAL') return '/regionais'
  if (nivel === 'ADMINISTRACAO') return '/administracoes'
  if (nivel === 'SETOR') return '/setores'
  if (nivel === 'CASA') return '/casas'
  if (nivel === 'GRUPO_TRABALHO') return '/grupos-trabalho'
  return null
}

function niveisPermitidos(perfil: string) {
  if (perfil === 'MASTER_SISTEMA') return ['GLOBAL']
  if (perfil === 'ADMINISTRADOR_SISTEMA') return ['REGIONAL']
  if (perfil === 'AUDITOR') return ['REGIONAL', 'ADMINISTRACAO']
  return NIVEIS.map(([codigo]) => codigo)
}

export function GerenciarAcessosPanel({
  contaAcessoId,
  nomePessoa,
  acessos,
  onAtualizado,
  onFechar,
}: Props) {
  const [perfil, setPerfil] = useState('ADMINISTRADOR_SISTEMA')
  const [nivel, setNivel] = useState('REGIONAL')
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [escopoId, setEscopoId] = useState('')
  const [carregandoUnidades, setCarregandoUnidades] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const permitidos = useMemo(() => niveisPermitidos(perfil), [perfil])

  useEffect(() => {
    const proximoNivel = permitidos[0]
    if (proximoNivel !== nivel) setNivel(proximoNivel)
  }, [permitidos, nivel])

  useEffect(() => {
    setErro(null)
    setMensagem(null)
    setEscopoId('')

    if (nivel === 'GLOBAL') {
      setUnidades([])
      return
    }

    const endpoint = endpointDoNivel(nivel)
    if (!endpoint) return

    setCarregandoUnidades(true)
    void fetchWithAuth<Unidade[]>(endpoint)
      .then(data => {
        const ordenadas = [...data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        setUnidades(ordenadas)
      })
      .catch(error => {
        setUnidades([])
        setErro(error instanceof ApiError ? error.message : 'Não foi possível carregar os escopos.')
      })
      .finally(() => setCarregandoUnidades(false))
  }, [nivel])

  const conceder = async () => {
    if (nivel !== 'GLOBAL' && !escopoId) {
      setErro('Selecione a unidade territorial.')
      return
    }

    setProcessando(true)
    setErro(null)
    setMensagem(null)
    try {
      await postWithAuth('/admin/acessos', {
        contaAcessoId,
        perfilCodigo: perfil,
        escopoTipo: nivel,
        escopoId: nivel === 'GLOBAL' ? null : escopoId,
      })
      setMensagem('Acesso atribuído com sucesso.')
      await onAtualizado()
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível atribuir o acesso.')
    } finally {
      setProcessando(false)
    }
  }

  const revogar = async (acesso: Acesso) => {
    if (!window.confirm(`Revogar o acesso ${acesso.perfilCodigo} de ${nomePessoa}?`)) return

    setProcessando(true)
    setErro(null)
    setMensagem(null)
    try {
      await fetchWithAuth(`/admin/acessos/${acesso.id}`, { method: 'DELETE' })
      setMensagem('Acesso revogado com sucesso.')
      await onAtualizado()
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível revogar o acesso.')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900">Gerenciar acessos</h4>
          <p className="text-xs text-slate-600">
            Atribua perfil e escopo institucional para {nomePessoa}.
          </p>
        </div>
        <button type="button" onClick={onFechar} className="text-xs font-semibold text-slate-600 hover:text-slate-900">
          Fechar
        </button>
      </div>

      {mensagem && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{mensagem}</div>}
      {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{erro}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-700">
          Perfil
          <select
            aria-label="Perfil de acesso"
            value={perfil}
            onChange={e => setPerfil(e.target.value)}
            disabled={processando}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {PERFIS.map(([codigo, rotulo]) => <option key={codigo} value={codigo}>{rotulo}</option>)}
          </select>
        </label>

        <label className="text-xs font-semibold text-slate-700">
          Nível territorial
          <select
            aria-label="Nível territorial"
            value={nivel}
            onChange={e => setNivel(e.target.value)}
            disabled={processando || perfil === 'MASTER_SISTEMA'}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {permitidos.map(codigo => (
              <option key={codigo} value={codigo}>
                {codigo === 'GLOBAL' ? 'Global' : NIVEIS.find(([c]) => c === codigo)?.[1] ?? codigo}
              </option>
            ))}
          </select>
        </label>

        {nivel === 'GLOBAL' ? (
          <div className="text-xs font-semibold text-slate-700">
            Escopo
            <div className="mt-1 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-normal text-slate-600">
              Global
            </div>
          </div>
        ) : (
          <label className="text-xs font-semibold text-slate-700">
            Unidade
            <select
              aria-label="Unidade territorial"
              value={escopoId}
              onChange={e => setEscopoId(e.target.value)}
              disabled={processando || carregandoUnidades}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{carregandoUnidades ? 'Carregando...' : 'Selecione...'}</option>
              {unidades.map(unidade => <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void conceder()}
          disabled={processando || carregandoUnidades}
          className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {processando ? 'Processando...' : 'Atribuir acesso'}
        </button>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <p className="mb-2 text-xs font-semibold text-slate-700">Acessos atuais</p>
        {acessos.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum acesso técnico atribuído.</p>
        ) : (
          <ul className="space-y-2">
            {acessos.map(acesso => (
              <li key={acesso.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="text-xs text-slate-700">{acesso.perfilCodigo} · {acesso.escopoTipo}</span>
                <button
                  type="button"
                  onClick={() => void revogar(acesso)}
                  disabled={processando}
                  className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-50"
                >
                  Revogar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
