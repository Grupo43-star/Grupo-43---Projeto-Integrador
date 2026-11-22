import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  CalendarCheck,
  CircleAlert,
  CircleX,
  Leaf,
  LoaderCircle,
  Search,
  Send,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { usePainel } from '../../hooks/usePainel'
import {
  listarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
  type CaixaDeNotificacoes,
} from '../../services/notificacoes'

/** Ícone por tipo de aviso do back (PICKUP_<evento>) */
const icones: Record<string, LucideIcon> = {
  PICKUP_CREATED: Send,
  PICKUP_REVIEW_STARTED: Search,
  PICKUP_SCHEDULED: CalendarCheck,
  PICKUP_RESCHEDULED: CalendarCheck,
  PICKUP_NOT_COLLECTED: CalendarCheck,
  PICKUP_ROUTE_STARTED: Truck,
  PICKUP_COMPLETED: Leaf,
  PICKUP_REFUSED: CircleX,
  PICKUP_CANCELLED_BY_REQUESTER: CircleX,
  PICKUP_CANCELLED_BY_COOPERATIVE: CircleX,
}

/** Classe de cor do ícone (as cores ficam em layout.css) */
function corDo(tipo: string) {
  if (tipo === 'PICKUP_COMPLETED') return 'concluido'
  if (tipo === 'PICKUP_SCHEDULED' || tipo === 'PICKUP_RESCHEDULED') return 'confirmado'
  if (tipo.includes('CANCELLED') || tipo === 'PICKUP_REFUSED') return 'cancelado'
  return 'enviado'
}

/** "Hoje", "Ontem", "Há 12 dias" a partir do horário em que o aviso foi criado */
function quando(iso: string) {
  const criada = new Date(iso)
  const agora = new Date()
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dias = Math.round((dia(agora) - dia(criada)) / 86_400_000)
  if (dias <= 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  return `Há ${dias} dias`
}

/** Sino da topbar com os avisos dos pedidos de retirada (GET /notifications) */
export default function Notificacoes() {
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  const { aberto, raiz, botao, alternar: alternarPainel, fechar } = usePainel()
  const [caixa, setCaixa] = useState<CaixaDeNotificacoes | null>(null)
  const [erro, setErro] = useState(false)
  const [recarga, setRecarga] = useState(0)

  // Atualiza ao trocar de página e ao abrir o sino (ex.: depois de enviar um pedido)
  useEffect(() => {
    if (!usuario) return
    let ativo = true
    listarNotificacoes(usuario.papel)
      .then((nova) => {
        if (!ativo) return
        setCaixa(nova)
        setErro(false)
      })
      .catch(() => ativo && setErro(true))
    return () => {
      ativo = false
    }
  }, [usuario, pathname, recarga])

  const lista = caixa?.lista ?? null
  const naoLidas = usuario && caixa ? caixa.naoLidas : 0

  function alternar() {
    if (!aberto) setRecarga((n) => n + 1)
    alternarPainel()
  }

  // Marca na tela na hora e avisa o back; se o back falhar, a próxima recarga corrige
  function marcarLida(id: string) {
    if (!caixa || caixa.lista.find((n) => n.id === id)?.lida) return
    setCaixa({
      naoLidas: Math.max(0, caixa.naoLidas - 1),
      lista: caixa.lista.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    })
    marcarComoLida(id).catch(() => undefined)
  }

  function marcarTodas() {
    if (!caixa) return
    setCaixa({ naoLidas: 0, lista: caixa.lista.map((n) => ({ ...n, lida: true })) })
    marcarTodasComoLidas().catch(() => undefined)
  }

  const rotulo = naoLidas
    ? `Notificações, ${naoLidas} ${naoLidas === 1 ? 'não lida' : 'não lidas'}`
    : 'Notificações'

  return (
    <div className="painel-topbar" ref={raiz}>
      <button
        ref={botao}
        type="button"
        className="topbar__icone topbar__sino"
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-controls="painel-notificacoes"
        aria-label={rotulo}
        title="Notificações"
        onClick={alternar}
      >
        <Bell size={18} aria-hidden="true" />
        {naoLidas > 0 && (
          <span className="topbar__contador" aria-hidden="true">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div
          id="painel-notificacoes"
          className="painel notificacoes"
          role="dialog"
          aria-label="Notificações"
        >
          <div className="painel__topo painel__topo--linha">
            <p className="painel__titulo">Notificações</p>
            {naoLidas > 0 && lista && (
              <button
                type="button"
                className="painel__acao"
                onClick={marcarTodas}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {!usuario ? (
            <div className="notificacoes__convite">
              <p className="painel__descricao">
                Entre para receber avisos sobre seus pedidos de retirada.
              </p>
              <Link
                to="/entrar"
                state={{ de: pathname }}
                className="btn btn--primario btn--pequeno"
                onClick={fechar}
              >
                Entrar na conta
              </Link>
            </div>
          ) : erro ? (
            <p className="alerta alerta--erro notificacoes__estado">
              <CircleAlert size={16} aria-hidden="true" /> Não foi possível carregar os avisos agora.
            </p>
          ) : !lista ? (
            <p className="painel__descricao notificacoes__estado notificacoes__carregando">
              <LoaderCircle size={15} className="girando" aria-hidden="true" /> Carregando...
            </p>
          ) : lista.length === 0 ? (
            <p className="painel__vazio">Nenhum aviso por enquanto. Tudo em dia!</p>
          ) : (
            <ul className="notificacoes__lista">
              {lista.map((n) => {
                const Icone = icones[n.tipo] ?? Bell
                const lida = n.lida
                return (
                  <li key={n.id}>
                    <Link
                      to={n.link}
                      className={`notificacao notificacao--${corDo(n.tipo)}${lida ? '' : ' notificacao--nova'}`}
                      onClick={() => {
                        marcarLida(n.id)
                        fechar()
                      }}
                    >
                      <span className="notificacao__icone" aria-hidden="true">
                        <Icone size={15} />
                      </span>
                      <span className="notificacao__texto">
                        <strong>
                          {!lida && <span className="sr-only">Nova: </span>}
                          {n.titulo}
                        </strong>
                        <span>{n.texto}</span>
                        <small>{quando(n.criadaEm)}</small>
                      </span>
                      {!lida && <span className="notificacao__ponto" aria-hidden="true" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

        </div>
      )}
    </div>
  )
}
