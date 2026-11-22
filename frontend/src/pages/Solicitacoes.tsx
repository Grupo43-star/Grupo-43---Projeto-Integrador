import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Info,
  LoaderCircle,
  MapPin,
  PackageOpen,
  Phone,
  RotateCw,
  Truck,
} from 'lucide-react'
import CancelarPedido from '../components/CancelarPedido'
import EtapasPedido from '../components/EtapasPedido'
import PageHeader from '../components/PageHeader'
import { RegiaoDoEndereco } from '../components/OutrosEnderecos'
import { useAuth } from '../context/useAuth'
import type { Usuario } from '../data/usuario'
import { ErroApi, mensagemDeErro } from '../services/api'
import { listarCategorias, type CategoriaGuia } from '../services/materiais'
import {
  cancelarPedido,
  criarPedido,
  listarPedidos,
  QUANTIDADE_MAXIMA,
  QUANTIDADE_MINIMA,
  rotulosPeriodo,
  rotulosStatus,
  rotulosUnidade,
  statusAbertos,
  type Pedido,
  type PeriodoRetirada,
  type UnidadeQuantidade,
} from '../services/pedidos'
import { diasSemanaCurtos } from '../utils/agenda'
import {
  bairroECidade,
  dataDeIso,
  dataPorExtenso,
  isoDeData,
  ruaENumero,
  somarDias,
  tituloDoEndereco,
} from '../utils/formatar'
import { LIMITES } from '../utils/validar'
import {
  classeStatus,
  dataDoPedido,
  notaDoPedido,
  rotuloQuantidade,
  telefoneDaCooperativa,
} from '../utils/pedido'
import './solicitacoes.css'
import { propsCategoria } from '../utils/corCategoria'

/** A grade de datas mostra 2 semanas por vez, a partir de hoje */
const DIAS_POR_PAGINA = 14
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** Pedidos anteriores carregados por vez */
const ANTERIORES_POR_PAGINA = 3
/** Categorias que vão separadas do resto */
const SLUGS_SEPARAR = ['eletronicos', 'pilhas-e-baterias']

const formatoDiaMes = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })
const formatoNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** "20 de novembro a 3 de dezembro" ou "4 a 17 de dezembro" */
function rotuloIntervalo(inicio: Date, fim: Date) {
  if (inicio.getMonth() === fim.getMonth()) return `${inicio.getDate()} a ${formatoDiaMes.format(fim)}`
  return `${formatoDiaMes.format(inicio)} a ${formatoDiaMes.format(fim)}`
}

function opcoesDeData(hoje: Date, pagina: number) {
  const opcoes: { iso: string; data: Date }[] = []
  const primeiro = pagina * DIAS_POR_PAGINA
  for (let i = primeiro; i < primeiro + DIAS_POR_PAGINA; i++) {
    const data = somarDias(hoje, i)
    opcoes.push({ iso: isoDeData(data), data })
  }
  return opcoes
}

/** Aceita vírgula ou ponto: "1,5" -> 1.5 */
function lerQuantidade(texto: string) {
  const valor = Number(texto.replace(',', '.'))
  return texto.trim() && Number.isFinite(valor) ? valor : null
}

export default function Solicitacoes() {
  const { usuario } = useAuth()

  return (
    <div className="page">
      <PageHeader
        eyebrow="Do pedido à coleta"
        titulo="Solicitar uma retirada"
        descricao="Informe os materiais e sua disponibilidade. Enviar um pedido não confirma uma coleta: a cooperativa analisa e agenda a data."
        icon={Truck}
      />
      {/* `key` recria a tela se a pessoa logada mudar */}
      {usuario ? <SolicitacoesLogado key={usuario.id} usuario={usuario} /> : <ConviteEntrar />}
    </div>
  )
}

