import { useEffect, useState } from 'react'
import { fetchWithAuth, patchWithAuth, postWithAuth } from '../../api/apiClient'

type Tipo = { id: string; nome: string; codigo: string; ativo: boolean }
export function TiposReuniaoView() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [editando, setEditando] = useState<Tipo | null>(null)
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const carregar = async () => { setTipos(await fetchWithAuth<Tipo[]>('/tipos-reuniao')) }
  useEffect(() => { void carregar().catch(e => setErro(e instanceof Error ? e.message : 'Falha ao carregar')) }, [])
  const editar = (t: Tipo) => {
    setEditando(t); setNome(t.nome); setCodigo(t.codigo); setErro(''); setSucesso('')
    document.getElementById('form-tipo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); if (salvando) return
    setSalvando(true); setErro(''); setSucesso('')
    try {
      const dados = { nome: nome.trim(), codigo: codigo.trim().toUpperCase() }
      if (editando) await patchWithAuth('/tipos-reuniao/' + editando.id, dados)
      else await postWithAuth('/tipos-reuniao', dados)
      setEditando(null); setNome(''); setCodigo(''); await carregar()
      setSucesso('Tipo de Reunião salvo com sucesso.')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao salvar') }
    finally { setSalvando(false) }
  }
  const status = async (t: Tipo) => {
    setErro(''); setSucesso('')
    try { await patchWithAuth('/tipos-reuniao/' + t.id, { ativo: !t.ativo }); await carregar(); setSucesso('Situação atualizada.') }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao atualizar') }
  }
  return <section className="space-y-4 p-4 sm:p-6">
    <header className="rounded-xl bg-brand-900 p-4 text-white"><h2 className="text-xl font-bold">Tipos de Reunião</h2><p className="text-sm text-brand-100">Catálogo de assuntos institucionais padronizados</p></header>
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{erro}</p>}
    {sucesso && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{sucesso}</p>}
    <form id="form-tipo" onSubmit={salvar} className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="font-semibold">{editando ? 'Editar Tipo de Reunião' : 'Novo Tipo de Reunião'}</h3>
      <label className="block text-sm font-medium">Nome<input required maxLength={255} className="mt-1 w-full rounded-lg border p-3" value={nome} onChange={e => setNome(e.target.value)} /></label>
      <label className="block text-sm font-medium">Código<input required maxLength={60} pattern="[A-Za-z0-9_-]+" title="Use letras, números, hífen ou sublinhado" className="mt-1 w-full rounded-lg border p-3 uppercase" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} /></label>
      <div className="flex flex-wrap gap-2"><button disabled={salvando} className="rounded-lg bg-brand-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>{editando && <button type="button" className="rounded-lg border px-4 py-2" onClick={() => { setEditando(null); setNome(''); setCodigo('') }}>Cancelar edição</button>}</div>
    </form>
    <div className="space-y-3">{tipos.map(t => <article key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><div className="min-w-0"><h3 className="break-words font-semibold">{t.nome}</h3><p className="text-sm text-slate-600">Código: {t.codigo} · {t.ativo ? 'Ativo' : 'Inativo'}</p></div><div className="flex gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => editar(t)}>Editar</button><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => void status(t)}>{t.ativo ? 'Inativar' : 'Ativar'}</button></div></article>)}</div>
  </section>
}
