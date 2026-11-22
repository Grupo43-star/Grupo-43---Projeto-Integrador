import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CircleAlert,
  LoaderCircle,
  Mail,
  Navigation,
  PackageCheck,
  PackageOpen,
  Phone,
  Play,
  SearchX,
  Trash2,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react'
import EtapasPedido from '../../components/EtapasPedido'
import Janela from '../../components/Janela'
import { Carregando, ErroComTentar } from '../../components/Painel'
import { InfoColeta, LinhaDoTempo, ListaItens } from '../../components/PartesDoPedido'
import { useAuth } from '../../context/useAuth'
import { useConsulta } from '../../hooks/useConsulta'
import { ErroApi, mensagemDeErro } from '../../services/api'
import {
  agendarPedido,
  atribuirColetor,
  buscarColeta,
  buscarPedidoCooperativa,
  cancelarPelaCooperativa,
  concluirColeta,
  iniciarAnalise,
  iniciarRota,
  listarMembros,
  recusarPedido,
  registrarNaoRealizada,
  type DetalhePedidoEquipe,
  type ItemRecolhido,
} from '../../services/equipe'
import { listarCategorias } from '../../services/materiais'
import {
  QUANTIDADE_MAXIMA,
  QUANTIDADE_MINIMA,
  rotulosPeriodo,
  rotulosStatus,
  rotulosUnidade,
  statusAbertos,
  type PeriodoRetirada,
  type UnidadeQuantidade,
} from '../../services/pedidos'
import { dataDeIso, dataPorExtenso, isoDeData } from '../../utils/formatar'
import { classeStatus } from '../../utils/pedido'
import '../solicitacoes.css' // .pedido__status, __etapas
import '../detalhe.css'
import './equipe.css'

type Modo = 'gestor' | 'coletor'

type Janelas = 'agendar' | 'reagendar' | 'atribuir' | 'recusar' | 'cancelar' | 'concluir' | 'nao-realizada' | null

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const naoEncontrado = (erro: unknown) =>
  erro instanceof ErroApi &&
  (erro.status === 404 ||
    erro.status === 400 ||
    erro.codigo === 'NOT_YOUR_REQUEST' ||
    erro.codigo === 'NOT_ASSIGNED_TO_YOU')

/** O que a equipe precisa fazer agora, em uma frase */
function proximoPasso(p: DetalhePedidoEquipe, modo: Modo, hoje: string) {
  switch (p.status) {
    case 'SOLICITADA':
      return 'Pedido novo, ainda sem cooperativa. Assuma para começar a análise.'
    case 'EM_ANALISE':
      return 'Em análise pela cooperativa. Agende a coleta ou recuse informando o motivo.'
    case 'AGENDADA':
      if (!p.coletor) return 'Agendado, mas sem coletor. Defina quem vai buscar os materiais.'
      if (p.dataAgendada === hoje) return 'A coleta é hoje. Quando sair para buscar, inicie a rota.'
      if (p.dataAgendada && p.dataAgendada < hoje) return 'A data agendada já passou. Reagende a coleta.'
      return modo === 'coletor'
        ? 'Agendado. A rota só pode começar no dia da coleta.'
        : `Agendado, com ${p.coletor.nome}. A rota começa no dia da coleta.`
    case 'EM_ROTA':
      return 'Coletor a caminho. Registre a conclusão com o que foi recolhido, ou que a coleta não pôde ser feita.'
    case 'CONCLUIDA':
      return p.notaConclusao ? `Coleta concluída: ${p.notaConclusao}` : 'Coleta concluída.'
    case 'CANCELADA':
      return p.motivo ? `Cancelado: ${p.motivo}` : 'Pedido cancelado.'
    case 'RECUSADA':
      return p.motivo ? `Recusado: ${p.motivo}` : 'Pedido recusado.'
  }
}