function ConviteEntrar() {
  return (
    <div className="card card--row solicitar__convite">
      <span className="icon-circle icon-circle--lg">
        <Truck size={20} strokeWidth={1.75} />
      </span>
      <div className="solicitar__convite-texto">
        <p className="eyebrow eyebrow--simples">Acesso à sua conta</p>
        <h2 className="card__titulo">Entre para solicitar e acompanhar.</h2>
        <p className="texto-suave">
          O histórico e o envio de pedidos ficam disponíveis somente para a pessoa autenticada.
        </p>
        <Link to="/entrar" state={{ de: '/solicitacoes' }} className="btn btn--primario">
          Entrar para continuar <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}

// ---------- Logado ----------

interface ItemForm {
  quantidade: string
  unidade: UnidadeQuantidade
}

interface FormPedido {
  itens: Record<string, ItemForm> // por id da categoria
  data: string // '' = sem preferência
  periodo: PeriodoRetirada | ''
  observacoes: string
}

const formVazio: FormPedido = { itens: {}, data: '', periodo: '', observacoes: '' }

interface ErrosPedido {
  materiais?: string
  quantidades?: Record<string, string>
}

interface Anteriores {
  itens: Pedido[]
  total: number
  pagina: number
  totalPaginas: number
}

function SolicitacoesLogado({ usuario }: { usuario: Usuario }) {
  // Categorias de material (GET /material-categories)
  const [categorias, setCategorias] = useState<CategoriaGuia[] | null>(null)
  const [erroCategorias, setErroCategorias] = useState(false)
  const [tentativaCategorias, setTentativaCategorias] = useState(0)

  // Pedidos (GET /pickup-requests?open=true|false)
  const [abertos, setAbertos] = useState<Pedido[] | null>(null)
  const [anteriores, setAnteriores] = useState<Anteriores | null>(null)
  const [erroPedidos, setErroPedidos] = useState('')
  const [tentativaPedidos, setTentativaPedidos] = useState(0)

  const [form, setForm] = useState<FormPedido>(formVazio)
  const [erros, setErros] = useState<ErrosPedido>({})
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<{ mensagem: string; semAtendimento: boolean } | null>(null)
  const [enviado, setEnviado] = useState<Pedido | null>(null)
  const sucessoRef = useRef<HTMLDivElement>(null)

  const [hoje] = useState(() => new Date())
  const [paginaDatas, setPaginaDatas] = useState(0)
  const datas = opcoesDeData(hoje, paginaDatas)
  const inicioPagina = datas[0].data
  const fimPagina = datas[datas.length - 1].data
  const dataForaDaPagina = form.data !== '' && !datas.some((d) => d.iso === form.data)

  const temEndereco = usuario.enderecoId !== null
  // Endereço da retirada: o escolhido (se ainda existir) ou o principal
  const [enderecoEscolhido, setEnderecoEscolhido] = useState<string | null>(null)
  const enderecoSelecionado =
    usuario.enderecos.find((e) => e.id === enderecoEscolhido) ??
    usuario.enderecos.find((e) => e.id === usuario.enderecoId) ??
    null
  const selecionadas = (categorias ?? []).filter((c) => c.id in form.itens)

  useEffect(() => {
    const controle = new AbortController()
    listarCategorias(controle.signal)
      .then((lista) => {
        setCategorias(lista)
        setErroCategorias(false)
      })
      .catch(() => {
        if (!controle.signal.aborted) setErroCategorias(true)
      })
    return () => controle.abort()
  }, [tentativaCategorias])

  useEffect(() => {
    const controle = new AbortController()
    Promise.all([
      listarPedidos({ abertos: true, limite: 100 }, controle.signal),
      listarPedidos({ abertos: false, limite: ANTERIORES_POR_PAGINA }, controle.signal),
    ])
      .then(([pagAbertos, pagAnteriores]) => {
        setAbertos(pagAbertos.items)
        setAnteriores({
          itens: pagAnteriores.items,
          total: pagAnteriores.total,
          pagina: 1,
          totalPaginas: pagAnteriores.totalPages,
        })
        setErroPedidos('')
      })
      .catch((erro) => {
        if (!controle.signal.aborted) setErroPedidos(mensagemDeErro(erro))
      })
    return () => controle.abort()
  }, [usuario.id, tentativaPedidos])

  // Pedido enviado: leva a pessoa (e o leitor de tela) até o aviso de sucesso
  useEffect(() => {
    if (!enviado) return
    sucessoRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    sucessoRef.current?.focus({ preventScroll: true })
  }, [enviado])

  function tentarPedidosDeNovo() {
    setErroPedidos('')
    setAbertos(null)
    setAnteriores(null)
    setTentativaPedidos((t) => t + 1)
  }

  async function carregarMaisAnteriores() {
    if (!anteriores) return
    const pagina = await listarPedidos({
      abertos: false,
      pagina: anteriores.pagina + 1,
      limite: ANTERIORES_POR_PAGINA,
    })
    setAnteriores((atual) =>
      atual && {
        // Um pedido cancelado aqui já entrou no topo: não repete
        itens: [...atual.itens, ...pagina.items.filter((p) => !atual.itens.some((a) => a.id === p.id))],
        total: pagina.total,
        pagina: pagina.page,
        totalPaginas: pagina.totalPages,
      },
    )
  }

  function alterar(parcial: Partial<FormPedido>) {
    setForm((atual) => ({ ...atual, ...parcial }))
    setEnviado(null)
    setErroEnvio(null)
  }

  function alternarMaterial(id: string) {
    const itens = { ...form.itens }
    if (id in itens) delete itens[id]
    else itens[id] = { quantidade: '', unidade: 'SACOS' }
    alterar({ itens })
    setErros((atual) => {
      const quantidades = { ...atual.quantidades }
      delete quantidades[id]
      return { quantidades }
    })
  }

  function alterarItem(id: string, parcial: Partial<ItemForm>) {
    alterar({ itens: { ...form.itens, [id]: { ...form.itens[id], ...parcial } } })
    setErros((atual) => {
      const quantidades = { ...atual.quantidades }
      delete quantidades[id]
      return { ...atual, quantidades }
    })
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (!enderecoSelecionado) return

    const novos: ErrosPedido = {}
    const quantidades: Record<string, string> = {}
    if (selecionadas.length === 0) novos.materiais = 'Escolha pelo menos um material.'
    for (const c of selecionadas) {
      const valor = lerQuantidade(form.itens[c.id].quantidade)
      if (valor === null || valor < QUANTIDADE_MINIMA) quantidades[c.id] = 'Informe uma quantidade maior que zero.'
      else if (valor > QUANTIDADE_MAXIMA) quantidades[c.id] = `No máximo ${formatoNumero.format(QUANTIDADE_MAXIMA)}.`
    }
    if (Object.keys(quantidades).length > 0) novos.quantidades = quantidades
    setErros(novos)

    if (novos.materiais || novos.quantidades) {
      // Leva a pessoa até o primeiro campo com problema
      setTimeout(() => {
        document
          .querySelector('.solicitar__form .campo__erro')
          ?.closest('.campo, fieldset')
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
      return
    }

    setEnviando(true)
    setErroEnvio(null)
    try {
      const pedido = await criarPedido({
        enderecoId: enderecoSelecionado.id,
        itens: selecionadas.map((c) => ({
          categoriaId: c.id,
          quantidade: lerQuantidade(form.itens[c.id].quantidade) as number,
          unidade: form.itens[c.id].unidade,
        })),
        dataPreferida: form.data || null,
        periodoPreferido: form.periodo || null,
        observacoes: form.observacoes,
      })
      setAbertos((atual) => [pedido, ...(atual ?? [])])
      setForm(formVazio)
      setPaginaDatas(0)
      setEnviado(pedido)
    } catch (erro) {
      setErroEnvio({
        mensagem: mensagemDeErro(erro, 'Não foi possível enviar o pedido agora. Tente de novo em instantes.'),
        semAtendimento: erro instanceof ErroApi && erro.codigo === 'REGION_NOT_SERVED',
      })
    } finally {
      setEnviando(false)
    }
  }

  async function aoCancelar(id: string, motivo: string) {
    const cancelado = await cancelarPedido(id, motivo)
    setAbertos((atual) => (atual ?? []).filter((p) => p.id !== id))
    setAnteriores((atual) => atual && { ...atual, itens: [cancelado, ...atual.itens], total: atual.total + 1 })
    if (enviado?.id === id) setEnviado(null)
  }

  const quantosAbertos = abertos?.length ?? 0

  return (
    <>
      {quantosAbertos > 0 && (
        <a href="#seus-pedidos" className="alerta alerta--info solicitar__atalho">
          <Info size={16} />
          <span>
            Você tem {quantosAbertos} {quantosAbertos === 1 ? 'pedido em andamento' : 'pedidos em andamento'}.{' '}
            <strong>
              Ver pedidos <ArrowDown size={13} />
            </strong>
          </span>
        </a>
      )}

      <div className="solicitar__grid">
        {!temEndereco ? (
          <div className="card card--row solicitar__sem-endereco">
            <span className="icon-circle icon-circle--lg">
              <MapPin size={20} strokeWidth={1.75} />
            </span>
            <div className="solicitar__convite-texto">
              <p className="eyebrow eyebrow--simples">Falta um passo</p>
              <h2 className="card__titulo">Cadastre seu endereço para pedir uma retirada.</h2>
              <p className="texto-suave">
                A retirada é feita no endereço do seu perfil. Depois de salvar, é só voltar aqui.
              </p>
              <Link to="/perfil" className="btn btn--primario">
                Cadastrar endereço <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <form className="solicitar__form" onSubmit={aoEnviar} noValidate>
            {enviado && (
              <div
                ref={sucessoRef}
                tabIndex={-1}
                role="status"
                className="alerta alerta--sucesso solicitar__sucesso"
              >
                <Check size={16} />
                <span>
                  <strong>Pedido {enviado.protocolo} enviado.</strong> Uma cooperativa vai analisar e
                  agendar a data. Acompanhe o andamento em "Seus pedidos".
                </span>
              </div>
            )}

            <section className="card solicitar__secao">
              <h2 className="solicitar__secao-titulo">
                <span className="solicitar__passo">1</span> Local da retirada
              </h2>
              {usuario.enderecos.length > 1 ? (
                <fieldset className="solicitar__grupo-campos">
                  <legend className="campo__rotulo campo__rotulo--obrigatorio">
                    Onde a retirada vai acontecer
                  </legend>
                  <div className="escolhas solicitar__enderecos">
                    {usuario.enderecos.map((e) => {
                      const marcado = e.id === enderecoSelecionado?.id
                      return (
                        <label key={e.id} className={`escolha ${marcado ? 'escolha--marcada' : ''}`}>
                          <input
                            type="radio"
                            className="escolha__input"
                            name="endereco"
                            value={e.id}
                            checked={marcado}
                            onChange={() => {
                              setEnderecoEscolhido(e.id)
                              setEnviado(null)
                              setErroEnvio(null)
                            }}
                          />
                          <MapPin size={18} strokeWidth={1.75} className="escolha__icone" aria-hidden="true" />
                          <span className="escolha__texto">
                            <strong>
                              {tituloDoEndereco(e)}
                              {e.principal && <span className="tag solicitar__principal">Principal</span>}
                            </strong>
                            {e.nome.trim() && <small>{ruaENumero(e.endereco)}</small>}
                            <small>{bairroECidade(e.endereco)}</small>
                            <RegiaoDoEndereco endereco={e} />
                          </span>
                          <Check size={15} className="escolha__check" aria-hidden="true" />
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ) : (
                enderecoSelecionado && (
                  <div className="solicitar__local">
                    <MapPin size={18} strokeWidth={1.75} aria-hidden="true" />
                    <p>
                      <strong>{ruaENumero(enderecoSelecionado.endereco)}</strong>
                      <span>{bairroECidade(enderecoSelecionado.endereco)}</span>
                      {!enderecoSelecionado.regiao && <RegiaoDoEndereco endereco={enderecoSelecionado} />}
                    </p>
                  </div>
                )
              )}
              <p className="campo__ajuda">
                {usuario.enderecos.length > 1
                  ? 'Os endereços são cadastrados no seu perfil.'
                  : 'A retirada é feita no endereço do seu perfil. Para pedir em outro local, cadastre mais um endereço.'}{' '}
                <Link to="/perfil" className="solicitar__link">
                  {usuario.enderecos.length > 1 ? 'Gerenciar endereços' : 'Alterar no perfil'}
                </Link>
              </p>
            </section>

            <section className="card solicitar__secao">
              <h2 className="solicitar__secao-titulo">
                <span className="solicitar__passo">2</span> O que vai ser retirado
              </h2>

              <fieldset className="solicitar__grupo-campos">
                <legend className="campo__rotulo campo__rotulo--obrigatorio">Materiais</legend>
                {erroCategorias ? (
                  <div className="alerta alerta--erro solicitar__erro-tentar" role="alert">
                    <CircleAlert size={16} />
                    <span>A lista de materiais não pôde ser carregada.</span>
                    <button
                      type="button"
                      className="btn btn--contorno btn--pequeno"
                      onClick={() => {
                        setErroCategorias(false)
                        setTentativaCategorias((t) => t + 1)
                      }}
                    >
                      <RotateCw size={14} /> Tentar novamente
                    </button>
                  </div>
                ) : categorias === null ? (
                  <p className="texto-suave solicitar__carregando">
                    <LoaderCircle size={16} className="girando" /> Carregando materiais...
                  </p>
                ) : (
                  <div className="escolhas escolhas--materiais">
                    {categorias.map((c) => {
                      const marcado = c.id in form.itens
                      return (
                        <label key={c.id} className={`escolha ${marcado ? 'escolha--marcada' : ''}`}>
                          <input
                            type="checkbox"
                            className="escolha__input"
                            name="materiais"
                            value={c.id}
                            checked={marcado}
                            onChange={() => alternarMaterial(c.id)}
                          />
                          <span {...propsCategoria(c, 'escolha__cor')} aria-hidden="true" />
                          <span className="escolha__texto">
                            <strong>{c.nome}</strong>
                            {c.descricao && <small>{c.descricao}</small>}
                          </span>
                          <Check size={15} className="escolha__check" aria-hidden="true" />
                        </label>
                      )
                    })}
                  </div>
                )}
                {erros.materiais ? (
                  <span className="campo__erro">{erros.materiais}</span>
                ) : (
                  <span className="campo__ajuda">
                    Na dúvida sobre o que separar, consulte o{' '}
                    <Link to="/guia" className="solicitar__link">
                      guia de materiais
                    </Link>
                    .
                  </span>
                )}
                {selecionadas.some((c) => SLUGS_SEPARAR.includes(c.slug)) && (
                  <p className="alerta alerta--info">
                    <Info size={16} />
                    Pilhas, baterias e eletrônicos vão separados dos outros materiais, em saco ou caixa
                    à parte.
                  </p>
                )}
              </fieldset>

              {selecionadas.length > 0 && (
                <fieldset className="solicitar__grupo-campos">
                  <legend className="campo__rotulo campo__rotulo--obrigatorio">
                    Quantidade de cada material
                  </legend>
                  <ul className="solicitar__itens">
                    {selecionadas.map((c) => {
                      const item = form.itens[c.id]
                      const erro = erros.quantidades?.[c.id]
                      return (
                        <li key={c.id} className="solicitar__item campo">
                          <span {...propsCategoria(c, 'tag')} id={`item-${c.id}`}>
                            {c.nome}
                          </span>
                          <div className="solicitar__item-campos">
                            <input
                              className={`input ${erro ? 'input--erro' : ''}`}
                              inputMode="decimal"
                              placeholder="Ex.: 2"
                              aria-label={`Quantidade de ${c.nome}`}
                              aria-required
                              aria-invalid={erro ? true : undefined}
                              maxLength={8}
                              value={item.quantidade}
                              onChange={(e) =>
                                alterarItem(c.id, { quantidade: e.target.value.replace(/[^\d,.]/g, '') })
                              }
                            />
                            <select
                              className="input"
                              aria-label={`Unidade de ${c.nome}`}
                              value={item.unidade}
                              onChange={(e) =>
                                alterarItem(c.id, { unidade: e.target.value as UnidadeQuantidade })
                              }
                            >
                              {(Object.keys(rotulosUnidade) as UnidadeQuantidade[]).map((u) => (
                                <option key={u} value={u}>
                                  {rotulosUnidade[u][1]}
                                </option>
                              ))}
                            </select>
                          </div>
                          {erro && <span className="campo__erro">{erro}</span>}
                        </li>
                      )
                    })}
                  </ul>
                  <span className="campo__ajuda">Uma estimativa basta. Ex.: 2 sacos, 5 kg, 3 caixas.</span>
                </fieldset>
              )}

              <label className="campo">
                <span className="campo__rotulo">Observações</span>
                <textarea
                  className="input solicitar__observacoes"
                  maxLength={LIMITES.observacoes}
                  placeholder="Ex.: caixas desmontadas na portaria, tocar o interfone 42."
                  value={form.observacoes}
                  onChange={(e) => alterar({ observacoes: e.target.value })}
                />
                <span className="campo__ajuda solicitar__contador">
                  {form.observacoes.length}/{LIMITES.observacoes}
                </span>
              </label>
            </section>

            <section className="card solicitar__secao">
              <h2 className="solicitar__secao-titulo">
                <span className="solicitar__passo">3</span> Quando você prefere
              </h2>
              <p className="texto-suave">Opcional. A cooperativa confirma a data da coleta.</p>

              <fieldset className="solicitar__grupo-campos">
                <legend className="campo__rotulo">Dia preferido</legend>
                <div className="solicitar__datas-topo">
                  <p className="solicitar__datas-intervalo" aria-live="polite">
                    {rotuloIntervalo(inicioPagina, fimPagina)}
                  </p>
                  <div className="solicitar__datas-setas">
                    <button
                      type="button"
                      className="btn btn--contorno btn--pequeno solicitar__seta"
                      onClick={() => setPaginaDatas((p) => p - 1)}
                      disabled={paginaDatas === 0}
                      aria-label="Duas semanas anteriores"
                      title="Duas semanas anteriores"
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--contorno btn--pequeno solicitar__seta"
                      onClick={() => setPaginaDatas((p) => p + 1)}
                      aria-label="Próximas duas semanas"
                      title="Próximas duas semanas"
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
                <div className="escolhas escolhas--datas">
                  {datas.map(({ iso, data }) => (
                    <label
                      key={iso}
                      className={`escolha escolha--data ${form.data === iso ? 'escolha--marcada' : ''}`}
                    >
                      <input
                        type="radio"
                        className="escolha__input"
                        name="data"
                        value={iso}
                        checked={form.data === iso}
                        onChange={() => alterar({ data: iso })}
                        aria-label={`${dataPorExtenso(data)}${iso === isoDeData(hoje) ? ', hoje' : ''}`}
                      />
                      <small aria-hidden="true">
                        {iso === isoDeData(hoje) ? 'Hoje' : diasSemanaCurtos[data.getDay()]}
                      </small>
                      <strong aria-hidden="true">{data.getDate()}</strong>
                      <small aria-hidden="true">{MESES_CURTOS[data.getMonth()]}</small>
                    </label>
                  ))}
                </div>
                <span className="campo__ajuda solicitar__data-ajuda">
                  {form.data ? (
                    <>
                      <strong className="solicitar__data-escolhida">
                        {dataForaDaPagina ? 'Dia escolhido: ' : 'Escolhido: '}
                        {dataPorExtenso(dataDeIso(form.data))}.
                      </strong>
                      <button
                        type="button"
                        className="resumo-filtros__limpar"
                        onClick={() => alterar({ data: '' })}
                      >
                        Sem preferência de dia
                      </button>
                    </>
                  ) : (
                    'Sem dia escolhido, a cooperativa sugere a data.'
                  )}
                </span>
              </fieldset>

              <fieldset className="solicitar__grupo-campos">
                <legend className="campo__rotulo">Período</legend>
                <div className="escolhas escolhas--4">
                  {(['', 'MANHA', 'TARDE', 'NOITE'] as const).map((p) => (
                    <label key={p || 'qualquer'} className={`escolha ${form.periodo === p ? 'escolha--marcada' : ''}`}>
                      <input
                        type="radio"
                        className="escolha__input"
                        name="periodo"
                        value={p}
                        checked={form.periodo === p}
                        onChange={() => alterar({ periodo: p })}
                      />
                      <span className="escolha__texto">
                        <strong>{p ? rotulosPeriodo[p] : 'Qualquer horário'}</strong>
                      </span>
                      <Check size={15} className="escolha__check" aria-hidden="true" />
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            {erroEnvio && (
              <p className="alerta alerta--erro" role="alert">
                <CircleAlert size={16} />
                <span>
                  {erroEnvio.mensagem}
                  {erroEnvio.semAtendimento && (
                    <>
                      {' '}
                      <Link to="/pontos" className="solicitar__link">
                        Ver pontos de coleta
                      </Link>
                    </>
                  )}
                </span>
              </p>
            )}

            <div className="solicitar__acoes">
              <p className="legenda-obrigatorio">
                <span>*</span> Campos obrigatórios
              </p>
              <button className="btn btn--primario" disabled={enviando || categorias === null}>
                {enviando ? (
                  <>
                    <LoaderCircle size={16} className="girando" /> Enviando...
                  </>
                ) : (
                  <>
                    Enviar pedido <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        <ListaPedidos
          abertos={abertos}
          anteriores={anteriores}
          erro={erroPedidos}
          destaque={enviado?.id ?? null}
          onTentarDeNovo={tentarPedidosDeNovo}
          onCarregarMais={carregarMaisAnteriores}
          onCancelar={aoCancelar}
        />
      </div>
    </>
  )
}

// ---------- Seus pedidos ----------

interface ListaProps {
  abertos: Pedido[] | null
  anteriores: Anteriores | null
  erro: string
  destaque: string | null
  onTentarDeNovo: () => void
  onCarregarMais: () => Promise<void>
  onCancelar: (id: string, motivo: string) => Promise<void>
}

function ListaPedidos({ abertos, anteriores, erro, destaque, onTentarDeNovo, onCarregarMais, onCancelar }: ListaProps) {
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erroMais, setErroMais] = useState('')

  // Mais perto primeiro; sem data vão para o fim, os mais novos antes
  const andamento = [...(abertos ?? [])].sort((a, b) => {
    const da = dataDoPedido(a)
    const db = dataDoPedido(b)
    if (da && db) return da.localeCompare(db)
    if (da || db) return da ? -1 : 1
    return b.criadoEm.localeCompare(a.criadoEm)
  })
  const restantes = anteriores ? anteriores.total - anteriores.itens.length : 0

  async function carregarMais() {
    setCarregandoMais(true)
    setErroMais('')
    try {
      await onCarregarMais()
    } catch (e) {
      setErroMais(mensagemDeErro(e, 'Não foi possível carregar mais pedidos.'))
    } finally {
      setCarregandoMais(false)
    }
  }

  return (
    <aside className="solicitar__lateral" id="seus-pedidos" aria-labelledby="titulo-pedidos">
      <h2 id="titulo-pedidos" className="titulo-secao solicitar__lateral-titulo">
        Seus pedidos
      </h2>

      {erro ? (
        <div className="alerta alerta--erro solicitar__erro-tentar" role="alert">
          <CircleAlert size={16} />
          <span>Não foi possível carregar seus pedidos agora. {erro}</span>
          <button type="button" className="btn btn--contorno btn--pequeno" onClick={onTentarDeNovo}>
            <RotateCw size={14} /> Tentar novamente
          </button>
        </div>
      ) : abertos === null || anteriores === null ? (
        <p className="texto-suave solicitar__carregando">
          <LoaderCircle size={16} className="girando" /> Carregando seus pedidos...
        </p>
      ) : abertos.length === 0 && anteriores.total === 0 ? (
        <div className="card card--verde solicitar__vazio">
          <span className="icon-circle">
            <PackageOpen size={18} strokeWidth={1.75} />
          </span>
          <p className="texto-suave">
            Você ainda não fez nenhum pedido. Quando enviar, ele aparece aqui com o andamento.
          </p>
        </div>
      ) : (
        <>
          <h3 className="solicitar__grupo">
            Em andamento <span>{andamento.length}</span>
          </h3>
          {andamento.length === 0 ? (
            <p className="texto-suave solicitar__nenhum">Nenhum pedido em andamento.</p>
          ) : (
            andamento.map((p) => (
              <CartaoPedido key={p.id} pedido={p} destaque={p.id === destaque} onCancelar={onCancelar} />
            ))
          )}

          {anteriores.total > 0 && (
            <>
              <h3 className="solicitar__grupo">
                Anteriores <span>{anteriores.total}</span>
              </h3>
              {anteriores.itens.map((p) => (
                <CartaoPedido key={p.id} pedido={p} destaque={false} onCancelar={onCancelar} />
              ))}
              {restantes > 0 && (
                <button
                  type="button"
                  className="resumo-filtros__limpar solicitar__ver-todos"
                  disabled={carregandoMais}
                  onClick={carregarMais}
                >
                  {carregandoMais ? (
                    <>
                      <LoaderCircle size={14} className="girando" /> Carregando...
                    </>
                  ) : (
                    `Ver mais anteriores (${restantes})`
                  )}
                </button>
              )}
              {erroMais && <span className="campo__erro">{erroMais}</span>}
            </>
          )}
        </>
      )}
    </aside>
  )
}

function CartaoPedido({
  pedido,
  destaque,
  onCancelar,
}: {
  pedido: Pedido
  destaque: boolean
  onCancelar: (id: string, motivo: string) => Promise<void>
}) {
  const ativo = statusAbertos.includes(pedido.status)
  const agendado = pedido.dataAgendada !== null
  const data = dataDoPedido(pedido)
  const periodo = agendado ? pedido.periodoAgendado : pedido.periodoPreferido
  const telefone = telefoneDaCooperativa(pedido)

  return (
    <article
      className={`pedido ${ativo ? '' : 'pedido--anterior'} ${destaque ? 'pedido--novo' : ''}`}
      aria-label={`Pedido ${pedido.protocolo}`}
    >
      <div className="pedido__topo">
        <span className="pedido__codigo">{pedido.protocolo}</span>
        <span className={`pedido__status pedido__status--${classeStatus(pedido.status)}`}>
          {rotulosStatus[pedido.status]}
        </span>
      </div>

      <p className="pedido__data">
        {data ? dataPorExtenso(dataDeIso(data)) : 'Sem dia definido'}
      </p>
      <p className="pedido__info">
        <Clock size={13} />
        {agendado ? 'Agendado' : 'Preferência'}: {periodo ? rotulosPeriodo[periodo] : 'qualquer horário'}
      </p>
      <p className="pedido__info pedido__endereco">
        <MapPin size={13} /> {pedido.endereco}
      </p>

      <div className="pedido__materiais">
        {pedido.itens.map((i) => (
          <span key={i.categoria.id} {...propsCategoria(i.categoria, 'tag')}>
            {i.categoria.nome} · {rotuloQuantidade(i.quantidade, i.unidade)}
          </span>
        ))}
      </div>

      <EtapasPedido status={pedido.status} />

      <p className="pedido__nota">{notaDoPedido(pedido)}</p>
      {ativo && pedido.atrasado && (
        <p className="pedido__atraso">
          <CircleAlert size={13} /> Passou do prazo previsto.
        </p>
      )}
      {telefone && (
        <a href={`tel:${telefone.replace(/\D/g, '')}`} className="pedido__info pedido__telefone">
          <Phone size={13} /> {pedido.cooperativa?.nome}: {telefone}
        </a>
      )}

      <div className="pedido__rodape">
        <Link
          to={`/solicitacoes/${pedido.id}`}
          state={{ pedido }}
          className="link-seta"
          aria-label={`Ver detalhes do pedido ${pedido.protocolo}`}
        >
          Ver detalhes <ArrowRight size={14} />
        </Link>
        <CancelarPedido status={pedido.status} onCancelar={(motivo) => onCancelar(pedido.id, motivo)} />
      </div>
    </article>
  )
}
