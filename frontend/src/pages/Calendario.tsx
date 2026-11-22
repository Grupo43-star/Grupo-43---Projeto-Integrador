import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Info,
  LoaderCircle,
  MapPin,
  RotateCw,
  X,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/useAuth'
import { ErroApi, mensagemDeErro } from '../services/api'
import {
  acharBairro,
  consultarCalendario,
  listarRegioes,
  type CalendarioColeta,
  type ColetaSemanal,
  type LocalCalendario,
  type Regiao,
} from '../services/calendario'
import { rotulosPeriodo } from '../services/pedidos'
import { diasSemana, diasSemanaCurtos } from '../utils/agenda'
import { dataDeIso, isoDeData, somarDias } from '../utils/formatar'
import './calendario.css'
import { propsCategoria } from '../utils/corCategoria'

const SEMANAS_A_FRENTE = 8

const formatoMes = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const formatoDiaMes = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

/** "nov." => "nov" */
function mesCurto(data: Date) {
  return formatoMes.format(data).replace('.', '')
}

/** "19 a 25 de novembro" ou "26 de novembro a 2 de dezembro" */
function rotuloSemana(inicio: Date, fim: Date) {
  if (inicio.getMonth() === fim.getMonth()) {
    return `${inicio.getDate()} a ${formatoDiaMes.format(fim)}`
  }
  return `${formatoDiaMes.format(inicio)} a ${formatoDiaMes.format(fim)}`
}