// Detalhe de um pedido para a equipe:
//   gestor  -> GET /cooperative/pickup-requests/:id, com as ações da cooperativa e da execução
//   coletor -> GET /collector/pickups/:id, com iniciar rota, concluir e "não realizada"
export default function PedidoEquipe({ modo }: { modo: Modo }) {
  const { id = '' } = useParams()
  const { usuario } = useAuth()
  const pedido = useConsulta(`${modo}|${id}`, (s) =>
    modo === 'gestor' ? buscarPedidoCooperativa(id, s) : buscarColeta(id, s),
  )
  const voltar = modo === 'gestor' ? '/cooperativa/pedidos' : '/coletor'

  return (
    <div className="page page--larga detalhe">
      <Link to={voltar} className="voltar">
        <ArrowLeft size={16} aria-hidden="true" /> {modo === 'gestor' ? 'Pedidos' : 'Minhas coletas'}
      </Link>

      {pedido.erro ? (
        naoEncontrado(pedido.erro) ? (
          <div className="card detalhe__vazio">
            <span className="icon-circle">
              <SearchX size={20} strokeWidth={1.75} />
            </span>
            <h1 className="card__titulo">Pedido não encontrado.</h1>
            <p className="texto-suave">
              {modo === 'gestor'
                ? 'Ele pode ser de outra cooperativa ou o link está incompleto.'
                : 'Esta coleta pode estar com outro coletor ou o link está incompleto.'}
            </p>
            <Link to={voltar} className="btn btn--primario">
              {modo === 'gestor' ? 'Ver os pedidos' : 'Ver minhas coletas'} <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <ErroComTentar
            erro={pedido.erro}
            titulo="Não foi possível carregar este pedido agora."
            aoTentar={pedido.recarregar}
          />
        )
      ) : !pedido.dados ? (
        <Carregando texto="Carregando o pedido..." />
      ) : (
        <Conteudo
          // Recomeça as janelas e os avisos se o id da URL mudar
          key={pedido.dados.id}
          p={pedido.dados}
          modo={modo}
          idUsuario={usuario?.id ?? ''}
          aoAtualizar={pedido.substituir}
        />
      )}
    </div>
  )
}

