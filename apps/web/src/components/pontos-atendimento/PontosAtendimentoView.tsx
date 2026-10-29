import { useEffect, useState } from 'react'
import { fetchWithAuth, patchWithAuth, postWithAuth } from '../../api/apiClient'

type Ponto = { id: string; nome: string; codigo: string | null; setorId: string; ativo: boolean }
type Setor = { id: string; nome: string }
type Casa = { id: string; nome: string; setorId: string; pontoAtendimentoId?: string | null }
const vazio = { nome: '', codigo: '', setorId: '' }

export function PontosAtendimentoView() {
  const [pontos, setPontos] = useState<Ponto[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [casas, setCasas] = useState<Casa[]>([])
  const [filtro, setFiltro] = useState('')
  const [form, setForm] = useState(vazio)
  const [editando, setEditando] = useState<Ponto | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(true)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [lista, setoresLista, casasLista] = await Promise.all([
        fetchWithAuth<Ponto[]>('/pontos-atendimento'),
        fetchWithAuth<Setor[]>('/setores'),
        fetchWithAuth<Casa[]>('/casas'),
      ])
      setPontos(lista); setSetores(setoresLista); setCasas(casasLista); setErro('')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar os Pontos') }
    finally { setCarregando(false) }
  }
  useEffect(() => { void carregar() }, [])
  const selecionar = (ponto: Ponto) => {
    setEditando(ponto); setForm({ nome: ponto.nome, codigo: ponto.codigo ?? '', setorId: ponto.setorId })
    setAviso(''); setErro('')
    document.getElementById('form-ponto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvando) return
    setSalvando(true); setErro(''); setAviso('')
    try {
      const dados = { nome: form.nome.trim(), codigo: form.codigo.trim() || null, setorId: form.setorId }
      if (editando) await patchWithAuth('/pontos-atendimento/' + editando.id, dados)
      else await postWithAuth('/pontos-atendimento', dados)
      setEditando(null); setForm(vazio); await carregar()
      setAviso('Ponto de Atendimento salvo com sucesso.')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao salvar') }
    finally { setSalvando(false) }
  }
  const alterarStatus = async (ponto: Ponto) => {
    setErro(''); setAviso('')
    try {
      await patchWithAuth('/pontos-atendimento/' + ponto.id, { ativo: !ponto.ativo })
      await carregar()
      setAviso('Situação atualizada.')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao atualizar situação') }
  }
  const vincular = async (ponto: Ponto, casaId: string) => {
    if (!casaId) return
    setErro(''); setAviso('')
    try {
      await patchWithAuth('/pontos-atendimento/' + ponto.id + '/casas/' + casaId, {})
      await carregar()
      setAviso('Casa vinculada ao Ponto de Atendimento.')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao vincular Casa') }
  }
  return <section className="space-y-4 p-4 sm:p-6">
    <header className="rounded-xl bg-brand-900 p-4 text-white"><h2 className="text-xl font-bold">Pontos de Atendimento</h2><p className="text-sm text-brand-100">Organização das Casas de Oração por Setor</p></header>
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{erro}</p>}
    {aviso && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{aviso}</p>}
    <form id="form-ponto" onSubmit={salvar} className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="font-semibold">{editando ? 'Editar Ponto' : 'Novo Ponto de Atendimento'}</h3>
      <label className="block text-sm font-medium">Nome<input required maxLength={255} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="mt-1 w-full rounded-lg border p-3" /></label>
      <label className="block text-sm font-medium">Código<input maxLength={60} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} className="mt-1 w-full rounded-lg border p-3" /></label>
      <label className="block text-sm font-medium">Setor<select required value={form.setorId} onChange={e => setForm(f => ({ ...f, setorId: e.target.value }))} className="mt-1 w-full rounded-lg border p-3"><option value="">Selecione</option>{setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
      <div className="flex flex-wrap gap-2"><button disabled={salvando} className="rounded-lg bg-brand-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>{editando && <button type="button" className="rounded-lg border px-4 py-2" onClick={() => { setEditando(null); setForm(vazio) }}>Cancelar edição</button>}</div>
    </form>
    <label className="block text-sm font-medium">Filtrar por Setor<select value={filtro} onChange={e => setFiltro(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-3"><option value="">Todos os Setores</option>{setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
    {carregando && <p role="status">Carregando...</p>}
    <div className="space-y-3">{pontos.filter(p => !filtro || p.setorId === filtro).map(p => {
      const vinculadas = casas.filter(c => c.pontoAtendimentoId === p.id)
      const disponiveis = casas.filter(c => c.setorId === p.setorId && c.pontoAtendimentoId !== p.id)
      return <article key={p.id} className="space-y-3 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{p.nome}</h3><p className="text-sm text-slate-600">Código: {p.codigo || '—'} · {setores.find(s => s.id === p.setorId)?.nome || 'Setor'} · {p.ativo ? 'Ativo' : 'Inativo'}</p></div><div className="flex gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => selecionar(p)}>Editar</button><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => void alterarStatus(p)}>{p.ativo ? 'Inativar' : 'Ativar'}</button></div></div>
        <p className="text-sm">Casas vinculadas ({vinculadas.length}): {vinculadas.map(c => c.nome).join(', ') || 'Nenhuma'}</p>
        {p.ativo && <label className="block text-sm font-medium">Vincular Casa de Oração<select defaultValue="" key={p.id + '-' + vinculadas.length} onChange={e => void vincular(p, e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="">Selecione uma Casa do Setor</option>{disponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
      </article>
    })}</div>
  </section>
}
