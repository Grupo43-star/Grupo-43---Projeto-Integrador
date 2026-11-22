import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock,
  ExternalLink,
  Info,
  LoaderCircle,
  MapPin,
  MapPinOff,
  Navigation,
  Phone,
  RotateCw,
  Truck,
} from 'lucide-react'
import { ErroApi, mensagemDeErro } from '../services/api'
import { buscarPonto, enderecoDoPonto, linkDoMapa, nomeDoTipo, type Ponto } from '../services/pontos'
import { diasSemana, formatarDistancia, ordemSemana, rotuloHorario } from '../utils/agenda'
import { propsCategoria } from '../utils/corCategoria'
import './pontos.css' // tipo, aberto/fechado e orientações iguais aos do cartão
import './detalhe.css'

const MapaDoPonto = lazy(() => import('../components/MapaDoPonto'))

type Resultado =
  | { chave: string; ponto: Ponto; erro?: undefined }
  | { chave: string; erro: unknown; ponto?: undefined }

interface EstadoNavegacao {
  /** Dados do cartão da lista: aparecem na hora, enquanto o back responde */
  ponto?: Ponto
  /** Lista de onde veio, com os filtros (ex.: /pontos?material=vidro) */
  de?: string
}

/** 404 (não existe ou foi desativado) e 400 (id que não é UUID) */
const naoEncontrado = (erro: unknown) =>
  erro instanceof ErroApi && (erro.status === 404 || erro.status === 400)

// Detalhe de um ponto de coleta: GET /collection-points/:id (rota pública).
export default function DetalhePonto() {
  const { id = '' } = useParams()
  const estado = (useLocation().state ?? {}) as EstadoNavegacao
  const voltarPara = estado.de?.startsWith('/pontos') ? estado.de : '/pontos'
  const previa = estado.ponto?.id === id ? estado.ponto : undefined

  const [tentativa, setTentativa] = useState(0)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const chave = `${id}|${tentativa}`

  useEffect(() => {
    const controle = new AbortController()
    buscarPonto(id, controle.signal)
      .then((ponto) => setResultado({ chave, ponto }))
      .catch((erro) => {
        if (!controle.signal.aborted) setResultado({ chave, erro })
      })
    return () => controle.abort()
  }, [id, chave])

  const atual = resultado?.chave === chave ? resultado : null
  const carregando = !atual
  // A distância só existe na busca da lista (com a localização): mantém a do cartão
  const ponto = atual?.ponto
    ? { ...atual.ponto, distanciaKm: atual.ponto.distanciaKm ?? previa?.distanciaKm ?? null }
    : atual?.erro
      ? undefined
      : previa

  return (
    <div className="page detalhe">
      <Link to={voltarPara} className="voltar">
        <ArrowLeft size={16} aria-hidden="true" /> Pontos de coleta
      </Link>

      {atual?.erro ? (
        naoEncontrado(atual.erro) ? (
          <div className="card detalhe__vazio">
            <span className="icon-circle">
              <MapPinOff size={20} strokeWidth={1.75} />
            </span>
            <h1 className="card__titulo">Ponto de coleta não encontrado.</h1>
            <p className="texto-suave">
              Ele pode ter sido desativado ou o link está incompleto. Veja a lista atualizada de pontos.
            </p>
            <Link to="/pontos" className="btn btn--primario">
              Ver pontos de coleta <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="alerta alerta--erro detalhe__erro" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>Não foi possível carregar este ponto agora. {mensagemDeErro(atual.erro)}</span>
            <button
              type="button"
              className="btn btn--contorno btn--pequeno"
              onClick={() => setTentativa((t) => t + 1)}
            >
              <RotateCw size={14} /> Tentar novamente
            </button>
          </div>
        )
      ) : !ponto ? (
        <div className="card detalhe__vazio" aria-busy="true">
          <LoaderCircle size={22} className="girando" aria-hidden="true" />
          <p className="texto-suave">Carregando o ponto de coleta...</p>
        </div>
      ) : (
        <ConteudoPonto ponto={ponto} carregando={carregando} />
      )}
    </div>
  )
}

