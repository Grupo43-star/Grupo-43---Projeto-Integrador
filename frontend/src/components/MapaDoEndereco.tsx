import { useEffect, useId, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CircleAlert, LoaderCircle, MapPin } from 'lucide-react'
import type { Endereco } from '../data/usuario'
import {
  enderecoLocalizavel,
  localizarEndereco,
  type Coordenadas,
  type Precisao,
} from '../services/geocodificacao'

// Mapa para confirmar o local do endereço. O back exige latitude/longitude
// ("coordenadas escolhidas no mapa pelo aplicativo") e as copia para cada pedido de retirada.
//
// Como funciona: o pino fica FIXO no centro e a pessoa move o mapa por baixo dele
// (mouse, dedo ou setas do teclado). Quando o endereço muda, as coordenadas voltam a null
// (ver CamposEndereco) e o mapa procura o endereço de novo para posicionar o pino.

interface Props {
  endereco: Endereco
  erro?: string
  onAlterar: (coordenadas: Coordenadas) => void
}

// 'numero', 'rua' e 'bairro': até onde a busca chegou (Precisao em services/geocodificacao.ts)
type Status = 'aguardando' | 'buscando' | Precisao | 'nao-achado' | 'indisponivel' | 'marcado'

const ZOOM_ENDERECO = 17
const ZOOM_BAIRRO = 15
const ZOOM_INICIAL = 11
const CENTRO_INICIAL: L.LatLngTuple = [-23.5505, -46.6333] // São Paulo, enquanto não há posição
const ESPERA_DIGITACAO_MS = 900

const arredondar = (n: number) => Math.round(n * 1e6) / 1e6
const perto = (a: Coordenadas, b: L.LatLng) =>
  Math.abs(a.latitude - b.lat) < 1e-6 && Math.abs(a.longitude - b.lng) < 1e-6

/** Texto que identifica o local: mudou, procura de novo (o complemento não conta) */
const chaveDoLocal = (e: Endereco) =>
  [e.cep, e.rua, e.numero, e.bairro, e.cidade, e.uf].map((t) => t.trim().toLowerCase()).join('|')

