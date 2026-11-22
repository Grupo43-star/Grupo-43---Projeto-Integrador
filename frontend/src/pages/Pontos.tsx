import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Clock,
  Crosshair,
  ExternalLink,
  Home,
  Info,
  LoaderCircle,
  MapPin,
  MapPinOff,
  Navigation,
  Phone,
  RotateCw,
  X,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/useAuth'
import { mensagemDeErro } from '../services/api'
import { listarCategorias, type CategoriaGuia } from '../services/materiais'
import {
  enderecoDoPonto,
  linkDoMapa,
  listarPontos,
  nomeDoTipo,
  RAIOS_KM,
  tiposPonto,
  tipoValido,
  type Ponto,
} from '../services/pontos'
import { agruparAgenda, formatarDistancia } from '../utils/agenda'
import './pontos.css'
import { propsCategoria } from '../utils/corCategoria'

type Estado = 'carregando' | 'pronto' | 'erro'
type Filtro = 'material' | 'tipo' | 'aberto'

/** De onde sai a distância: GPS do aparelho ou o local marcado no endereço do perfil. */
type Origem =
  | { estado: 'inativa' }
  | { estado: 'buscando' }
  | { estado: 'ativa'; fonte: 'aparelho' | 'endereco'; latitude: number; longitude: number }
  | { estado: 'erro'; mensagem: string }

interface ListaPontos {
  itens: Ponto[]
  total: number
  pagina: number
  totalPaginas: number
}

const listaVazia: ListaPontos = { itens: [], total: 0, pagina: 1, totalPaginas: 1 }

function ehCancelamento(erro: unknown) {
  return erro instanceof DOMException && erro.name === 'AbortError'
}

