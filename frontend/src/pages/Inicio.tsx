import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  CircleCheck,
  Clock,
  Leaf,
  LoaderCircle,
  MapPin,
  RotateCw,
  Sprout,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { useColetasConcluidas } from '../hooks/useColetasConcluidas'
import { ErroApi } from '../services/api'
import { consultarCalendario, proximaColeta, type CalendarioColeta } from '../services/calendario'
import { listarMateriais, type MaterialGuia } from '../services/materiais'
import { rotulosPeriodo } from '../services/pedidos'
import { listarPontos } from '../services/pontos'
import { bairroDoUsuario, dataPorExtenso, somarDias } from '../utils/formatar'
import './inicio.css'
import { propsCategoria } from '../utils/corCategoria'

/** As 4 lixeiras da coleta seletiva, na ordem em que aparecem no Início. */
const CATEGORIAS_DESTAQUE = ['papel-e-papelao', 'plastico', 'vidro', 'metal']
const QUANTOS_MATERIAIS = 4
/** Raio usado no número "pontos perto do seu endereço". */
const RAIO_PONTOS_KM = 5

/** Um material de cada categoria em destaque (de preferência reciclável), sem repetir categoria. */
function escolherMateriais(lista: MaterialGuia[]) {
  const porCategoria = new Map<string, MaterialGuia>()
  for (const m of lista) {
    const atual = porCategoria.get(m.categoria.slug)
    if (!atual || (!atual.reciclavel && m.reciclavel)) porCategoria.set(m.categoria.slug, m)
  }
  const destaque = CATEGORIAS_DESTAQUE.flatMap((slug) => porCategoria.get(slug) ?? [])
  // Se o back não tiver alguma das 4, completa com outras categorias
  const resto = [...porCategoria.values()].filter((m) => !destaque.includes(m))
  return [...destaque, ...resto].slice(0, QUANTOS_MATERIAIS)
}