/** "A, B e C" */
function listarNomes(nomes: string[]) {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** "Coleta às terças e sextas" (dias distintos, de domingo a sábado) */
function resumoDias(semanal: ColetaSemanal[]) {
  const dias = [...new Set(semanal.map((c) => c.dia))]
  const nomes = dias.map((d) => {
    const nome = diasSemana[d].replace('-feira', '').toLowerCase()
    return d === 0 || d === 6 ? `aos ${nome}s` : `às ${nome}s`
  })
  // "às terças e às sextas" fica repetitivo: só o primeiro leva a preposição
  const [primeiro, ...resto] = nomes
  return listarNomes([primeiro, ...resto.map((n) => n.replace(/^(às|aos) /, ''))])
}

function ehCancelamento(erro: unknown) {
  return erro instanceof DOMException && erro.name === 'AbortError'
}

function Categorias({ coleta }: { coleta: ColetaSemanal }) {
  return (
    <ul className="calendario__materiais" aria-label="Materiais recolhidos">
      {coleta.categorias.map((c) => (
        <li key={c.id}>
          <Link
            to={`/guia?categoria=${encodeURIComponent(c.slug)}`}
            {...propsCategoria(c, 'tag')}
            title={`Ver ${c.nome} no guia de materiais`}
          >
            {c.nome}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Lista os bairros atendidos, por região, como botões que abrem o calendário de cada um. */
function BairrosAtendidos({
  regioes,
  escolher,
}: {
  regioes: Regiao[]
  escolher: (bairro: string, cidade: string) => void
}) {
  if (regioes.length === 0) return null
  return (
    <div className="calendario__atendidos">
      {regioes.map((r) => (
        <div key={r.id} className="calendario__regiao">
          <p className="calendario__regiao-nome">
            Região {r.nome} <span>· {r.cidade}/{r.uf}</span>
          </p>
          <ul className="calendario__bairros">
            {r.bairros.map((b) => (
              <li key={b}>
                <button
                  type="button"
                  className="calendario__bairro"
                  onClick={() => escolher(b, r.cidade)}
                >
                  <MapPin size={13} aria-hidden="true" />
                  {b}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// O bairro escolhido fica na URL (?bairro=...&cidade=...). Sem bairro na URL, quem tem
// endereço vê o calendário do próprio endereço; os outros escolhem um bairro atendido.
export default function Calendario() {
  const { usuario } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const [semana, setSemana] = useState(0)
  const [hoje] = useState(() => somarDias(new Date(), 0))
  const hojeIso = isoDeData(hoje)

  const bairroParam = (parametros.get('bairro') ?? '').trim()
  const cidadeParam = (parametros.get('cidade') ?? '').trim()
  const endereco = usuario?.endereco
  const meuBairro = endereco?.bairro.trim() || null

  // ---------- Regiões (bairros atendidos) ----------
  const [regioes, setRegioes] = useState<Regiao[]>([])
  const [estadoRegioes, setEstadoRegioes] = useState<'carregando' | 'pronto' | 'erro'>('carregando')
  const [tentativaRegioes, setTentativaRegioes] = useState(0)

  useEffect(() => {
    let ativo = true
    listarRegioes()
      .then((lista) => {
        if (!ativo) return
        setRegioes(lista)
        setEstadoRegioes('pronto')
      })
      .catch(() => {
        if (ativo) setEstadoRegioes('erro')
      })
    return () => {
      ativo = false
    }
  }, [tentativaRegioes])

  function recarregarRegioes() {
    setEstadoRegioes('carregando')
    setTentativaRegioes((n) => n + 1)
  }

  // ---------- Local consultado ----------
  let local: (LocalCalendario & { doEndereco: boolean }) | null = null
  if (bairroParam) {
    local = { bairro: bairroParam, cidade: cidadeParam || undefined, doEndereco: false }
  } else if (endereco && meuBairro) {
    local = {
      bairro: meuBairro,
      cidade: endereco.cidade,
      latitude: endereco.latitude,
      longitude: endereco.longitude,
      doEndereco: true,
    }
  }

  // ---------- Calendário ----------
  // Cada resultado guarda a chave da consulta: se a chave atual for outra, está carregando
  const [tentativa, setTentativa] = useState(0)
  const chave = local
    ? [tentativa, local.bairro, local.cidade, local.latitude, local.longitude].join('|')
    : ''
  const [resultado, setResultado] = useState<{
    chave: string
    calendario: CalendarioColeta | null
    erro: ErroApi | Error | null
  } | null>(null)

  const localBairro = local?.bairro
  const localCidade = local?.cidade
  const localLatitude = local?.latitude
  const localLongitude = local?.longitude

  useEffect(() => {
    if (!chave || !localBairro) return
    const controle = new AbortController()
    consultarCalendario(
      { bairro: localBairro, cidade: localCidade, latitude: localLatitude, longitude: localLongitude },
      controle.signal,
    )
      .then((calendario) => setResultado({ chave, calendario, erro: null }))
      .catch((erro: unknown) => {
        if (ehCancelamento(erro)) return
        setResultado({
          chave,
          calendario: null,
          erro: erro instanceof Error ? erro : new Error(mensagemDeErro(erro)),
        })
      })
    return () => controle.abort()
  }, [chave, localBairro, localCidade, localLatitude, localLongitude])

  const carregando = Boolean(local) && resultado?.chave !== chave
  // Ao trocar de bairro, o calendário anterior fica esmaecido até o novo chegar
  const calendario = resultado?.calendario ?? null
  const erro = !carregando ? resultado?.erro ?? null : null
  const naoAtendido = erro instanceof ErroApi && erro.codigo === 'REGION_NOT_SERVED'

  // ---------- Filtro ----------
  function escolherBairro(bairro: string, cidade: string) {
    setSemana(0)
    setParametros(
      (atuais) => {
        const novos = new URLSearchParams(atuais)
        if (bairro) {
          novos.set('bairro', bairro)
          if (cidade) novos.set('cidade', cidade)
          else novos.delete('cidade')
        } else {
          novos.delete('bairro')
          novos.delete('cidade')
        }
        return novos
      },
      { replace: true },
    )
  }

  function limparFiltros() {
    setSemana(0)
    setParametros({}, { replace: true })
  }

  // Valor do select: "bairro|cidade" com o nome oficial quando o bairro é atendido
  const achado = bairroParam ? acharBairro(regioes, bairroParam, cidadeParam) : null
  const valorSelect = bairroParam
    ? achado
      ? `${achado.bairro}|${achado.regiao.cidade}`
      : `${bairroParam}|${cidadeParam}`
    : ''
  const foraDaLista = Boolean(bairroParam) && !achado

  // ---------- Visão semanal (datas reais) ----------
  const semColetaPorData = new Map((calendario?.semColeta ?? []).map((d) => [d.data, d]))
  const inicioSemana = somarDias(hoje, semana * 7)
  const dias = Array.from({ length: 7 }, (_, i) => {
    const data = somarDias(inicioSemana, i)
    const iso = isoDeData(data)
    const coletas = (calendario?.semanal ?? []).filter((c) => c.dia === data.getDay())
    return { data, iso, coletas, semColeta: semColetaPorData.get(iso) ?? null }
  })
  const fimSemana = dias[6].data

  const regiaoAtual = calendario ? regioes.find((r) => r.id === calendario.regiao.id) : undefined
  const proximosSemColeta = (calendario?.semColeta ?? []).filter((d) => d.data >= hojeIso)

  let resumo = ''
  if (carregando) resumo = 'Carregando o calendário...'
  else if (calendario) {
    resumo =
      calendario.semanal.length > 0
        ? `Região ${calendario.regiao.nome} (${calendario.regiao.cidade}). Coleta seletiva ${resumoDias(calendario.semanal)}.`
        : `Região ${calendario.regiao.nome} (${calendario.regiao.cidade}).`
  }

  return (
    <div className="page calendario">
      <PageHeader
        eyebrow="Organize-se"
        titulo="Calendário de coleta"
        descricao="Veja em que dias a coleta seletiva passa no bairro, o que ela recolhe e as datas em que não acontece."
        icon={CalendarDays}
      />

      <form className="card calendario__filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="campo">
          <label htmlFor="calendario-bairro" className="campo__rotulo">
            Bairro
          </label>
          <select
            id="calendario-bairro"
            className="input"
            value={valorSelect}
            disabled={estadoRegioes === 'carregando' && !bairroParam}
            onChange={(e) => {
              const [bairro = '', cidade = ''] = e.target.value.split('|')
              escolherBairro(bairro, cidade)
            }}
          >
            <option value="">
              {estadoRegioes === 'carregando'
                ? 'Carregando bairros...'
                : meuBairro
                  ? `Meu endereço (${meuBairro})`
                  : 'Escolha um bairro'}
            </option>
            {foraDaLista && <option value={valorSelect}>{bairroParam}</option>}
            {regioes.map((r) => (
              <optgroup key={r.id} label={`Região ${r.nome} (${r.cidade}/${r.uf})`}>
                {r.bairros.map((b) => (
                  <option key={b} value={`${b}|${r.cidade}`}>
                    {b}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="campo__ajuda">Só aparecem os bairros onde a coleta seletiva já passa.</p>
        </div>

        {meuBairro && bairroParam && (
          <button type="button" className="calendario__meu-bairro" onClick={limparFiltros}>
            <Home size={14} aria-hidden="true" />
            Ver calendário do meu endereço ({meuBairro})
          </button>
        )}
      </form>

      {estadoRegioes === 'erro' && (
        <div className="alerta alerta--erro calendario__alerta" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <p>
            A lista de bairros atendidos não pôde ser carregada.
            {local ? ' O calendário abaixo continua valendo.' : ''}
          </p>
          <button type="button" className="btn btn--contorno btn--pequeno" onClick={recarregarRegioes}>
            <RotateCw size={14} /> Tentar novamente
          </button>
        </div>
      )}

      {(resumo || bairroParam) && (
        <div className="resumo-filtros">
          <p className="texto-suave" aria-live="polite">
            {resumo}
          </p>
          {bairroParam && (
            <button type="button" className="resumo-filtros__limpar" onClick={limparFiltros}>
              <X size={14} /> Limpar filtros
            </button>
          )}
        </div>
      )}

      {!local ? (
        <div className="card calendario__vazio">
          <span className="icon-circle">
            <MapPin size={20} strokeWidth={1.75} />
          </span>
          <h2 className="card__titulo">Escolha um bairro para ver o calendário.</h2>
          <p className="texto-suave">
            {usuario
              ? 'Cadastre seu endereço no perfil para ver o calendário do seu bairro direto, ou escolha um dos bairros atendidos.'
              : 'Escolha um dos bairros atendidos abaixo ou no campo Bairro.'}
          </p>
          {usuario && (
            <Link to="/perfil" className="btn btn--contorno">
              Cadastrar endereço <ArrowRight size={16} />
            </Link>
          )}
          {estadoRegioes === 'carregando' && (
            <LoaderCircle size={20} className="girando" aria-label="Carregando bairros" />
          )}
          <BairrosAtendidos regioes={regioes} escolher={escolherBairro} />
        </div>
      ) : carregando && !calendario ? (
        <div className="card calendario__vazio" aria-busy="true">
          <LoaderCircle size={22} className="girando" aria-hidden="true" />
          <p className="texto-suave">Carregando o calendário de {local.bairro}...</p>
        </div>
      ) : naoAtendido ? (
        <div className="card calendario__vazio">
          <span className="icon-circle">
            <CalendarOff size={20} strokeWidth={1.75} />
          </span>
          <h2 className="card__titulo">{erro?.message}</h2>
          <p className="texto-suave">
            {local.doEndereco
              ? `A coleta seletiva ainda não passa no bairro do seu endereço (${local.bairro}). Você pode levar seus recicláveis a um ponto de coleta.`
              : `A coleta seletiva ainda não passa em ${local.bairro}. Você pode levar seus recicláveis a um ponto de coleta.`}
          </p>
          <div className="calendario__vazio-acoes">
            {bairroParam && (
              <button type="button" className="btn btn--contorno" onClick={limparFiltros}>
                Limpar filtros
              </button>
            )}
            <Link to="/pontos" className="btn btn--primario">
              Ver pontos de coleta <ArrowRight size={16} />
            </Link>
          </div>
          {regioes.length > 0 && (
            <>
              <p className="calendario__atendidos-titulo">Bairros atendidos</p>
              <BairrosAtendidos regioes={regioes} escolher={escolherBairro} />
            </>
          )}
        </div>
      ) : erro || !calendario ? (
        <div className="alerta alerta--erro calendario__alerta" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <p>Não foi possível carregar o calendário agora. {erro?.message}</p>
          <button
            type="button"
            className="btn btn--contorno btn--pequeno"
            onClick={() => setTentativa((n) => n + 1)}
          >
            <RotateCw size={14} /> Tentar novamente
          </button>
        </div>
      ) : (
        <div
          className={carregando ? 'calendario__conteudo calendario__conteudo--atualizando' : 'calendario__conteudo'}
          aria-busy={carregando}
        >
          {regiaoAtual && regiaoAtual.bairros.length > 1 && (
            <p className="alerta alerta--info calendario__alerta">
              <Info size={18} aria-hidden="true" />
              <span>
                O mesmo calendário vale para {listarNomes(regiaoAtual.bairros)}.
              </span>
            </p>
          )}

          <section className="calendario__secao" aria-labelledby="calendario-toda-semana">
            <div className="calendario__cabecalho">
              <div>
                <h2 id="calendario-toda-semana" className="titulo-secao">
                  Toda semana
                </h2>
                <p className="texto-suave">Dias fixos da coleta seletiva e o que ela recolhe.</p>
              </div>
            </div>

            {calendario.semanal.length > 0 ? (
              <ul className="calendario__fixos">
                {calendario.semanal.map((c) => (
                  <li key={c.id} className="card calendario__fixo">
                    <div className="calendario__fixo-topo">
                      <h3 className="card__titulo">{diasSemana[c.dia]}</h3>
                      <span className="calendario__periodo">
                        <Clock size={13} aria-hidden="true" /> {rotulosPeriodo[c.periodo]}
                      </span>
                    </div>
                    <Categorias coleta={c} />
                    {c.observacao && <p className="calendario__observacao">{c.observacao}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card calendario__sem-unicas texto-suave">
                Esta região ainda não tem dias de coleta cadastrados.
              </p>
            )}
          </section>

          <section className="calendario__secao" aria-labelledby="calendario-semana-titulo">
            <div className="calendario__cabecalho">
              <div>
                <h2 id="calendario-semana-titulo" className="titulo-secao">
                  {semana === 0 ? 'Próximos 7 dias' : 'Semana'}
                </h2>
                <p className="texto-suave" aria-live="polite">
                  {rotuloSemana(inicioSemana, fimSemana)}
                </p>
              </div>
              <div className="calendario__navegacao">
                {semana > 0 && (
                  <button
                    type="button"
                    className="btn btn--contorno btn--pequeno"
                    onClick={() => setSemana(0)}
                  >
                    Hoje
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--contorno btn--pequeno calendario__seta"
                  onClick={() => setSemana((s) => s - 1)}
                  disabled={semana === 0}
                  aria-label="Semana anterior"
                  title="Semana anterior"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  className="btn btn--contorno btn--pequeno calendario__seta"
                  onClick={() => setSemana((s) => s + 1)}
                  disabled={semana === SEMANAS_A_FRENTE - 1}
                  aria-label="Próxima semana"
                  title="Próxima semana"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <ol className="calendario__dias">
              {dias.map(({ data, iso, coletas, semColeta }) => {
                const ehHoje = iso === hojeIso
                const vazio = coletas.length === 0
                return (
                  <li
                    key={iso}
                    className={[
                      'card calendario__dia',
                      ehHoje ? 'calendario__dia--hoje' : '',
                      vazio ? 'calendario__dia--vazio' : '',
                    ].join(' ')}
                    aria-current={ehHoje ? 'date' : undefined}
                  >
                    <div className="calendario__data">
                      <span className="calendario__dia-semana">
                        {diasSemanaCurtos[data.getDay()]}
                      </span>
                      <span className="calendario__dia-numero">{data.getDate()}</span>
                      <span className="calendario__mes">{mesCurto(data)}</span>
                      {ehHoje && <span className="calendario__hoje">Hoje</span>}
                    </div>

                    {vazio ? (
                      <p className="calendario__sem">Sem coleta seletiva neste dia.</p>
                    ) : semColeta ? (
                      <ul className="calendario__entradas">
                        <li className="calendario__entrada calendario__entrada--fechado">
                          <span className="calendario__horario">
                            <CalendarOff size={13} aria-hidden="true" /> Sem coleta
                          </span>
                          <span className="calendario__ponto">{semColeta.motivo}</span>
                          <span className="calendario__local">
                            A coleta de {coletas.map((c) => rotulosPeriodo[c.periodo].toLowerCase()).join(' e ')}{' '}
                            não acontece neste dia.
                          </span>
                        </li>
                      </ul>
                    ) : (
                      <ul className="calendario__entradas">
                        {coletas.map((c) => (
                          <li key={c.id} className="calendario__entrada">
                            <span className="calendario__horario">
                              <Clock size={13} aria-hidden="true" /> {rotulosPeriodo[c.periodo]}
                            </span>
                            <span className="calendario__local">
                              {listarNomes(c.categorias.map((cat) => cat.nome))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="calendario__secao" aria-labelledby="calendario-sem-coleta-titulo">
            <div className="calendario__cabecalho">
              <div>
                <h2 id="calendario-sem-coleta-titulo" className="titulo-secao">
                  Dias sem coleta
                </h2>
                <p className="texto-suave">Feriados e outras datas em que a coleta não passa.</p>
              </div>
            </div>

            {proximosSemColeta.length > 0 ? (
              <ul className="calendario__unicas">
                {proximosSemColeta.map((d) => {
                  const data = dataDeIso(d.data)
                  return (
                    <li key={d.id} className="card calendario__unica calendario__unica--fechado">
                      <div className="calendario__unica-data" aria-hidden="true">
                        <span className="calendario__dia-semana">
                          {diasSemanaCurtos[data.getDay()]}
                        </span>
                        <span className="calendario__dia-numero">{data.getDate()}</span>
                        <span className="calendario__mes">{mesCurto(data)}</span>
                      </div>
                      <div className="calendario__unica-corpo">
                        <span className="calendario__tipo calendario__tipo--fechado">Sem coleta</span>
                        <h3 className="card__titulo">
                          <span className="sr-only">
                            {diasSemana[data.getDay()]}, {formatoDiaMes.format(data)}:{' '}
                          </span>
                          {d.motivo}
                        </h3>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="card calendario__sem-unicas texto-suave">
                Nenhum dia sem coleta previsto por enquanto.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