function Conteudo({
  p,
  modo,
  idUsuario,
  aoAtualizar,
}: {
  p: DetalhePedidoEquipe
  modo: Modo
  idUsuario: string
  aoAtualizar: (p: DetalhePedidoEquipe) => void
}) {
  const [janela, setJanela] = useState<Janelas>(null)
  const [aviso, setAviso] = useState('')
  const [erroRota, setErroRota] = useState('')
  const [iniciando, setIniciando] = useState(false)
  const [hoje] = useState(() => isoDeData(new Date()))
  const gestor = modo === 'gestor'
  const aberto = statusAbertos.includes(p.status)
  const ehHoje = p.dataAgendada === hoje

  function concluiu(atualizado: DetalhePedidoEquipe, mensagem: string) {
    aoAtualizar(atualizado)
    setJanela(null)
    setAviso(mensagem)
    setErroRota('')
  }

  async function executar(acao: () => Promise<DetalhePedidoEquipe>, mensagem: string) {
    setIniciando(true)
    setErroRota('')
    setAviso('')
    try {
      concluiu(await acao(), mensagem)
    } catch (erro) {
      setErroRota(mensagemDeErro(erro, 'Não foi possível concluir agora. Tente de novo.'))
    } finally {
      setIniciando(false)
    }
  }

  const botaoRota = p.status === 'AGENDADA' && (
    <button
      type="button"
      className="btn btn--primario"
      disabled={iniciando || !ehHoje}
      title={ehHoje ? undefined : 'A rota só pode começar no dia agendado'}
      onClick={() => executar(() => iniciarRota(p.id), 'Rota iniciada. O solicitante foi avisado de que o coletor está a caminho.')}
    >
      {iniciando ? <LoaderCircle size={16} className="girando" /> : <Play size={16} />} Iniciar rota
    </button>
  )

  return (
    <>
      <header className="detalhe__cabecalho">
        <div className="detalhe__cabecalho-topo">
          <p className="eyebrow eyebrow--simples">{gestor ? 'Pedido de retirada' : 'Coleta'}</p>
          <span className={`pedido__status pedido__status--${classeStatus(p.status)}`}>{rotulosStatus[p.status]}</span>
          {aberto && p.atrasado && (
            <span className="pedido-equipe__atraso">
              <CircleAlert size={13} aria-hidden="true" /> Atrasado
            </span>
          )}
        </div>
        <h1 className="page-header__titulo">{p.protocolo}</h1>
        <p className="detalhe__linha">Enviado em {formatoDataHora.format(new Date(p.criadoEm))}.</p>
      </header>

      {aviso && (
        <p className="alerta alerta--sucesso painel__erro" role="status">
          <Check size={16} aria-hidden="true" /> {aviso}
        </p>
      )}

      <div className="detalhe__grid detalhe-pedido__grid">
        <section className="card detalhe__secao detalhe-pedido__situacao" aria-labelledby="titulo-situacao">
          <h2 id="titulo-situacao" className="detalhe__titulo">
            Situação
          </h2>
          <EtapasPedido status={p.status} />
          <p className="detalhe-pedido__nota">{proximoPasso(p, modo, hoje)}</p>

          {aberto && (
            <div className="acoes-pedido">
              {gestor && p.status === 'SOLICITADA' && (
                <button
                  type="button"
                  className="btn btn--primario"
                  disabled={iniciando}
                  onClick={() =>
                    executar(() => iniciarAnalise(p.id), 'Pedido assumido pela cooperativa. Agora ele está em análise.')
                  }
                >
                  {iniciando ? <LoaderCircle size={16} className="girando" /> : <Check size={16} />} Assumir e
                  analisar
                </button>
              )}
              {gestor && p.status === 'EM_ANALISE' && (
                <>
                  <button type="button" className="btn btn--primario" onClick={() => setJanela('agendar')}>
                    <CalendarCheck size={16} /> Agendar coleta
                  </button>
                  <button type="button" className="btn btn--contorno" onClick={() => setJanela('recusar')}>
                    <X size={16} /> Recusar
                  </button>
                </>
              )}
              {p.status === 'AGENDADA' && (
                <>
                  {botaoRota}
                  {gestor && (
                    <>
                      <button type="button" className="btn btn--contorno" onClick={() => setJanela('atribuir')}>
                        <UserCheck size={16} /> {p.coletor ? 'Trocar coletor' : 'Definir coletor'}
                      </button>
                      <button type="button" className="btn btn--contorno" onClick={() => setJanela('reagendar')}>
                        <CalendarCheck size={16} /> Reagendar
                      </button>
                    </>
                  )}
                </>
              )}
              {p.status === 'EM_ROTA' && (
                <>
                  <button type="button" className="btn btn--primario" onClick={() => setJanela('concluir')}>
                    <PackageCheck size={16} /> Registrar conclusão
                  </button>
                  <button type="button" className="btn btn--contorno" onClick={() => setJanela('nao-realizada')}>
                    Não foi possível coletar
                  </button>
                </>
              )}
              {gestor && (
                <button type="button" className="btn btn--texto-perigo" onClick={() => setJanela('cancelar')}>
                  <Trash2 size={15} /> Cancelar pedido
                </button>
              )}
            </div>
          )}
          {p.status === 'AGENDADA' && !ehHoje && p.dataAgendada && (
            <p className="texto-nota">
              A rota só pode ser iniciada no dia agendado ({dataPorExtenso(dataDeIso(p.dataAgendada)).toLowerCase()}).
            </p>
          )}
          {erroRota && (
            <p className="campo__erro" role="alert">
              {erroRota}
            </p>
          )}
        </section>

        <aside className="detalhe__lateral detalhe-pedido__lateral">
          <section className="card detalhe__secao" aria-labelledby="titulo-solicitante">
            <h2 id="titulo-solicitante" className="detalhe__titulo">
              <UserRound size={16} aria-hidden="true" /> Solicitante
            </h2>
            {p.solicitante ? (
              <div className="solicitante">
                <strong>{p.solicitante.nome}</strong>
                {p.solicitante.telefone ? (
                  <a href={`tel:${p.solicitante.telefone.replace(/\D/g, '')}`} className="pedido__info pedido__telefone">
                    <Phone size={13} aria-hidden="true" /> {p.solicitante.telefone}
                  </a>
                ) : (
                  <span className="texto-suave">Sem telefone cadastrado.</span>
                )}
                <a href={`mailto:${p.solicitante.email}`} className="pedido__info">
                  <Mail size={13} aria-hidden="true" /> {p.solicitante.email}
                </a>
              </div>
            ) : (
              <p className="texto-suave">Dados do solicitante indisponíveis (conta excluída).</p>
            )}
          </section>

          <section className="card detalhe__secao" aria-labelledby="titulo-coleta">
            <h2 id="titulo-coleta" className="detalhe__titulo">
              Coleta
            </h2>
            <InfoColeta pedido={p} regiao={p.regiao} visao="equipe" />
            {aberto && (
              <a
                className="btn btn--contorno btn--pequeno"
                href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation size={14} aria-hidden="true" /> Como chegar
              </a>
            )}
          </section>

          <section className="card detalhe__secao" aria-labelledby="titulo-materiais">
            <h2 id="titulo-materiais" className="detalhe__titulo">
              <PackageOpen size={16} aria-hidden="true" /> Materiais pedidos
            </h2>
            <ListaItens itens={p.itens} />
            {p.recolhidos.length > 0 && (
              <>
                <h3 className="detalhe__subtitulo">
                  <PackageCheck size={15} aria-hidden="true" /> Recolhidos na coleta
                </h3>
                <ListaItens itens={p.recolhidos} />
              </>
            )}
            {p.observacoes && (
              <>
                <h3 className="detalhe__subtitulo">Observações do solicitante</h3>
                <p className="detalhe-pedido__observacoes">{p.observacoes}</p>
              </>
            )}
          </section>
        </aside>

        <section className="card detalhe__secao detalhe-pedido__linha" aria-labelledby="titulo-historico">
          <h2 id="titulo-historico" className="detalhe__titulo">
            Histórico do pedido
          </h2>
          {p.historico.length === 0 ? (
            <p className="texto-suave">Nenhum evento registrado ainda.</p>
          ) : (
            <LinhaDoTempo eventos={p.historico} idUsuario={idUsuario} visao="equipe" />
          )}
        </section>
      </div>

      {(janela === 'agendar' || janela === 'reagendar') && (
        <JanelaAgendar
          p={p}
          reagendar={janela === 'reagendar'}
          hoje={hoje}
          aoFechar={() => setJanela(null)}
          aoSalvar={(a) =>
            concluiu(
              a,
              janela === 'reagendar'
                ? 'Coleta reagendada. O solicitante e o coletor foram avisados.'
                : 'Coleta agendada. O solicitante foi avisado.',
            )
          }
        />
      )}
      {janela === 'atribuir' && (
        <JanelaAtribuir
          p={p}
          aoFechar={() => setJanela(null)}
          aoSalvar={(a) => concluiu(a, 'Coletor definido. Ele foi avisado da coleta.')}
        />
      )}
      {janela === 'recusar' && (
        <JanelaMotivo
          titulo="Recusar pedido"
          descricao="O solicitante recebe o motivo e a sugestão de levar os materiais a um ponto de entrega."
          rotulo="Motivo da recusa"
          confirmar="Recusar pedido"
          aoFechar={() => setJanela(null)}
          aoEnviar={(motivo) => recusarPedido(p.id, motivo)}
          aoSalvar={(a) => concluiu(a, 'Pedido recusado. O solicitante foi avisado com o motivo.')}
        />
      )}
      {janela === 'cancelar' && (
        <JanelaMotivo
          titulo="Cancelar pedido"
          descricao="O pedido é encerrado e o solicitante recebe o motivo. Isso não pode ser desfeito."
          rotulo="Motivo do cancelamento"
          confirmar="Cancelar pedido"
          perigo
          aoFechar={() => setJanela(null)}
          aoEnviar={(motivo) => cancelarPelaCooperativa(p.id, motivo)}
          aoSalvar={(a) => concluiu(a, 'Pedido cancelado. O solicitante foi avisado com o motivo.')}
        />
      )}
      {janela === 'nao-realizada' && (
        <JanelaMotivo
          titulo="Coleta não realizada"
          descricao="O pedido volta para agendado e a cooperativa precisa marcar uma nova data. O solicitante recebe o motivo."
          rotulo="O que aconteceu?"
          dica="Ex.: Ninguém atendeu no portão."
          confirmar="Registrar"
          aoFechar={() => setJanela(null)}
          aoEnviar={(motivo) => registrarNaoRealizada(p.id, motivo)}
          aoSalvar={(a) => concluiu(a, 'Registrado que a coleta não foi realizada. A cooperativa vai marcar uma nova data.')}
        />
      )}
      {janela === 'concluir' && (
        <JanelaConcluir
          p={p}
          aoFechar={() => setJanela(null)}
          aoSalvar={(a) => concluiu(a, 'Coleta concluída. Obrigado! O solicitante foi avisado.')}
        />
      )}
    </>
  )
}

