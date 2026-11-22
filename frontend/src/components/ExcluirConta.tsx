import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, LoaderCircle, Truck, X } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { mensagemDeErro } from '../services/api'
import { listarPedidos, statusCancelaveis, type Pedido } from '../services/pedidos'

interface Props {
  aoFechar: () => void
}

type Situacao =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; cancelaveis: Pedido[]; aCaminho: Pedido[] }
  | { tipo: 'erro' }

// Confirmação de DELETE /me num <dialog> modal (foco preso, Esc fecha, foco volta ao botão).
// Ao abrir, consulta os pedidos em andamento para dizer o que vai ser cancelado e
// avisar antes se há coleta a caminho (o back recusa com PICKUP_IN_ROUTE).
export default function ExcluirConta({ aoFechar }: Props) {
  const { excluirConta } = useAuth()
  const navigate = useNavigate()
  const dialogo = useRef<HTMLDialogElement>(null)
  const [situacao, setSituacao] = useState<Situacao>({ tipo: 'carregando' })
  const [entendeu, setEntendeu] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
  }, [])

  useEffect(() => {
    const controle = new AbortController()
    listarPedidos({ abertos: true, limite: 100 }, controle.signal)
      .then((pagina) =>
        setSituacao({
          tipo: 'pronto',
          cancelaveis: pagina.items.filter((p) => statusCancelaveis.includes(p.status)),
          aCaminho: pagina.items.filter((p) => p.status === 'EM_ROTA'),
        }),
      )
      .catch(() => {
        if (!controle.signal.aborted) setSituacao({ tipo: 'erro' })
      })
    return () => controle.abort()
  }, [])

  const aCaminho = situacao.tipo === 'pronto' && situacao.aCaminho.length > 0
  const podeExcluir = entendeu && !excluindo && !aCaminho && situacao.tipo !== 'carregando'

  async function aoConfirmar(evento: FormEvent) {
    evento.preventDefault()
    if (!podeExcluir) return
    setExcluindo(true)
    setErro('')
    try {
      await excluirConta()
      navigate('/', { replace: true, state: { contaExcluida: true } })
    } catch (falha) {
      setErro(mensagemDeErro(falha, 'Não foi possível excluir a conta. Tente de novo.'))
      setExcluindo(false)
    }
  }

  function fechar() {
    if (!excluindo) dialogo.current?.close()
  }

  return (
    <dialog
      ref={dialogo}
      className="janela excluir-conta"
      aria-labelledby="excluir-conta-titulo"
      aria-describedby="excluir-conta-resumo"
      onClose={aoFechar}
      onCancel={(e) => {
        // Esc não fecha no meio da exclusão
        if (excluindo) e.preventDefault()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar()
      }}
    >
      <form className="janela__caixa" onSubmit={aoConfirmar}>
        <div className="janela__topo">
          <h2 id="excluir-conta-titulo" className="janela__titulo excluir-conta__titulo">
            Excluir sua conta?
          </h2>
          <button
            type="button"
            className="janela__fechar"
            aria-label="Fechar"
            onClick={fechar}
            disabled={excluindo}
          >
            <X size={18} />
          </button>
        </div>

        <p id="excluir-conta-resumo">
          Seus dados pessoais são apagados e <strong>isso não pode ser desfeito</strong>. Para
          usar o ReciclaBairro de novo, será preciso criar outra conta.
        </p>

        <ul className="excluir-conta__lista">
          <li>Nome, e-mail, telefone e endereços são apagados.</li>
          <li>As notificações e as sessões abertas em outros aparelhos são encerradas.</li>
          <li>
            Os pedidos antigos continuam nas estatísticas do bairro, sem seu nome e sem
            endereço.
          </li>
        </ul>

        {situacao.tipo === 'carregando' && (
          <p className="texto-suave excluir-conta__pedidos" aria-busy="true">
            <LoaderCircle size={15} className="girando" aria-hidden="true" /> Conferindo seus
            pedidos em andamento...
          </p>
        )}
        {situacao.tipo === 'erro' && (
          <p className="alerta alerta--info">
            <AlertCircle size={18} aria-hidden="true" />
            <span>
              Não conseguimos conferir seus pedidos agora. Se houver pedidos enviados, em
              análise ou agendados, eles serão cancelados.
            </span>
          </p>
        )}
        {situacao.tipo === 'pronto' && aCaminho && (
          <p className="alerta alerta--erro" role="alert">
            <Truck size={18} aria-hidden="true" />
            <span>
              Há uma coleta a caminho ({situacao.aCaminho.map((p) => p.protocolo).join(', ')}).
              Aguarde a conclusão para excluir sua conta.
            </span>
          </p>
        )}
        {situacao.tipo === 'pronto' && !aCaminho && situacao.cancelaveis.length > 0 && (
          <p className="alerta alerta--erro">
            <AlertCircle size={18} aria-hidden="true" />
            <span>
              {situacao.cancelaveis.length === 1
                ? 'Seu pedido em andamento'
                : `Seus ${situacao.cancelaveis.length} pedidos em andamento`}{' '}
              ({situacao.cancelaveis.map((p) => p.protocolo).join(', ')}){' '}
              {situacao.cancelaveis.length === 1 ? 'será cancelado' : 'serão cancelados'}.
            </span>
          </p>
        )}
        {situacao.tipo === 'pronto' && !aCaminho && situacao.cancelaveis.length === 0 && (
          <p className="texto-suave excluir-conta__pedidos">
            Você não tem pedidos em andamento.
          </p>
        )}

        {!aCaminho && (
          <label className="caixa">
            <input
              type="checkbox"
              checked={entendeu}
              disabled={excluindo}
              onChange={(e) => setEntendeu(e.target.checked)}
            />
            <span>Entendo que minha conta será excluída e que isso não pode ser desfeito.</span>
          </label>
        )}

        {erro && (
          <p className="alerta alerta--erro" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{erro}</span>
          </p>
        )}

        <div className="janela__acoes">
          <button type="button" className="btn btn--contorno" onClick={fechar} disabled={excluindo}>
            {aCaminho ? 'Fechar' : 'Manter minha conta'}
          </button>
          {!aCaminho && (
            <button className="btn btn--perigo" disabled={!podeExcluir}>
              {excluindo ? (
                <>
                  <LoaderCircle size={16} className="girando" /> Excluindo...
                </>
              ) : (
                'Excluir minha conta'
              )}
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
