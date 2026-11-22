import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, CircleAlert, LoaderCircle, MapPin, Phone, RotateCw, User, type LucideIcon } from 'lucide-react'
import { mensagemDeErro } from '../services/api'
import type { PedidoEquipe } from '../services/equipe'
import { rotulosPeriodo, rotulosStatus } from '../services/pedidos'
import { propsCategoria } from '../utils/corCategoria'
import { dataDeIso, dataPorExtenso } from '../utils/formatar'
import { classeStatus, rotuloQuantidade } from '../utils/pedido'

// Pedaços repetidos nos painéis da equipe (cooperativa, coletor e administração).

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div className="card painel__vazio" aria-busy="true">
      <LoaderCircle size={22} className="girando" aria-hidden="true" />
      <p className="texto-suave">{texto}</p>
    </div>
  )
}

/** Alerta vermelho com a mensagem do back e "Tentar novamente" */
export function ErroComTentar({
  erro,
  titulo,
  aoTentar,
}: {
  erro: unknown
  titulo: string
  aoTentar: () => void
}) {
  return (
    <div className="alerta alerta--erro painel__erro" role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span>
        {titulo} {mensagemDeErro(erro)}
      </span>
      <button type="button" className="btn btn--contorno btn--pequeno" onClick={aoTentar}>
        <RotateCw size={14} /> Tentar novamente
      </button>
    </div>
  )
}

export function Vazio({
  icone: Icone,
  titulo,
  children,
}: {
  icone: LucideIcon
  titulo: string
  children?: ReactNode
}) {
  return (
    <div className="card painel__vazio">
      <span className="icon-circle">
        <Icone size={20} strokeWidth={1.75} />
      </span>
      <h2 className="card__titulo">{titulo}</h2>
      {children}
    </div>
  )
}

/** Ativo/Inativo, Ativa/Inativa */
export function SeloAtivo({ ativo, feminino = false }: { ativo: boolean; feminino?: boolean }) {
  return (
    <span className={`selo-ativo ${ativo ? '' : 'selo-ativo--inativo'}`}>
      {ativo ? (feminino ? 'Ativa' : 'Ativo') : feminino ? 'Inativa' : 'Inativo'}
    </span>
  )
}

const formatoCriado = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** Cartão de um pedido na fila da cooperativa e na lista do coletor */
export function CartaoPedidoEquipe({
  pedido,
  link,
  mostrarColetor = true,
  children,
}: {
  pedido: PedidoEquipe
  link: string
  mostrarColetor?: boolean
  /** Ações rápidas no rodapé (ex.: "Iniciar rota") */
  children?: ReactNode
}) {
  const data = pedido.dataAgendada ?? pedido.dataPreferida
  const periodo = pedido.dataAgendada ? pedido.periodoAgendado : pedido.periodoPreferido
  return (
    <li className="card pedido-equipe">
      <div className="pedido-equipe__topo">
        <Link to={link} className="pedido-equipe__protocolo">
          {pedido.protocolo}
        </Link>
        <span className={`pedido__status pedido__status--${classeStatus(pedido.status)}`}>
          {rotulosStatus[pedido.status]}
        </span>
        {pedido.atrasado && (
          <span className="pedido-equipe__atraso">
            <CircleAlert size={13} aria-hidden="true" /> Atrasado
          </span>
        )}
        <span className="pedido-equipe__criado">Enviado {formatoCriado.format(new Date(pedido.criadoEm))}</span>
      </div>

      <div className="pedido-equipe__corpo">
        <div className="pedido-equipe__quando">
          <strong>{data ? dataPorExtenso(dataDeIso(data)) : 'Sem dia definido'}</strong>
          <span>
            {pedido.dataAgendada ? 'Agendado' : 'Preferência'}
            {' · '}
            {periodo ? rotulosPeriodo[periodo] : 'Qualquer horário'}
          </span>
        </div>
        <div className="pedido-equipe__info">
          {pedido.solicitante && (
            <span>
              <User size={13} aria-hidden="true" /> {pedido.solicitante.nome}
              {pedido.solicitante.telefone && (
                <a href={`tel:${pedido.solicitante.telefone.replace(/\D/g, '')}`} className="pedido-equipe__tel">
                  <Phone size={12} aria-hidden="true" /> {pedido.solicitante.telefone}
                </a>
              )}
            </span>
          )}
          <span>
            <MapPin size={13} aria-hidden="true" /> {pedido.endereco}
            {pedido.regiao && <span className="texto-suave"> · Região {pedido.regiao}</span>}
          </span>
          {mostrarColetor && (
            <span className="texto-suave">
              Coletor: {pedido.coletor ? pedido.coletor.nome : 'ainda não definido'}
            </span>
          )}
        </div>
      </div>

      <ul className="pedido__materiais" aria-label="Materiais">
        {pedido.itens.map((i) => (
          <li key={`${i.categoria.id}-${i.unidade}`} {...propsCategoria(i.categoria, 'tag')}>
            {i.categoria.nome} · {rotuloQuantidade(i.quantidade, i.unidade)}
          </li>
        ))}
      </ul>

      <div className="pedido-equipe__rodape">
        <Link to={link} className="link-seta">
          Abrir pedido <ArrowRight size={14} aria-hidden="true" />
        </Link>
        {children}
      </div>
    </li>
  )
}