/** "Papel e papelão, Plástico e Vidro" */
function listarNomes(nomes: string[]) {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

export default function Inicio() {
  const { usuario } = useAuth()
  const bairro = bairroDoUsuario(usuario)
  const coletas = useColetasConcluidas(usuario?.id ?? null)
  const [hoje] = useState(() => somarDias(new Date(), 0))
  // Vindo do Perfil depois de DELETE /me. Guarda o aviso e limpa o state da navegação,
  // senão o navegador mostra o aviso de novo ao recarregar a página.
  const location = useLocation()
  const navigate = useNavigate()
  const [contaExcluida] = useState(
    () => !!(location.state as { contaExcluida?: boolean } | null)?.contaExcluida,
  )
  useEffect(() => {
    if (contaExcluida) navigate('.', { replace: true, state: null })
  }, [contaExcluida, navigate])

  // ---------- Materiais (GET /materials) ----------
  const [materiais, setMateriais] = useState<MaterialGuia[] | null>(null)
  const [erroMateriais, setErroMateriais] = useState(false)
  const [tentativaMateriais, setTentativaMateriais] = useState(0)

  useEffect(() => {
    const controle = new AbortController()
    listarMateriais({ limite: 100 }, controle.signal)
      .then((pagina) => {
        setMateriais(escolherMateriais(pagina.items))
        setErroMateriais(false)
      })
      .catch((erro: unknown) => {
        if (!(erro instanceof DOMException && erro.name === 'AbortError')) setErroMateriais(true)
      })
    return () => controle.abort()
  }, [tentativaMateriais])

  function recarregarMateriais() {
    setErroMateriais(false)
    setTentativaMateriais((n) => n + 1)
  }

  // ---------- Pontos de entrega (GET /collection-points) ----------
  const endereco = usuario?.endereco
  const latitude = endereco?.latitude ?? null
  const longitude = endereco?.longitude ?? null
  const comLocal = latitude !== null && longitude !== null
  const chavePontos = comLocal ? `${latitude}|${longitude}` : 'todos'
  const [pontos, setPontos] = useState<{ chave: string; total: number | null } | null>(null)

  useEffect(() => {
    const controle = new AbortController()
    const origem = latitude !== null && longitude !== null ? { latitude, longitude } : null
    listarPontos({ origem, raioKm: origem ? RAIO_PONTOS_KM : null, limite: 1 }, controle.signal)
      .then((pagina) => setPontos({ chave: chavePontos, total: pagina.total }))
      .catch((erro: unknown) => {
        if (!(erro instanceof DOMException && erro.name === 'AbortError'))
          setPontos({ chave: chavePontos, total: null })
      })
    return () => controle.abort()
  }, [chavePontos, latitude, longitude])

  const pontosAtual = pontos?.chave === chavePontos ? pontos : null
  const totalPontos = pontosAtual?.total ?? null

  // ---------- Próxima coleta (GET /schedule do endereço) ----------
  const cidade = endereco?.cidade ?? ''
  const chaveCalendario = bairro ? [bairro, cidade, latitude, longitude].join('|') : ''
  const [calendario, setCalendario] = useState<{
    chave: string
    dados: CalendarioColeta | null
    naoAtendido: boolean
  } | null>(null)

  useEffect(() => {
    if (!chaveCalendario || !bairro) return
    const controle = new AbortController()
    consultarCalendario({ bairro, cidade, latitude, longitude }, controle.signal)
      .then((dados) => setCalendario({ chave: chaveCalendario, dados, naoAtendido: false }))
      .catch((erro: unknown) => {
        if (erro instanceof DOMException && erro.name === 'AbortError') return
        setCalendario({
          chave: chaveCalendario,
          dados: null,
          naoAtendido: erro instanceof ErroApi && erro.codigo === 'REGION_NOT_SERVED',
        })
      })
    return () => controle.abort()
  }, [chaveCalendario, bairro, cidade, latitude, longitude])

  const calendarioAtual = calendario?.chave === chaveCalendario ? calendario : null
  const proxima = calendarioAtual?.dados ? proximaColeta(calendarioAtual.dados, hoje) : null

  function cartaoProximaColeta() {
    if (!bairro) {
      return (
        <>
          <h3 className="card__titulo">Informe seu endereço.</h3>
          <p className="texto-suave">
            {usuario
              ? 'Cadastre seu endereço no perfil para ver quando a coleta seletiva passa na sua rua.'
              : 'Entre e cadastre seu endereço para ver quando a coleta seletiva passa na sua rua.'}
          </p>
        </>
      )
    }
    if (!calendarioAtual) {
      return (
        <p className="texto-suave inicio__carregando" aria-busy="true">
          <LoaderCircle size={15} className="girando" aria-hidden="true" /> Consultando o calendário...
        </p>
      )
    }
    if (calendarioAtual.naoAtendido) {
      return (
        <>
          <h3 className="card__titulo">A coleta seletiva ainda não passa em {bairro}.</h3>
          <p className="texto-suave">Você pode levar seus recicláveis a um ponto de coleta.</p>
        </>
      )
    }
    if (!calendarioAtual.dados) {
      return (
        <>
          <h3 className="card__titulo">Calendário indisponível.</h3>
          <p className="texto-suave">Não foi possível consultar a próxima coleta agora.</p>
        </>
      )
    }
    if (!proxima) {
      return (
        <>
          <h3 className="card__titulo">Sem data prevista.</h3>
          <p className="texto-suave">A região do seu endereço ainda não tem dias de coleta cadastrados.</p>
        </>
      )
    }
    const quando = proxima.emDias === 0 ? 'Hoje' : proxima.emDias === 1 ? 'Amanhã' : null
    return (
      <>
        <h3 className="card__titulo">
          {quando && <span className="inicio__quando">{quando}, </span>}
          {quando ? dataPorExtenso(proxima.data).toLowerCase() : dataPorExtenso(proxima.data)}
        </h3>
        <p className="texto-suave">
          {proxima.coletas.map((c) => rotulosPeriodo[c.periodo]).join(' e ')} ·{' '}
          {listarNomes([
            ...new Set(proxima.coletas.flatMap((c) => c.categorias.map((cat) => cat.nome))),
          ])}
        </p>
      </>
    )
  }

  let dicaPontos: string
  if (pontosAtual && totalPontos === null) dicaPontos = 'Não foi possível consultar agora'
  else if (comLocal) dicaPontos = `A até ${RAIO_PONTOS_KM} km do seu endereço`
  else if (usuario) dicaPontos = 'Cadastre seu endereço para ver os mais perto'
  else dicaPontos = 'Pontos de coleta cadastrados'

  return (
    <div className="page inicio">
      {contaExcluida && !usuario && (
        <p className="alerta alerta--sucesso inicio__aviso" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          <span>Sua conta foi excluída e seus dados pessoais foram apagados.</span>
        </p>
      )}
      {/* Hero */}
      <section className="inicio__hero">
        <div>
          <p className="eyebrow">Descarte consciente, perto de você</p>
          <h1 className="inicio__titulo">
            O próximo passo
            <br />
            começa por aqui.
          </h1>
          <p className="inicio__subtitulo">
            Encontre o destino certo para seus recicláveis. Informação e coleta, no ritmo do seu
            bairro.
          </p>
          <div className="inicio__acoes">
            <Link to="/solicitacoes" className="btn btn--primario">
              Solicitar uma retirada <ArrowRight size={16} />
            </Link>
            <Link to="/pontos" className="btn btn--texto">
              Encontrar um ponto <MapPin size={16} />
            </Link>
          </div>
        </div>

        <div className="selo" aria-hidden="true">
          <span className="selo__anel selo__anel--externo" />
          <span className="selo__anel selo__anel--interno" />
          <span className="selo__ponto" />
          <span className="selo__texto selo__texto--topo">Cuidado local</span>
          <span className="selo__texto selo__texto--base">Impacto em ciclo</span>
          <span className="icon-circle icon-circle--xl">
            <Sprout size={26} strokeWidth={1.5} />
          </span>
        </div>
      </section>

      {/* Números */}
      <section className="inicio__stats">
        <div className="stat">
          <p className="stat__rotulo">Coletas concluídas</p>
          <p className="stat__valor">{usuario && coletas !== null ? coletas : '-'}</p>
          <p className="stat__dica">
            {usuario ? 'Desde que você entrou' : 'Entre para ver seu histórico'}
          </p>
        </div>
        <div className="stat">
          <p className="stat__rotulo">Pontos de entrega</p>
          <p className="stat__valor">{totalPontos ?? '-'}</p>
          <p className="stat__dica">{dicaPontos}</p>
        </div>
      </section>

      {/* Conteúdo */}
      <section className="inicio__grid">
        <div>
          <p className="eyebrow eyebrow--simples">Descarte com confiança</p>
          <div className="inicio__secao-topo">
            <h2 className="titulo-secao">Um bom destino para cada material.</h2>
            <Link to="/guia" className="link-seta">
              Ver o guia <ArrowRight size={15} />
            </Link>
          </div>

          {erroMateriais ? (
            <div className="alerta alerta--erro inicio__alerta" role="alert">
              <p>Não foi possível carregar os materiais agora.</p>
              <button
                type="button"
                className="btn btn--contorno btn--pequeno"
                onClick={recarregarMateriais}
              >
                <RotateCw size={14} /> Tentar novamente
              </button>
            </div>
          ) : !materiais ? (
            <p className="texto-suave inicio__carregando" aria-busy="true">
              <LoaderCircle size={15} className="girando" aria-hidden="true" /> Carregando materiais...
            </p>
          ) : (
            <ul className="materiais">
              {materiais.map((m, i) => (
                <li key={m.id}>
                  <Link
                    to={`/guia?categoria=${encodeURIComponent(m.categoria.slug)}`}
                    className="materiais__item"
                    title={`Ver ${m.categoria.nome} no guia de materiais`}
                  >
                    <span className="materiais__num">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{m.nome}</h3>
                      <p>{m.preparo}</p>
                    </div>
                    <span {...propsCategoria(m.categoria, 'tag')}>{m.categoria.nome}</span>
                    <ChevronRight size={16} className="materiais__seta" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="texto-nota">
            A aceitação varia por local. Confira os materiais cadastrados pelo ponto antes de se
            deslocar.
          </p>
        </div>

        <aside className="inicio__lateral">
          <div className="card">
            <div className="card__topo">
              <p className="eyebrow eyebrow--simples">Próxima coleta</p>
              <Clock size={16} className="texto-suave" />
            </div>
            <span className="icon-circle">
              <Calendar size={18} strokeWidth={1.75} />
            </span>
            {cartaoProximaColeta()}
            {calendarioAtual?.naoAtendido ? (
              <Link to="/pontos" className="link-seta">
                Ver pontos de coleta <ArrowRight size={15} />
              </Link>
            ) : (
              <Link to={bairro || !usuario ? '/calendario' : '/perfil'} className="link-seta">
                {bairro || !usuario ? 'Consultar calendário' : 'Cadastrar endereço'}{' '}
                <ArrowRight size={15} />
              </Link>
            )}
          </div>

          <div className="card card--verde">
            <p className="eyebrow eyebrow--simples eyebrow--icone">
              <span className="icon-circle icon-circle--sm">
                <Leaf size={13} />
              </span>
              Um bom começo
            </p>
            <p className="card__citacao">
              Separe os materiais por tipo e confirme o que o ponto de coleta aceita.
            </p>
          </div>
        </aside>
      </section>
    </div>
  )
}