// ---------- Janelas das ações ----------

function JanelaAgendar({
  p,
  reagendar,
  hoje,
  aoFechar,
  aoSalvar,
}: {
  p: DetalhePedidoEquipe
  reagendar: boolean
  hoje: string
  aoFechar: () => void
  aoSalvar: (p: DetalhePedidoEquipe) => void
}) {
  const membros = useConsulta('membros', (s) => listarMembros(s))
  const coletores = (membros.dados ?? []).filter((m) => m.papel === 'COLETOR' && m.ativo)
  const sugestao = p.dataPreferida && p.dataPreferida >= hoje ? p.dataPreferida : ''
  const [data, setData] = useState(reagendar ? '' : sugestao)
  const [periodo, setPeriodo] = useState<PeriodoRetirada | ''>('')
  const [coletorId, setColetorId] = useState('')
  const [comentario, setComentario] = useState('')
  const [erros, setErros] = useState<{ data?: string; comentario?: string }>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Período que fica se a pessoa não escolher outro (o back mantém o combinado ou o preferido)
  const periodoAtual = p.periodoAgendado ?? p.periodoPreferido

  async function confirmar() {
    const novos: typeof erros = {}
    if (!data) novos.data = 'Escolha a data da coleta.'
    else if (data < hoje) novos.data = 'Escolha uma data a partir de hoje.'
    if (reagendar && !comentario.trim()) novos.comentario = 'Explique o motivo para o solicitante.'
    setErros(novos)
    if (Object.keys(novos).length > 0) return
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await agendarPedido(p.id, { data, periodo: periodo || null, coletorId, comentario }))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível agendar agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={reagendar ? 'Reagendar coleta' : 'Agendar coleta'}
      descricao={
        p.dataPreferida
          ? `O solicitante prefere ${dataPorExtenso(dataDeIso(p.dataPreferida)).toLowerCase()}${
              p.periodoPreferido ? `, de ${rotulosPeriodo[p.periodoPreferido].toLowerCase()}` : ''
            }.`
          : 'O solicitante não escolheu um dia.'
      }
      salvando={salvando}
      erro={erro}
      rotuloConfirmar={reagendar ? 'Reagendar' : 'Agendar coleta'}
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <div className="janela__campos">
        <label className="campo">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Data da coleta</span>
          <input
            type="date"
            className={`input ${erros.data ? 'input--erro' : ''}`}
            min={hoje}
            value={data}
            aria-required
            onChange={(e) => {
              setData(e.target.value)
              setErros((x) => ({ ...x, data: undefined }))
            }}
          />
          {erros.data && <span className="campo__erro">{erros.data}</span>}
        </label>
        <label className="campo">
          <span className="campo__rotulo">Período</span>
          <select className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoRetirada | '')}>
            <option value="">
              {periodoAtual ? `Manter ${rotulosPeriodo[periodoAtual].toLowerCase()}` : 'Qualquer horário'}
            </option>
            {(Object.keys(rotulosPeriodo) as PeriodoRetirada[]).map((x) => (
              <option key={x} value={x}>
                {rotulosPeriodo[x]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo campo--inteiro">
          <span className="campo__rotulo">Coletor</span>
          <select
            className="input"
            value={coletorId}
            disabled={!membros.dados}
            onChange={(e) => setColetorId(e.target.value)}
          >
            <option value="">{p.coletor ? `Manter ${p.coletor.nome}` : 'Definir depois'}</option>
            {coletores.map((m) => (
              <option key={m.usuario.id} value={m.usuario.id}>
                {m.usuario.nome}
              </option>
            ))}
          </select>
          {membros.erro ? (
            <span className="campo__erro">A lista de coletores não pôde ser carregada. Dá para definir depois.</span>
          ) : (
            membros.dados &&
            coletores.length === 0 && (
              <span className="campo__ajuda">Nenhum coletor ativo. Cadastre na tela Equipe.</span>
            )
          )}
        </label>
        <label className="campo campo--inteiro">
          <span className={`campo__rotulo ${reagendar ? 'campo__rotulo--obrigatorio' : ''}`}>
            {reagendar ? 'Motivo do reagendamento' : 'Recado ao solicitante'}
          </span>
          <textarea
            className={`input janela__texto ${erros.comentario ? 'input--erro' : ''}`}
            maxLength={500}
            value={comentario}
            aria-required={reagendar}
            onChange={(e) => {
              setComentario(e.target.value)
              setErros((x) => ({ ...x, comentario: undefined }))
            }}
          />
          {erros.comentario ? (
            <span className="campo__erro">{erros.comentario}</span>
          ) : (
            <span className="campo__ajuda">{reagendar ? 'Vai junto no aviso ao solicitante.' : 'Opcional.'} Até 500 caracteres.</span>
          )}
        </label>
      </div>
    </Janela>
  )
}

function JanelaAtribuir({
  p,
  aoFechar,
  aoSalvar,
}: {
  p: DetalhePedidoEquipe
  aoFechar: () => void
  aoSalvar: (p: DetalhePedidoEquipe) => void
}) {
  const membros = useConsulta('membros', (s) => listarMembros(s))
  const coletores = (membros.dados ?? []).filter((m) => m.papel === 'COLETOR' && m.ativo)
  const [coletorId, setColetorId] = useState('')
  const [erroCampo, setErroCampo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    if (!coletorId) {
      setErroCampo('Escolha o coletor.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await atribuirColetor(p.id, coletorId))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível definir o coletor agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={p.coletor ? 'Trocar coletor' : 'Definir coletor'}
      descricao={p.coletor ? `Hoje a coleta está com ${p.coletor.nome}.` : 'Quem vai buscar os materiais?'}
      salvando={salvando}
      erro={erro || (membros.erro ? mensagemDeErro(membros.erro) : '')}
      rotuloConfirmar="Salvar"
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <label className="campo">
        <span className="campo__rotulo campo__rotulo--obrigatorio">Coletor</span>
        <select
          className={`input ${erroCampo ? 'input--erro' : ''}`}
          value={coletorId}
          disabled={!membros.dados}
          aria-required
          onChange={(e) => {
            setColetorId(e.target.value)
            setErroCampo('')
          }}
        >
          <option value="">{membros.dados ? 'Escolha' : 'Carregando...'}</option>
          {coletores
            .filter((m) => m.usuario.id !== p.idColetor)
            .map((m) => (
              <option key={m.usuario.id} value={m.usuario.id}>
                {m.usuario.nome}
              </option>
            ))}
        </select>
        {erroCampo && <span className="campo__erro">{erroCampo}</span>}
        {membros.dados && coletores.length === 0 && (
          <span className="campo__ajuda">Nenhum coletor ativo. Cadastre na tela Equipe.</span>
        )}
      </label>
    </Janela>
  )
}

function JanelaMotivo({
  titulo,
  descricao,
  rotulo,
  dica,
  confirmar,
  perigo = false,
  aoFechar,
  aoEnviar,
  aoSalvar,
}: {
  titulo: string
  descricao: string
  rotulo: string
  dica?: string
  confirmar: string
  perigo?: boolean
  aoFechar: () => void
  aoEnviar: (motivo: string) => Promise<DetalhePedidoEquipe>
  aoSalvar: (p: DetalhePedidoEquipe) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [erroCampo, setErroCampo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar() {
    // Back: de 3 a 500 caracteres
    if (motivo.trim().length < 3) {
      setErroCampo('Explique o motivo para o solicitante (3 caracteres ou mais).')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await aoEnviar(motivo))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível concluir agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={titulo}
      descricao={descricao}
      salvando={salvando}
      erro={erro}
      rotuloConfirmar={confirmar}
      perigo={perigo}
      obrigatorios
      aoConfirmar={enviar}
      aoFechar={aoFechar}
    >
      <label className="campo">
        <span className="campo__rotulo campo__rotulo--obrigatorio">{rotulo}</span>
        <textarea
          className={`input janela__texto ${erroCampo ? 'input--erro' : ''}`}
          maxLength={500}
          placeholder={dica}
          value={motivo}
          aria-required
          onChange={(e) => {
            setMotivo(e.target.value)
            setErroCampo('')
          }}
        />
        {erroCampo ? (
          <span className="campo__erro">{erroCampo}</span>
        ) : (
          <span className="campo__ajuda">O solicitante recebe este texto. Até 500 caracteres.</span>
        )}
      </label>
    </Janela>
  )
}

interface LinhaRecolhida {
  chave: number
  categoriaId: string
  quantidade: string
  unidade: UnidadeQuantidade
}

const numeroDoTexto = (texto: string) => Number(texto.replace(',', '.'))

function JanelaConcluir({
  p,
  aoFechar,
  aoSalvar,
}: {
  p: DetalhePedidoEquipe
  aoFechar: () => void
  aoSalvar: (p: DetalhePedidoEquipe) => void
}) {
  const categorias = useConsulta('categorias', (s) => listarCategorias(s))
  // Começa com o que foi pedido; o coletor ajusta para o que de fato recolheu
  const [linhas, setLinhas] = useState<LinhaRecolhida[]>(() =>
    p.itens.map((i, n) => ({
      chave: n,
      categoriaId: i.categoria.id,
      quantidade: String(i.quantidade).replace('.', ','),
      unidade: i.unidade,
    })),
  )
  const [proximaChave, setProximaChave] = useState(p.itens.length)
  const [observacao, setObservacao] = useState('')
  const [errosLinha, setErrosLinha] = useState<Record<number, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // As categorias do pedido aparecem mesmo antes da lista do back chegar
  const opcoes = categorias.dados ?? p.itens.map((i) => ({ id: i.categoria.id, nome: i.categoria.nome }))

  function alterar(chave: number, parcial: Partial<LinhaRecolhida>) {
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)))
    setErrosLinha((atual) => {
      const novo = { ...atual }
      delete novo[chave]
      return novo
    })
  }

  function adicionar() {
    setLinhas((atual) => [...atual, { chave: proximaChave, categoriaId: '', quantidade: '', unidade: 'SACOS' }])
    setProximaChave((c) => c + 1)
  }

  async function confirmar() {
    const novos: Record<number, string> = {}
    for (const l of linhas) {
      const q = numeroDoTexto(l.quantidade)
      if (!l.categoriaId) novos[l.chave] = 'Escolha o material.'
      else if (!Number.isFinite(q) || q < QUANTIDADE_MINIMA || q > QUANTIDADE_MAXIMA)
        novos[l.chave] = 'Informe uma quantidade entre 0,1 e 10.000.'
    }
    setErrosLinha(novos)
    if (linhas.length === 0) {
      setErro('Registre ao menos um material recolhido.')
      return
    }
    if (Object.keys(novos).length > 0) return
    const itens: ItemRecolhido[] = linhas.map((l) => ({
      categoriaId: l.categoriaId,
      quantidade: numeroDoTexto(l.quantidade),
      unidade: l.unidade,
    }))
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await concluirColeta(p.id, itens, observacao))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível concluir agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo="Registrar conclusão"
      descricao="Confira o que foi recolhido. Os números entram nos indicadores da cooperativa."
      larga
      salvando={salvando}
      erro={erro}
      rotuloConfirmar="Concluir coleta"
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <fieldset className="grupo-opcoes">
        <legend className="campo__rotulo campo__rotulo--obrigatorio">Materiais recolhidos</legend>
        <ul className="editor-linhas">
          {linhas.map((l, n) => (
            <li key={l.chave} className="editor-linhas__linha editor-linhas__linha--recolhido">
              <select
                className={`input ${errosLinha[l.chave] && !l.categoriaId ? 'input--erro' : ''}`}
                aria-label={`Material ${n + 1}`}
                value={l.categoriaId}
                onChange={(e) => alterar(l.chave, { categoriaId: e.target.value })}
              >
                <option value="">Material</option>
                {opcoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <input
                className={`input ${errosLinha[l.chave] && l.categoriaId ? 'input--erro' : ''}`}
                inputMode="decimal"
                aria-label={`Quantidade ${n + 1}`}
                placeholder="Qtd."
                value={l.quantidade}
                onChange={(e) => alterar(l.chave, { quantidade: e.target.value.replace(/[^\d,.]/g, '').slice(0, 8) })}
              />
              <select
                className="input"
                aria-label={`Unidade ${n + 1}`}
                value={l.unidade}
                onChange={(e) => alterar(l.chave, { unidade: e.target.value as UnidadeQuantidade })}
              >
                {(Object.keys(rotulosUnidade) as UnidadeQuantidade[]).map((u) => (
                  <option key={u} value={u}>
                    {rotulosUnidade[u][1]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="editor-linhas__remover"
                aria-label={`Tirar o material ${n + 1}`}
                onClick={() => setLinhas((atual) => atual.filter((x) => x.chave !== l.chave))}
              >
                <X size={16} />
              </button>
              {errosLinha[l.chave] && <span className="campo__erro editor-linhas__erro">{errosLinha[l.chave]}</span>}
            </li>
          ))}
        </ul>
        {linhas.length < 20 && (
          <button type="button" className="btn btn--contorno btn--pequeno" onClick={adicionar}>
            Adicionar material
          </button>
        )}
      </fieldset>
      <label className="campo">
        <span className="campo__rotulo">Observação do atendimento</span>
        <textarea
          className="input janela__texto"
          maxLength={500}
          placeholder="Ex.: Material bem separado."
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        <span className="campo__ajuda">Opcional. O solicitante vê este texto. Até 500 caracteres.</span>
      </label>
    </Janela>
  )
}
