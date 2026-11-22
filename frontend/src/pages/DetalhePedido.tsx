import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  PackageCheck,
  PackageOpen,
  Phone,
  RotateCw,
  SearchX,
  Truck,
} from 'lucide-react'
import CancelarPedido from '../components/CancelarPedido'
import EtapasPedido from '../components/EtapasPedido'
import { InfoColeta, LinhaDoTempo, ListaItens } from '../components/PartesDoPedido'
import { useAuth } from '../context/useAuth'
import { ErroApi, mensagemDeErro } from '../services/api'
import {
  buscarPedido,
  cancelarPedido,
  rotulosStatus,
  statusAbertos,
  type DetalhePedido as Detalhe,
  type Pedido,
} from '../services/pedidos'
import { classeStatus, notaDoPedido, telefoneDaCooperativa } from '../utils/pedido'
import './solicitacoes.css' // .pedido__status, __etapas, __confirmar (iguais aos do cartão)
import './detalhe.css'

type Resultado =
  | { chave: string; pedido: Detalhe; erro?: undefined }
  | { chave: string; erro: unknown; pedido?: undefined }

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** 404 (não existe), 403 NOT_YOUR_REQUEST (de outra conta) e 400 (id que não é UUID) */
const naoEncontrado = (erro: unknown) =>
  erro instanceof ErroApi &&
  (erro.status === 404 || erro.status === 400 || erro.codigo === 'NOT_YOUR_REQUEST')