// Filtros ficam na URL (?material=<slug do back>&tipo=PEV&aberto=1) para o link poder ser
// compartilhado. A localização e o raio NÃO vão para a URL: só existem com a página aberta.
export default function Pontos() {
  const { usuario } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const materialParam = parametros.get('material') ?? ''
  const tipoParam = parametros.get('tipo') ?? ''
  const tipo = tipoValido(tipoParam) ? tipoParam : undefined
  const somenteAbertos = parametros.get('aberto') === '1'

  const enderecoDoPerfil =
    usuario?.endereco.latitude != null && usuario.endereco.longitude != null
      ? { latitude: usuario.endereco.latitude, longitude: usuario.endereco.longitude }
      : null

  const [origem, setOrigem] = useState<Origem>({ estado: 'inativa' })
  const [raio, setRaio] = useState('')
  const origemAtiva = origem.estado === 'ativa' ? origem : null
  const raioKm = origemAtiva && raio ? Number(raio) : null

  // ---------- Categorias (filtro de material) ----------
  const [categorias, setCategorias] = useState<CategoriaGuia[]>([])
  const [estadoCategorias, setEstadoCategorias] = useState<Estado>('carregando')
  const [tentativaCategorias, setTentativaCategorias] = useState(0)

  function recarregarCategorias() {
    setEstadoCategorias('carregando')
    setTentativaCategorias((n) => n + 1)
  }

  useEffect(() => {
    const controle = new AbortController()
    listarCategorias(controle.signal)
      .then((lista) => {
        setCategorias(lista)
        setEstadoCategorias('pronto')
      })
      .catch((erro) => {
        if (!ehCancelamento(erro)) setEstadoCategorias('erro')
      })
    return () => controle.abort()
  }, [tentativaCategorias])

  // Slug inválida na URL (ou categorias fora do ar) é ignorada
  const categoriaAtual = categorias.find((c) => c.slug === materialParam) ?? null
  const esperandoCategoria = Boolean(materialParam) && estadoCategorias === 'carregando'
  const categoriaId = categoriaAtual?.id

  // ---------- Pontos ----------
  // Cada resultado guarda a chave da consulta que o gerou: chave diferente = atualizando.
  const [tentativaPontos, setTentativaPontos] = useState(0)
  const latitude = origemAtiva?.latitude
  const longitude = origemAtiva?.longitude
  const chave = [
    tentativaPontos,
    categoriaId ?? '',
    tipo ?? '',
    somenteAbertos,
    latitude ?? '',
    longitude ?? '',
    raioKm ?? '',
  ].join('|')

  const [resultado, setResultado] = useState<{
    chave: string
    estado: 'pronto' | 'erro'
    lista: ListaPontos
    erro: string
  } | null>(null)
  const [mais, setMais] = useState<{ chave: string; carregando: boolean; erro: string } | null>(
    null,
  )
  const controleMais = useRef<AbortController | null>(null)

  const filtros = useCallback(
    (pagina: number) => ({
      categoriaId,
      tipo,
      abertoAgora: somenteAbertos,
      origem: latitude !== undefined && longitude !== undefined ? { latitude, longitude } : null,
      raioKm,
      pagina,
    }),
    [categoriaId, tipo, somenteAbertos, latitude, longitude, raioKm],
  )

  useEffect(() => {
    if (esperandoCategoria) return
    const controle = new AbortController()
    controleMais.current?.abort()
    listarPontos(filtros(1), controle.signal)
      .then((pagina) =>
        setResultado({
          chave,
          estado: 'pronto',
          erro: '',
          lista: {
            itens: pagina.items,
            total: pagina.total,
            pagina: pagina.page,
            totalPaginas: pagina.totalPages,
          },
        }),
      )
      .catch((erro) => {
        if (ehCancelamento(erro)) return
        setResultado({ chave, estado: 'erro', erro: mensagemDeErro(erro), lista: listaVazia })
      })
    return () => controle.abort()
  }, [filtros, esperandoCategoria, chave])

  useEffect(() => () => controleMais.current?.abort(), [])

  const lista = resultado?.lista ?? listaVazia
  const estadoPontos: Estado =
    esperandoCategoria || resultado?.chave !== chave ? 'carregando' : resultado.estado
  const carregando = estadoPontos === 'carregando'
  const carregandoMais = mais?.chave === chave && mais.carregando
  const erroMais = mais?.chave === chave ? mais.erro : ''

  function carregarMais() {
    const controle = new AbortController()
    controleMais.current?.abort()
    controleMais.current = controle
    setMais({ chave, carregando: true, erro: '' })
    listarPontos(filtros(lista.pagina + 1), controle.signal)
      .then((pagina) => {
        setResultado((atual) =>
          atual && atual.chave === chave
            ? {
                ...atual,
                lista: {
                  itens: [
                    ...atual.lista.itens,
                    ...pagina.items.filter((p) => !atual.lista.itens.some((a) => a.id === p.id)),
                  ],
                  total: pagina.total,
                  pagina: pagina.page,
                  totalPaginas: pagina.totalPages,
                },
              }
            : atual,
        )
        setMais(null)
      })
      .catch((erro) => {
        if (ehCancelamento(erro)) return
        setMais({ chave, carregando: false, erro: mensagemDeErro(erro) })
      })
  }

  // ---------- Filtros ----------
  function alterarFiltro(chave: Filtro, valor: string) {
    // Forma funcional: parte sempre da URL atual, mesmo com duas mudanças seguidas
    setParametros(
      (atuais) => {
        const novos = new URLSearchParams(atuais)
        if (valor) novos.set(chave, valor)
        else novos.delete(chave)
        return novos
      },
      { replace: true },
    )
  }

  function limparFiltros() {
    setParametros({}, { replace: true })
    setRaio('')
  }

  function usarLocalizacao() {
    if (!('geolocation' in navigator)) {
      setOrigem({
        estado: 'erro',
        mensagem: 'Seu navegador não permite consultar a localização. Filtre por material ou tipo.',
      })
      return
    }
    setOrigem({ estado: 'buscando' })
    navigator.geolocation.getCurrentPosition(
      (posicao) =>
        setOrigem({
          estado: 'ativa',
          fonte: 'aparelho',
          latitude: Number(posicao.coords.latitude.toFixed(6)),
          longitude: Number(posicao.coords.longitude.toFixed(6)),
        }),
      (erro) =>
        setOrigem({
          estado: 'erro',
          mensagem:
            erro.code === erro.PERMISSION_DENIED
              ? 'Você não permitiu o acesso à localização. Ainda é possível filtrar por material e tipo de ponto.'
              : 'Não foi possível obter sua localização agora. Tente novamente.',
        }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  function usarEndereco() {
    if (!enderecoDoPerfil) return
    setOrigem({ estado: 'ativa', fonte: 'endereco', ...enderecoDoPerfil })
  }

  function pararLocalizacao() {
    setOrigem({ estado: 'inativa' })
    setRaio('')
  }

  const filtrando = Boolean(categoriaAtual || tipo || somenteAbertos || raioKm)
  let resumo = ''
  if (carregando) resumo = 'Carregando pontos...'
  else if (estadoPontos === 'pronto')
    resumo = filtrando
      ? lista.total === 1
        ? '1 ponto encontrado'
        : `${lista.total} pontos encontrados`
      : lista.total === 1
        ? '1 ponto cadastrado'
        : `${lista.total} pontos cadastrados`
  const restantes = lista.total - lista.itens.length

  return (
    <div className="page pontos">
      <PageHeader
        eyebrow="Perto de você"
        titulo="Pontos de coleta"
        descricao="Consulte os locais de entrega cadastrados pela rede local, o que cada um aceita e quando funciona."
        icon={MapPin}
      />

      <form className="card pontos__filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="pontos__campos">
          <div className="campo">
            <label htmlFor="pontos-material" className="campo__rotulo">
              Material aceito
            </label>
            <select
              id="pontos-material"
              className="input"
              value={categoriaAtual?.slug ?? ''}
              disabled={estadoCategorias !== 'pronto'}
              onChange={(e) => alterarFiltro('material', e.target.value)}
            >
              <option value="">
                {estadoCategorias === 'carregando' ? 'Carregando...' : 'Todos os materiais'}
              </option>
              {categorias.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label htmlFor="pontos-tipo" className="campo__rotulo">
              Tipo de ponto
            </label>
            <select
              id="pontos-tipo"
              className="input"
              value={tipo ?? ''}
              onChange={(e) => alterarFiltro('tipo', e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {tiposPonto.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nome}
                </option>
              ))}
            </select>
            {tipo && (
              <span className="campo__ajuda">
                {tiposPonto.find((t) => t.valor === tipo)?.descricao}
              </span>
            )}
          </div>

          <div className="campo">
            <label htmlFor="pontos-raio" className="campo__rotulo">
              Distância máxima
            </label>
            <select
              id="pontos-raio"
              className="input"
              value={origemAtiva ? raio : ''}
              disabled={!origemAtiva}
              aria-describedby="pontos-raio-ajuda"
              onChange={(e) => setRaio(e.target.value)}
            >
              <option value="">Qualquer distância</option>
              {RAIOS_KM.map((km) => (
                <option key={km} value={String(km)}>
                  Até {km} km
                </option>
              ))}
            </select>
            {!origemAtiva && (
              <span id="pontos-raio-ajuda" className="campo__ajuda">
                Use sua localização ou seu endereço para limitar a distância.
              </span>
            )}
          </div>

          <label className="caixa pontos__abertos">
            <input
              type="checkbox"
              checked={somenteAbertos}
              onChange={(e) => alterarFiltro('aberto', e.target.checked ? '1' : '')}
            />
            <span>Só pontos abertos agora</span>
          </label>
        </div>

        <div className="pontos__localizacao">
          {origemAtiva ? (
            <>
              <span className="pontos__localizacao-ativa">
                <Navigation size={15} aria-hidden="true" />
                {origemAtiva.fonte === 'endereco'
                  ? 'Do mais perto ao mais longe do seu endereço.'
                  : 'Do mais perto ao mais longe de você.'}
              </span>
              <button
                type="button"
                className="btn btn--contorno btn--pequeno"
                onClick={pararLocalizacao}
              >
                <X size={15} /> Parar de ordenar por distância
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--contorno btn--pequeno"
                onClick={usarLocalizacao}
                disabled={origem.estado === 'buscando'}
              >
                {origem.estado === 'buscando' ? (
                  <LoaderCircle size={15} className="girando" aria-hidden="true" />
                ) : (
                  <Crosshair size={15} aria-hidden="true" />
                )}
                {origem.estado === 'buscando' ? 'Localizando...' : 'Usar minha localização'}
              </button>
              <span className="campo__ajuda">
                Sua localização só é solicitada ao tocar no botão e não é salva.
              </span>
              {enderecoDoPerfil && (
                <button type="button" className="pontos__meu-bairro" onClick={usarEndereco}>
                  <Home size={14} aria-hidden="true" />
                  Perto do meu endereço
                </button>
              )}
            </>
          )}
        </div>
      </form>

      {origem.estado === 'erro' && (
        <div className="alerta alerta--erro pontos__alerta" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{origem.mensagem}</span>
        </div>
      )}

      {estadoCategorias === 'erro' && (
        <div className="alerta alerta--erro pontos__alerta" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <p>
            A lista de materiais para filtrar não pôde ser carregada. Os pontos continuam
            aparecendo.
          </p>
          <button
            type="button"
            className="btn btn--contorno btn--pequeno"
            onClick={recarregarCategorias}
          >
            <RotateCw size={14} /> Tentar novamente
          </button>
        </div>
      )}

      <div className="resumo-filtros">
        <p className="texto-suave" aria-live="polite">
          {resumo}
        </p>
        {(materialParam || tipoParam || somenteAbertos || raioKm) && (
          <button type="button" className="resumo-filtros__limpar" onClick={limparFiltros}>
            <X size={14} /> Limpar filtros
          </button>
        )}
      </div>

      {estadoPontos === 'erro' ? (
        <div className="alerta alerta--erro pontos__alerta" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <p>Não foi possível consultar os pontos agora. {resultado?.erro}</p>
          <button
            type="button"
            className="btn btn--contorno btn--pequeno"
            onClick={() => setTentativaPontos((n) => n + 1)}
          >
            <RotateCw size={14} /> Tentar novamente
          </button>
        </div>
      ) : carregando && lista.itens.length === 0 ? (
        <div className="card pontos__vazio" aria-busy="true">
          <LoaderCircle size={22} className="girando" aria-hidden="true" />
          <p className="texto-suave">Carregando os pontos de coleta...</p>
        </div>
      ) : lista.itens.length > 0 ? (
        <>
          <ul
            className={`pontos__lista${carregando ? ' pontos__lista--atualizando' : ''}`}
            aria-busy={carregando}
          >
            {lista.itens.map((p) => (
              <CardPonto key={p.id} ponto={p} materialEmDestaque={categoriaAtual?.slug ?? ''} />
            ))}
          </ul>

          {restantes > 0 && !carregando && (
            <div className="pontos__mais">
              {erroMais && (
                <p className="alerta alerta--erro" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>Não foi possível carregar mais pontos. {erroMais}</span>
                </p>
              )}
              <button
                type="button"
                className="btn btn--contorno"
                onClick={carregarMais}
                disabled={carregandoMais}
              >
                {carregandoMais ? (
                  <>
                    <LoaderCircle size={16} className="girando" aria-hidden="true" /> Carregando...
                  </>
                ) : (
                  `Carregar mais pontos (${restantes})`
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card pontos__vazio">
          <span className="icon-circle">
            <MapPinOff size={20} strokeWidth={1.75} />
          </span>
          <h2 className="card__titulo">Nenhum ponto encontrado.</h2>
          <p className="texto-suave">
            {raioKm
              ? 'Não há pontos com esses filtros dentro dessa distância. Tente aumentar a distância ou trocar os filtros.'
              : 'Tente outro material ou tipo de ponto.'}{' '}
            Se não houver ponto por perto, você pode pedir uma retirada no seu endereço.
          </p>
          <div className="pontos__vazio-acoes">
            <button type="button" className="btn btn--contorno" onClick={limparFiltros}>
              Limpar filtros
            </button>
            <Link to="/solicitacoes" className="btn btn--primario">
              Solicitar retirada <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function CardPonto({ ponto: p, materialEmDestaque }: { ponto: Ponto; materialEmDestaque: string }) {
  // O detalhe volta para a lista com os mesmos filtros e já mostra o que o cartão tem
  const { pathname, search } = useLocation()
  return (
    <li className="card pontos__card">
      <div className="card__topo">
        <span className="pontos__tipo">{nomeDoTipo(p.tipo)}</span>
        <span className={`pontos__status ${p.abertoAgora ? 'pontos__status--aberto' : ''}`}>
          {p.abertoAgora ? 'Aberto agora' : 'Fechado agora'}
        </span>
      </div>

      <div>
        <h2 className="card__titulo">{p.nome}</h2>
        <p className="pontos__endereco">
          <MapPin size={14} aria-hidden="true" />
          <span>{enderecoDoPonto(p)}</span>
        </p>
        {p.distanciaKm !== null && (
          <p className="pontos__distancia">
            <Navigation size={13} aria-hidden="true" />a {formatarDistancia(p.distanciaKm)}
          </p>
        )}
        {p.cooperativa && (
          <p className="pontos__cooperativa">
            <Building2 size={13} aria-hidden="true" />
            {p.cooperativa}
          </p>
        )}
      </div>

      {p.categorias.length > 0 && (
        <div className="pontos__bloco">
          <span className="pontos__rotulo">Aceita</span>
          <ul className="pontos__materiais">
            {p.categorias.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/guia?categoria=${c.slug}`}
                  {...propsCategoria(c, c.slug === materialEmDestaque ? 'tag tag--destaque' : 'tag')}
                  title={`Ver ${c.nome} no guia de materiais`}
                >
                  {c.nome}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.horarios.length > 0 && (
        <div className="pontos__bloco">
          <span className="pontos__rotulo">Horário de funcionamento</span>
          <ul className="pontos__agenda">
            {agruparAgenda(p.horarios).map((g) => (
              <li key={g.horario + g.dias}>
                <Clock size={13} aria-hidden="true" />
                <span className="pontos__agenda-dias">{g.dias}</span>
                <span>{g.horario}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.orientacoes && (
        <p className="pontos__orientacoes">
          <Info size={14} aria-hidden="true" />
          <span>{p.orientacoes}</span>
        </p>
      )}

      <div className="pontos__acoes">
        <Link
          to={`/pontos/${p.id}`}
          state={{ ponto: p, de: pathname + search }}
          className="link-seta"
          aria-label={`Ver detalhes de ${p.nome}`}
        >
          Ver detalhes <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <a href={linkDoMapa(p)} target="_blank" rel="noreferrer" className="link-seta">
          Como chegar <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
        {p.telefone && (
          <a href={`tel:${p.telefone.replace(/[^\d+]/g, '')}`} className="pontos__telefone">
            <Phone size={13} aria-hidden="true" />
            {p.telefone}
          </a>
        )}
      </div>
    </li>
  )
}
