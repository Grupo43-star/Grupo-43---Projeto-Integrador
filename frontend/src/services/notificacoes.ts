// Notificações da pessoa logada, vindas do back:
//   GET  /notifications?limit=N   -> { items, total, ..., unreadCount }
//   POST /notifications/:id/read  (marca uma como lida)
//   POST /notifications/read-all  (marca todas)
// O back gera os avisos a cada mudança de status dos pedidos de retirada
// (type = PICKUP_CREATED, PICKUP_SCHEDULED, PICKUP_COMPLETED...).

import type { Papel } from '../data/usuario'
import { api, consulta, type Pagina } from './api'

interface NotificacaoApi {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, string> | null
  readAt: string | null
  createdAt: string
}

export interface Notificacao {
  id: string
  tipo: string // type do back, ex.: PICKUP_SCHEDULED
  titulo: string
  texto: string
  criadaEm: string // ISO com horário
  lida: boolean
  link: string
}

export interface CaixaDeNotificacoes {
  lista: Notificacao[]
  naoLidas: number
}

const QUANTIDADE = 20

/**
 * Tela que a notificação abre. Hoje todas são sobre pedidos de retirada e o back manda
 * `data.pickupRequestId`: quem pediu abre o detalhe em Solicitações, a gestão da cooperativa
 * abre o pedido no painel dela e o coletor abre a coleta. Sem o id, a lista de cada um.
 */
function linkDa(notificacao: NotificacaoApi, papel: Papel) {
  if (!notificacao.type.startsWith('PICKUP_')) return '/'
  const id = notificacao.data?.pickupRequestId
  const base =
    papel === 'GESTOR_COOPERATIVA'
      ? '/cooperativa/pedidos'
      : papel === 'COLETOR'
        ? '/coletor/coletas'
        : '/solicitacoes'
  if (!id) return papel === 'COLETOR' ? '/coletor' : base
  return `${base}/${encodeURIComponent(id)}`
}

export async function listarNotificacoes(papel: Papel): Promise<CaixaDeNotificacoes> {
  const pagina = await api<Pagina<NotificacaoApi> & { unreadCount: number }>(
    `/notifications${consulta({ limit: QUANTIDADE })}`,
  )
  return {
    naoLidas: pagina.unreadCount,
    lista: pagina.items.map((n) => ({
      id: n.id,
      tipo: n.type,
      titulo: n.title,
      texto: n.body,
      criadaEm: n.createdAt,
      lida: n.readAt !== null,
      link: linkDa(n, papel),
    })),
  }
}

export function marcarComoLida(id: string) {
  return api<void>(`/notifications/${id}/read`, { metodo: 'POST' })
}

export function marcarTodasComoLidas() {
  return api<void>('/notifications/read-all', { metodo: 'POST' })
}