// Detalhe de um pedido de retirada da pessoa logada: GET /pickup-requests/:id,
// com a linha do tempo (histórico de status) e o que foi recolhido na conclusão.
export default function DetalhePedido() {
  const { id = '' } = useParams()
  const { pathname, state } = useLocation()
  const { usuario } = useAuth()

  return (
    <div className="page detalhe">
      <Link to="/solicitacoes" className="voltar">
        <ArrowLeft size={16} aria-hidden="true" /> Seus pedidos
      </Link>
      {usuario ? (
        <DetalheLogado
          key={`${usuario.id}|${id}`}
          id={id}
          previa={(state as { pedido?: Pedido } | null)?.pedido}
          idUsuario={usuario.id}
        />
      ) : (
        <div className="card card--row detalhe__convite">
          <span className="icon-circle icon-circle--lg">
            <Truck size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="eyebrow eyebrow--simples">Acesso à sua conta</p>
            <h1 className="card__titulo">Entre para ver este pedido.</h1>
            <p className="texto-suave">Os pedidos de retirada só aparecem para quem os fez.</p>
            <Link to="/entrar" state={{ de: pathname }} className="btn btn--primario">
              Entrar para continuar <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function DetalheLogado({ id, previa, idUsuario }: { id: string; previa?: Pedido; idUsuario: string }) {
  const [tentativa, setTentativa] = useState(0)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [cancelado, setCancelado] = useState(false)
  const chave = `${id}|${tentativa}`

  useEffect(() => {
    const controle = new AbortController()
    buscarPedido(id, controle.signal)
      .then((pedido) => setResultado({ chave, pedido }))
      .catch((erro) => {
        if (!controle.signal.aborted) setResultado({ chave, erro })
      })
    return () => controle.abort()
  }, [id, chave])

  const atual = resultado?.chave === chave ? resultado : null
  const detalhe = atual?.pedido ?? null
  const pedido: Pedido | undefined = detalhe ?? (atual?.erro ? undefined : previa?.id === id ? previa : undefined)

  async function cancelar(motivo: string) {
    const atualizado = await cancelarPedido(id, motivo)
    setResultado({ chave, pedido: atualizado })
    setCancelado(true)
  }

  if (atual?.erro) {
    return naoEncontrado(atual.erro) ? (
      <div className="card detalhe__vazio">
        <span className="icon-circle">
          <SearchX size={20} strokeWidth={1.75} />
        </span>
        <h1 className="card__titulo">Pedido não encontrado.</h1>
        <p className="texto-suave">
          Ele pode ter sido feito com outra conta ou o link está incompleto. Seus pedidos estão na tela
          de Solicitações.
        </p>
        <Link to="/solicitacoes" className="btn btn--primario">
          Ver seus pedidos <ArrowRight size={16} />
        </Link>
      </div>
    ) : (
      <div className="alerta alerta--erro detalhe__erro" role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        <span>Não foi possível carregar este pedido agora. {mensagemDeErro(atual.erro)}</span>
        <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setTentativa((t) => t + 1)}>
          <RotateCw size={14} /> Tentar novamente
        </button>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="card detalhe__vazio" aria-busy="true">
        <LoaderCircle size={22} className="girando" aria-hidden="true" />
        <p className="texto-suave">Carregando o pedido...</p>
      </div>
    )
  }

  const ativo = statusAbertos.includes(pedido.status)
  const telefone = telefoneDaCooperativa(pedido)

  return (
    <div aria-busy={!detalhe}>
      <header className="detalhe__cabecalho">
        <div className="detalhe__cabecalho-topo">
          <p className="eyebrow eyebrow--simples">Pedido de retirada</p>
          <span className={`pedido__status pedido__status--${classeStatus(pedido.status)}`}>
            {rotulosStatus[pedido.status]}
          </span>
        </div>
        <h1 className="page-header__titulo">{pedido.protocolo}</h1>
        <p className="detalhe__linha">Enviado em {formatoDataHora.format(new Date(pedido.criadoEm))}.</p>
      </header>

      {cancelado && (
        <p className="alerta alerta--sucesso detalhe__erro" role="status">
          <Check size={16} /> Pedido cancelado. Ele agora aparece em "Anteriores".
        </p>
      )}

      <div className="detalhe__grid detalhe-pedido__grid">
        <section className="card detalhe__secao detalhe-pedido__situacao" aria-labelledby="titulo-situacao">
          <h2 id="titulo-situacao" className="detalhe__titulo">
            Situação
          </h2>
          <EtapasPedido status={pedido.status} />
          <p className="detalhe-pedido__nota">{notaDoPedido(pedido)}</p>
          {ativo && pedido.atrasado && (
            <p className="pedido__atraso">
              <CircleAlert size={13} /> Passou do prazo previsto. Se precisar, fale com a cooperativa.
            </p>
          )}
          {telefone && (
            <a href={`tel:${telefone.replace(/\D/g, '')}`} className="pedido__info pedido__telefone">
              <Phone size={13} /> {pedido.cooperativa?.nome}: {telefone}
            </a>
          )}
          <CancelarPedido status={pedido.status} onCancelar={cancelar} />
        </section>

        <aside className="detalhe__lateral detalhe-pedido__lateral">
          <section className="card detalhe__secao" aria-labelledby="titulo-coleta">
            <h2 id="titulo-coleta" className="detalhe__titulo">
              Coleta
            </h2>
            <InfoColeta pedido={pedido} regiao={detalhe?.regiao ?? null} />
          </section>

          <section className="card detalhe__secao" aria-labelledby="titulo-materiais">
            <h2 id="titulo-materiais" className="detalhe__titulo">
              <PackageOpen size={16} aria-hidden="true" /> Materiais pedidos
            </h2>
            <ListaItens itens={pedido.itens} />
            {detalhe && detalhe.recolhidos.length > 0 && (
              <>
                <h3 className="detalhe__subtitulo">
                  <PackageCheck size={15} aria-hidden="true" /> Recolhidos na coleta
                </h3>
                <ListaItens itens={detalhe.recolhidos} />
              </>
            )}
            {pedido.observacoes && (
              <>
                <h3 className="detalhe__subtitulo">Suas observações</h3>
                <p className="detalhe-pedido__observacoes">{pedido.observacoes}</p>
              </>
            )}
          </section>
        </aside>

        <section className="card detalhe__secao detalhe-pedido__linha" aria-labelledby="titulo-historico">
          <h2 id="titulo-historico" className="detalhe__titulo">
            Histórico do pedido
          </h2>
          {!detalhe ? (
            <p className="texto-suave detalhe__carregando">
              <LoaderCircle size={16} className="girando" aria-hidden="true" /> Carregando o histórico...
            </p>
          ) : detalhe.historico.length === 0 ? (
            <p className="texto-suave">Nenhum evento registrado ainda.</p>
          ) : (
            <LinhaDoTempo eventos={detalhe.historico} idUsuario={idUsuario} />
          )}
        </section>
      </div>
    </div>
  )
}

