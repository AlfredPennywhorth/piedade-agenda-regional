import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL, ApiError } from '../../api/apiClient'
import { generateQrMatrix } from '../agenda/qrGenerator'

type Sessao = {
  credencialId: string
  expiraEm: string
  evento: {
    id: string
    titulo: string
    inicioEm: string
    fimEm: string
    modalidade: string
  }
}

type Participante = {
  convocacaoDestinatarioId: string
  membro: { id: string; nome: string; casaNome: string | null }
  rsvpResposta: string | null
  checkin: { id: string; dataHoraCheckin: string; forma: string } | null
}

type Convidado = {
  id: string
  nome: string
  localidade: string
  referencia?: string | null
  status: string
  registradoEm?: string | null
}

async function chamadaOperador<T>(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${token}`)
  if (options.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_BASE_URL}/portaria-operador-publica${endpoint}`, {
    ...options,
    headers,
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, body.error || body.message || 'Acesso indisponível', body)
  }
  return body
}

export function PortariaOperadorTemporarioView({ token }: { token: string }) {
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [convidados, setConvidados] = useState<Convidado[]>([])
  const [busca, setBusca] = useState('')
  const [qrToken, setQrToken] = useState('')
  const [cadastroUrl, setCadastroUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [cameraErro, setCameraErro] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanFrameRef = useRef<number | null>(null)

  const carregar = async () => {
    setLoading(true)
    setErro('')
    try {
      const [sessaoData, participantesData, convidadosData] = await Promise.all([
        chamadaOperador<Sessao>(token, '/sessao'),
        chamadaOperador<{ participantes: Participante[] }>(token, '/participantes'),
        chamadaOperador<{ data: Convidado[] }>(token, '/convidados'),
      ])
      setSessao(sessaoData)
      setParticipantes(participantesData.participantes || [])
      setConvidados(convidadosData.data || [])
    } catch (err) {
      const apiErr = err as ApiError<any>
      setErro(apiErr.body?.code === 'PORTARIA_FECHADA'
        ? 'Esta Portaria já foi encerrada.'
        : apiErr.message || 'Acesso temporário indisponível.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
    return () => pararCamera()
  }, [token])

  const participantesFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    if (!termo) return participantes
    return participantes.filter(item =>
      item.membro.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
      (item.membro.casaNome || '').toLocaleLowerCase('pt-BR').includes(termo)
    )
  }, [busca, participantes])

  const registrarManual = async (participante: Participante) => {
    setMensagem('')
    setErro('')
    try {
      await chamadaOperador(token, '/checkin/manual', {
        method: 'POST',
        body: JSON.stringify({ convocacaoDestinatarioId: participante.convocacaoDestinatarioId }),
      })
      setMensagem(`Presença registrada: ${participante.membro.nome}.`)
      await carregar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  const registrarQrValor = async (valor: string) => {
    const codigo = valor.trim()
    if (!codigo) return

    setMensagem('')
    setErro('')
    try {
      await chamadaOperador(token, '/checkin/qr', {
        method: 'POST',
        body: JSON.stringify({ qrToken: codigo }),
      })
      setQrToken('')
      setMensagem('Presença registrada pelo QR Code.')
      await carregar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  const registrarQr = async (event: FormEvent) => {
    event.preventDefault()
    await registrarQrValor(qrToken)
  }

  const pararCamera = () => {
    if (scanFrameRef.current !== null) {
      cancelAnimationFrame(scanFrameRef.current)
      scanFrameRef.current = null
    }
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraAtiva(false)
  }

  const iniciarCamera = async () => {
    setCameraErro('')
    setErro('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraErro('Este navegador não oferece acesso à câmera.')
      return
    }

    const BarcodeDetectorCtor = (window as any).BarcodeDetector
    if (!BarcodeDetectorCtor) {
      setCameraErro('A leitura automática de QR Code não é suportada neste navegador. Use o campo manual como contingência.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      video.srcObject = stream
      await video.play()
      setCameraAtiva(true)

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] })

      const detectar = async () => {
        const currentVideo = videoRef.current
        if (!currentVideo || !streamRef.current) return

        try {
          if (currentVideo.readyState >= 2) {
            const codigos = await detector.detect(currentVideo)
            const valor = codigos?.[0]?.rawValue?.trim()
            if (valor) {
              pararCamera()
              await registrarQrValor(valor)
              return
            }
          }
        } catch {
          // Mantém a leitura ativa; quadros transitórios podem falhar.
        }

        scanFrameRef.current = requestAnimationFrame(detectar)
      }

      scanFrameRef.current = requestAnimationFrame(detectar)
    } catch (err: any) {
      pararCamera()
      if (err?.name === 'NotAllowedError') {
        setCameraErro('Permissão da câmera negada. Autorize a câmera no navegador e tente novamente.')
      } else {
        setCameraErro('Não foi possível abrir a câmera deste aparelho.')
      }
    }
  }

  const validarConvidado = async (id: string) => {
    setMensagem('')
    setErro('')
    try {
      await chamadaOperador(token, `/convidados/${id}/validar`, { method: 'POST' })
      setMensagem('Presença do convidado validada.')
      await carregar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  const gerarCadastroConvidados = async () => {
    setMensagem('')
    setErro('')
    try {
      const data = await chamadaOperador<{
        credencial: { caminhoCadastro: string }
      }>(token, '/cadastro-convidados/credencial', { method: 'POST' })
      setCadastroUrl(`${window.location.origin}${data.credencial.caminhoCadastro}`)
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  const solicitarFechamento = async () => {
    if (!window.confirm('Solicitar o encerramento desta Portaria ao gestor da reunião? A Portaria continuará aberta até a confirmação.')) return
    setMensagem('')
    setErro('')
    try {
      await chamadaOperador(token, '/solicitar-fechamento', { method: 'POST' })
      setMensagem('Solicitação enviada. Aguarde a confirmação do gestor da reunião.')
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  if (loading && !sessao) {
    return <main role="status" aria-live="polite" className="min-h-screen bg-slate-50 p-6 text-center text-slate-600">Abrindo Portaria...</main>
  }

  if (!sessao) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Acesso de Portaria</h1>
          <p role={erro ? "alert" : "status"} className="mt-3 text-sm text-slate-600">{erro || mensagem || 'Este acesso não está mais disponível.'}</p>
        </div>
      </main>
    )
  }

  const presentes = participantes.filter(item => item.checkin).length

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-2xl bg-brand-900 p-5 text-white shadow">
          <p className="text-xs uppercase tracking-wide text-brand-200">Acesso temporário de Portaria</p>
          <h1 className="mt-1 text-2xl font-bold">{sessao.evento.titulo}</h1>
          <p className="mt-2 text-sm text-brand-100">
            Este acesso vale somente para esta reunião e será revogado no fechamento.
          </p>
        </header>

        {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div>}
        {mensagem && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{mensagem}</div>}

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-white p-4 text-center"><strong className="block text-xl">{participantes.length}</strong><span className="text-xs text-slate-500">Esperados</span></div>
          <div className="rounded-xl border bg-white p-4 text-center"><strong className="block text-xl">{presentes}</strong><span className="text-xs text-slate-500">Presentes</span></div>
          <div className="rounded-xl border bg-white p-4 text-center"><strong className="block text-xl">{participantes.length - presentes}</strong><span className="text-xs text-slate-500">Pendentes</span></div>
        </section>

        <section className="rounded-xl border bg-white p-5 space-y-3">
          <div>
            <h2 className="font-semibold">Check-in por QR</h2>
            <p className="mt-1 text-xs text-slate-500">Use a câmera do celular ou, como contingência, cole/digite o código.</p>
          </div>

          <button
            type="button"
            onClick={() => cameraAtiva ? pararCamera() : void iniciarCamera()}
            className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
          >
            {cameraAtiva ? 'Fechar câmera' : 'Abrir câmera para ler QR Code'}
          </button>

          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full rounded-xl bg-black ${cameraAtiva ? 'block' : 'hidden'}`}
            aria-label="Câmera para leitura de QR Code"
          />

          {cameraErro && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {cameraErro}
            </div>
          )}

          <form onSubmit={registrarQr} className="flex gap-2">
            <input
              aria-label="Código QR do participante"
              value={qrToken}
              onChange={e => setQrToken(e.target.value)}
              placeholder="Cole ou digite o código do participante"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 p-3 text-sm"
            />
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Registrar</button>
          </form>
        </section>

        <section className="rounded-xl border bg-white p-5 space-y-3">
          <div>
            <h2 className="font-semibold">Convidados não previstos</h2>
            <p className="text-xs text-slate-500">O convidado preenche os próprios dados. O porteiro apenas valida.</p>
          </div>
          <button
            type="button"
            onClick={() => void gerarCadastroConvidados()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Gerar link / QR para convidados
          </button>

          {cadastroUrl && (() => {
            const matrix = generateQrMatrix(cadastroUrl)
            const quiet = 4
            const size = matrix.length + quiet * 2
            return (
              <div className="rounded-xl bg-slate-50 p-4">
                <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR Code para autocadastro de convidados" className="mx-auto h-56 w-56 bg-white" shapeRendering="crispEdges">
                  <rect width={size} height={size} fill="#fff" />
                  {matrix.map((row, r) => row.map((cell, col) => cell
                    ? <rect key={`${r}-${col}`} x={col + quiet} y={r + quiet} width="1" height="1" fill="#000" />
                    : null))}
                </svg>
                <a href={cadastroUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all text-xs text-brand-700 underline">
                  {cadastroUrl}
                </a>
              </div>
            )
          })()}

          <div className="space-y-2">
            {convidados.map(convidado => (
              <div key={convidado.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{convidado.nome}</p>
                  <p className="text-xs text-slate-500">{convidado.localidade}</p>
                </div>
                {convidado.status === 'PENDENTE'
                  ? <button type="button" onClick={() => void validarConvidado(convidado.id)} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white">Validar</button>
                  : <span className="text-xs font-semibold text-green-700">Validado</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 space-y-3">
          <h2 className="font-semibold">Participantes previstos</h2>
          <input
            aria-label="Buscar participante por nome ou Casa de Oração"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar nome ou Casa de Oração"
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
          <div className="max-h-[520px] space-y-2 overflow-y-auto">
            {participantesFiltrados.map(item => (
              <div key={item.membro.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{item.membro.nome}</p>
                  <p className="text-xs text-slate-500">{item.membro.casaNome || 'Casa não informada'}</p>
                </div>
                {item.checkin
                  ? <span className="text-xs font-semibold text-green-700">Presente</span>
                  : <button type="button" onClick={() => void registrarManual(item)} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">Registrar presença</button>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-red-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Solicitar encerramento</h2>
          <p className="mt-1 text-xs text-slate-500">Envie a solicitação ao gestor da reunião. A Portaria continuará aberta até a confirmação definitiva.</p>
          <button
            type="button"
            onClick={() => void solicitarFechamento()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Solicitar encerramento
          </button>
        </section>
      </div>
    </main>
  )
}