export default function MapaDoEndereco({ endereco, erro, onAlterar }: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  // Pode haver dois mapas na página (endereço principal e a janela de outro endereço)
  const idBase = useId()
  const mapaRef = useRef<L.Map | null>(null)
  const movendoPeloCodigo = useRef(false)
  const onAlterarRef = useRef(onAlterar)
  const enderecoRef = useRef(endereco)
  const [statusSalvo, setStatus] = useState<Status>(
    endereco.latitude !== null ? 'marcado' : 'aguardando',
  )

  useEffect(() => {
    onAlterarRef.current = onAlterar
    enderecoRef.current = endereco
  })

  const temPosicao = endereco.latitude !== null && endereco.longitude !== null
  // O endereço mudou e a posição foi limpa: o que valia para a posição anterior não vale mais
  const status: Status =
    !temPosicao &&
    (statusSalvo === 'numero' ||
      statusSalvo === 'rua' ||
      statusSalvo === 'bairro' ||
      statusSalvo === 'marcado')
      ? 'aguardando'
      : statusSalvo
  const mostrarMapa = temPosicao || status === 'nao-achado' || status === 'indisponivel'

  // Cria o mapa quando ele aparece
  useEffect(() => {
    if (!mostrarMapa || !divRef.current || mapaRef.current) return
    const mapa = L.map(divRef.current, {
      scrollWheelZoom: false, // não "prende" a rolagem da página
      zoomControl: true,
      attributionControl: true,
    })
    mapa.attributionControl.setPrefix(false)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa)

    // Só o movimento feito pela pessoa conta como "marcou o local"
    mapa.on('moveend', () => {
      if (movendoPeloCodigo.current) {
        movendoPeloCodigo.current = false
        return
      }
      const centro = mapa.getCenter()
      setStatus('marcado')
      onAlterarRef.current({ latitude: arredondar(centro.lat), longitude: arredondar(centro.lng) })
    })

    movendoPeloCodigo.current = true
    mapa.setView(CENTRO_INICIAL, ZOOM_INICIAL, { animate: false })
    mapaRef.current = mapa
    return () => {
      mapa.remove()
      mapaRef.current = null
    }
  }, [mostrarMapa])

  // Coordenadas novas (do back ou da busca): leva o mapa até elas
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa || endereco.latitude === null || endereco.longitude === null) return
    const alvo = { latitude: endereco.latitude, longitude: endereco.longitude }
    if (perto(alvo, mapa.getCenter())) return
    movendoPeloCodigo.current = true
    const zoom = status === 'bairro' ? ZOOM_BAIRRO : Math.max(mapa.getZoom(), ZOOM_ENDERECO)
    mapa.setView([alvo.latitude, alvo.longitude], zoom, { animate: false })
  }, [endereco.latitude, endereco.longitude, status, mostrarMapa])

  // Sem posição e com endereço suficiente: procura o endereço depois que a pessoa para de digitar
  const chave = chaveDoLocal(endereco)
  const precisaBuscar = !temPosicao && enderecoLocalizavel(endereco)

  useEffect(() => {
    if (!precisaBuscar) return
    const controle = new AbortController()
    const tempo = setTimeout(async () => {
      setStatus('buscando')
      try {
        const achado = await localizarEndereco(enderecoRef.current, controle.signal)
        if (!achado) {
          setStatus('nao-achado')
          return
        }
        setStatus(achado.precisao)
        onAlterarRef.current({
          latitude: arredondar(achado.coordenadas.latitude),
          longitude: arredondar(achado.coordenadas.longitude),
        })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setStatus('indisponivel')
      }
    }, ESPERA_DIGITACAO_MS)
    return () => {
      clearTimeout(tempo)
      controle.abort()
    }
  }, [chave, precisaBuscar])

  const temNumero = /^\d+$/.test(endereco.numero)
  const mensagem = (() => {
    if (status === 'buscando') return 'Procurando o endereço no mapa...'
    if (status === 'numero') return 'Pino colocado no número do endereço. Confira e mova o mapa se precisar.'
    // O OpenStreetMap não tem a numeração de muitas ruas: devolve um ponto qualquer da rua
    if (status === 'rua')
      return temNumero
        ? 'Achamos a rua, mas o mapa não tem a numeração dela. Mova o mapa até o pino ficar sobre a sua casa.'
        : 'Achamos a rua. Mova o mapa até o pino ficar sobre o local.'
    if (status === 'bairro')
      return 'Achamos só o bairro. Mova o mapa até o pino ficar sobre o seu endereço.'
    if (status === 'nao-achado')
      return 'Não achamos o endereço no mapa. Mova o mapa até o pino ficar sobre o local.'
    if (status === 'indisponivel')
      return 'Não foi possível procurar o endereço agora. Mova o mapa até o pino ficar sobre o local.'
    if (status === 'marcado') return 'Local marcado. Mova o mapa se precisar ajustar.'
    return 'Preencha rua, cidade e UF para marcar o local no mapa.'
  })()

  const alerta =
    status === 'rua' || status === 'bairro' || status === 'nao-achado' || status === 'indisponivel'

  return (
    <div className="campo campo--inteiro mapa-endereco">
      <span className="campo__rotulo campo__rotulo--obrigatorio" id={`${idBase}-rotulo`}>
        Local no mapa
      </span>

      {mostrarMapa ? (
        <div className={`mapa-endereco__moldura${erro ? ' mapa-endereco__moldura--erro' : ''}`}>
          <div
            ref={divRef}
            className="mapa-endereco__mapa"
            role="application"
            aria-labelledby={`${idBase}-rotulo`}
            aria-describedby={`${idBase}-ajuda`}
          />
          <span className="mapa-endereco__pino" aria-hidden="true">
            <MapPin size={34} strokeWidth={2} />
          </span>
        </div>
      ) : (
        <div className="mapa-endereco__vazio">
          {status === 'buscando' ? (
            <LoaderCircle size={18} className="girando" aria-hidden="true" />
          ) : (
            <MapPin size={18} aria-hidden="true" />
          )}
          <span>{mensagem}</span>
        </div>
      )}

      <span
        id={`${idBase}-ajuda`}
        className={`campo__ajuda mapa-endereco__ajuda${alerta ? ' mapa-endereco__ajuda--alerta' : ''}`}
        aria-live="polite"
      >
        {mostrarMapa && alerta && <CircleAlert size={13} aria-hidden="true" />}
        {mostrarMapa ? mensagem : 'O local exato ajuda o coletor a chegar até você.'}
        {mostrarMapa && ' Use o mouse, o dedo ou as setas do teclado (com o mapa selecionado).'}
      </span>
      {erro && <span className="campo__erro">{erro}</span>}
    </div>
  )
}