function ConteudoPonto({ ponto: p, carregando }: { ponto: Ponto; carregando: boolean }) {
  const [hoje] = useState(() => new Date().getDay())

  return (
    <div aria-busy={carregando}>
      <header className="detalhe__cabecalho">
        <div className="detalhe__cabecalho-topo">
          <span className="pontos__tipo">{nomeDoTipo(p.tipo)}</span>
          <span className={`pontos__status ${p.abertoAgora ? 'pontos__status--aberto' : ''}`}>
            {p.abertoAgora ? 'Aberto agora' : 'Fechado agora'}
          </span>
          {carregando && (
            <span className="detalhe__atualizando">
              <LoaderCircle size={13} className="girando" aria-hidden="true" /> Atualizando...
            </span>
          )}
        </div>
        <h1 className="page-header__titulo">{p.nome}</h1>
        <p className="detalhe__linha">
          <MapPin size={15} aria-hidden="true" />
          <span>
            {enderecoDoPonto(p)}
            {p.cep && ` - CEP ${p.cep}`}
          </span>
        </p>
        {p.distanciaKm !== null && (
          <p className="detalhe__linha detalhe__linha--forte">
            <Navigation size={14} aria-hidden="true" />a {formatarDistancia(p.distanciaKm)} de você
          </p>
        )}
        {p.cooperativa && (
          <p className="detalhe__linha">
            <Building2 size={14} aria-hidden="true" />
            Responsável: {p.cooperativa}
          </p>
        )}
      </header>

      <div className="detalhe__grid">
        <div className="detalhe__principal">
          <section className="card detalhe__secao" aria-labelledby="titulo-mapa">
            <h2 id="titulo-mapa" className="detalhe__titulo">
              Onde fica
            </h2>
            <Suspense
              fallback={
                <div className="mapa-endereco__vazio">
                  <LoaderCircle size={18} className="girando" aria-hidden="true" />
                  <span>Carregando o mapa...</span>
                </div>
              }
            >
              <MapaDoPonto latitude={p.latitude} longitude={p.longitude} nome={p.nome} />
            </Suspense>
            <div className="detalhe__acoes">
              <a href={linkDoMapa(p)} target="_blank" rel="noreferrer" className="btn btn--primario">
                Como chegar <ExternalLink size={15} aria-hidden="true" />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
              {p.telefone && (
                <a href={`tel:${p.telefone.replace(/[^\d+]/g, '')}`} className="btn btn--contorno">
                  <Phone size={15} aria-hidden="true" /> {p.telefone}
                </a>
              )}
            </div>
            {p.orientacoes && (
              <p className="pontos__orientacoes">
                <Info size={14} aria-hidden="true" />
                <span>{p.orientacoes}</span>
              </p>
            )}
          </section>

          <section className="card detalhe__secao" aria-labelledby="titulo-aceita">
            <h2 id="titulo-aceita" className="detalhe__titulo">
              O que este ponto aceita
            </h2>
            {p.categorias.length === 0 ? (
              <p className="texto-suave">Este ponto ainda não informou os materiais que recebe.</p>
            ) : (
              <ul className="detalhe-ponto__aceita">
                {p.categorias.map((c) => (
                  <li key={c.id}>
                    <span {...propsCategoria(c, 'tag')}>{c.nome}</span>
                    {c.descricao && <span className="texto-suave">{c.descricao}</span>}
                    <Link to={`/guia?categoria=${c.slug}`} className="link-seta">
                      Ver no guia <ArrowRight size={13} aria-hidden="true" />
                      <span className="sr-only">: {c.nome}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="detalhe__lateral">
          <section className="card detalhe__secao" aria-labelledby="titulo-horario">
            <h2 id="titulo-horario" className="detalhe__titulo">
              <Clock size={16} aria-hidden="true" /> Horário de funcionamento
            </h2>
            {p.horarios.length === 0 ? (
              <p className="texto-suave">Horário não informado.</p>
            ) : (
              <table className="detalhe-ponto__horarios">
                <caption className="sr-only">Horário de funcionamento por dia da semana</caption>
                <tbody>
                  {ordemSemana.map((dia) => {
                    const doDia = p.horarios.filter((h) => h.dia === dia)
                    return (
                      <tr
                        key={dia}
                        className={dia === hoje ? 'detalhe-ponto__hoje' : ''}
                        aria-current={dia === hoje ? 'date' : undefined}
                      >
                        <th scope="row">
                          {diasSemana[dia]}
                          {dia === hoje && <span className="detalhe-ponto__selo">Hoje</span>}
                        </th>
                        <td className={doDia.length === 0 ? 'detalhe-ponto__fechado' : ''}>
                          {doDia.length === 0
                            ? 'Fechado'
                            : doDia.map((h) => (
                                <span key={h.inicio} className="detalhe-ponto__faixa">
                                  {rotuloHorario(h)}
                                </span>
                              ))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {p.regiao && <p className="campo__ajuda">Fica na região {p.regiao}.</p>}
          </section>

          <section className="card card--verde detalhe__secao">
            <h2 className="detalhe__titulo">Não dá para levar?</h2>
            <p className="texto-suave">Peça uma retirada no seu endereço e a cooperativa agenda a coleta.</p>
            <Link to="/solicitacoes" className="link-seta">
              <Truck size={15} aria-hidden="true" /> Solicitar retirada <ArrowRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}
