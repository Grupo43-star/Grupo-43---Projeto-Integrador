import { Building2, CalendarDays, MapPin, Phone, User } from 'lucide-react'
import {
  rotulosEvento,
  rotulosPeriodo,
  rotulosStatus,
  type EventoPedido,
  type ItemPedido,
  type Pedido,
  type TipoEvento,
} from '../services/pedidos'
import { propsCategoria } from '../utils/corCategoria'
import { dataDeIso, dataPorExtenso } from '../utils/formatar'
import { classeStatus, rotuloQuantidade } from '../utils/pedido'

// Partes do detalhe de um pedido usadas por quem pediu (/solicitacoes/:id) e pela equipe
// (painel da cooperativa e do coletor). `visao` muda só os textos ("você" x "o solicitante").

type Visao = 'solicitante' | 'equipe'

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const formatoDataLonga = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const telefoneLink = (telefone: string) => `tel:${telefone.replace(/\D/g, '')}`

export function InfoColeta({
  pedido,
  regiao,
  visao = 'solicitante',
}: {
  pedido: Pedido
  regiao: string | null
  visao?: Visao
}) {
  const agendado = pedido.dataAgendada !== null
  const data = pedido.dataAgendada ?? pedido.dataPreferida
  const periodo = agendado ? pedido.periodoAgendado : pedido.periodoPreferido
  const equipe = visao === 'equipe'

  return (
    <dl className="detalhe-pedido__dados">
      <div>
        <dt>
          <CalendarDays size={14} aria-hidden="true" />{' '}
          {agendado ? 'Data agendada' : equipe ? 'Preferência do solicitante' : 'Sua preferência'}
        </dt>
        <dd>
          <strong>{data ? dataPorExtenso(dataDeIso(data)) : 'Sem dia definido'}</strong>
          <span>{periodo ? rotulosPeriodo[periodo] : 'Qualquer horário'}</span>
          {agendado && pedido.dataPreferida && pedido.dataPreferida !== pedido.dataAgendada && (
            <span className="texto-suave">
              {equipe ? 'O solicitante pediu' : 'Você tinha pedido'}{' '}
              {formatoDataLonga.format(dataDeIso(pedido.dataPreferida))}.
            </span>
          )}
        </dd>
      </div>
      <div>
        <dt>
          <MapPin size={14} aria-hidden="true" /> Local
        </dt>
        <dd>
          <span>{pedido.endereco}</span>
          {regiao && <span className="texto-suave">Região {regiao}</span>}
        </dd>
      </div>
      {pedido.cooperativa && !equipe && (
        <div>
          <dt>
            <Building2 size={14} aria-hidden="true" /> Cooperativa
          </dt>
          <dd>{pedido.cooperativa.nome}</dd>
        </div>
      )}
      {pedido.coletor && (
        <div>
          <dt>
            <User size={14} aria-hidden="true" /> Coletor
          </dt>
          <dd>
            <span>{pedido.coletor.nome}</span>
            {pedido.coletor.telefone && (
              <a href={telefoneLink(pedido.coletor.telefone)} className="pedido__info pedido__telefone">
                <Phone size={13} aria-hidden="true" /> {pedido.coletor.telefone}
              </a>
            )}
          </dd>
        </div>
      )}
    </dl>
  )
}

export function ListaItens({ itens }: { itens: ItemPedido[] }) {
  return (
    <ul className="detalhe-pedido__itens">
      {itens.map((i) => (
        <li key={`${i.categoria.id}-${i.unidade}`}>
          <span {...propsCategoria(i.categoria, 'tag')}>{i.categoria.nome}</span>
          <span>{rotuloQuantidade(i.quantidade, i.unidade)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Mais recente primeiro: o que aconteceu por último é o que a pessoa procura */
export function LinhaDoTempo({
  eventos,
  idUsuario,
  visao = 'solicitante',
}: {
  eventos: EventoPedido[]
  idUsuario: string
  visao?: Visao
}) {
  const ordenados = [...eventos].reverse()
  const equipe = visao === 'equipe'
  return (
    <ol className="linha-tempo">
      {ordenados.map((e, i) => {
        const titulo =
          equipe && e.tipo === 'CANCELLED_BY_REQUESTER'
            ? 'Cancelado pelo solicitante'
            : (rotulosEvento[e.tipo as TipoEvento] ?? rotulosStatus[e.para])
        const porVoce = e.autor?.id === idUsuario
        // "Você cancelou o pedido" já diz quem foi
        const mostrarAutor =
          e.autor && !(!equipe && porVoce && (e.tipo === 'CREATED' || e.tipo === 'CANCELLED_BY_REQUESTER'))
        return (
          <li key={e.id} className={`linha-tempo__item${i === 0 ? ' linha-tempo__item--atual' : ''}`}>
            <span className={`linha-tempo__ponto linha-tempo__ponto--${classeStatus(e.para)}`} aria-hidden="true" />
            <div className="linha-tempo__conteudo">
              <p className="linha-tempo__titulo">{titulo}</p>
              <p className="linha-tempo__meta">
                <time dateTime={e.criadoEm}>{formatoDataHora.format(new Date(e.criadoEm))}</time>
                {mostrarAutor && <> · {porVoce ? 'por você' : `por ${e.autor?.nome}`}</>}
              </p>
              {e.comentario && <p className="linha-tempo__comentario">{e.comentario}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
