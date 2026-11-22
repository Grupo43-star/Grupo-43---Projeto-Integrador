import type { StatusPedido } from '../services/pedidos'
import { ETAPAS } from '../utils/pedido'

/** Barra Enviado > Em análise > Agendado > A caminho. Não aparece em pedidos encerrados. */
export default function EtapasPedido({ status }: { status: StatusPedido }) {
  const atual = ETAPAS.findIndex((e) => e.status === status)
  if (atual < 0) return null
  return (
    <ol className="pedido__etapas" aria-label="Andamento do pedido">
      {ETAPAS.map((etapa, i) => (
        <li
          key={etapa.status}
          className={i <= atual ? 'pedido__etapa--feita' : ''}
          aria-current={i === atual ? 'step' : undefined}
        >
          {etapa.nome}
        </li>
      ))}
    </ol>
  )
}
