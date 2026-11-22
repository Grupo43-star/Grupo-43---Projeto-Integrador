// Solicitações de retirada da pessoa logada (MORADOR ou COMERCIANTE), vindas do back:
//   POST /pickup-requests             { addressId, items[], preferredDate?, preferredPeriod?, notes? }
//   GET  /pickup-requests?open=&page=&limit=  -> Pagina<Pedido> (mais recentes primeiro)
//   GET  /pickup-requests/:id         -> DetalhePedido (com a linha do tempo e o que foi recolhido)
//   POST /pickup-requests/:id/cancel  { reason? }  (só até AGENDADA)
// O endereço precisa estar cadastrado no perfil (addressId). Se a região do endereço não é
// atendida, o back responde 422 REGION_NOT_SERVED.

import type { CategoriaGuia } from './materiais'
import { api, consulta, type Pagina } from './api'

export type StatusPedido =
  | 'SOLICITADA'
  | 'EM_ANALISE'
  | 'AGENDADA'
  | 'EM_ROTA'
  | 'CONCLUIDA'
  | 'CANCELADA'
  | 'RECUSADA'

export type PeriodoRetirada = 'MANHA' | 'TARDE' | 'NOITE'
export type UnidadeQuantidade = 'SACOS' | 'KG' | 'CAIXAS' | 'UNIDADES'

export const statusAbertos: StatusPedido[] = ['SOLICITADA', 'EM_ANALISE', 'AGENDADA', 'EM_ROTA']
/** O solicitante cancela até AGENDADA; depois, só a cooperativa. */
export const statusCancelaveis: StatusPedido[] = ['SOLICITADA', 'EM_ANALISE', 'AGENDADA']

export const rotulosStatus: Record<StatusPedido, string> = {
  SOLICITADA: 'Enviado',
  EM_ANALISE: 'Em análise',
  AGENDADA: 'Agendado',
  EM_ROTA: 'A caminho',
  CONCLUIDA: 'Concluído',
  CANCELADA: 'Cancelado',
  RECUSADA: 'Recusado',
}

export const rotulosPeriodo: Record<PeriodoRetirada, string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
}

/** Singular e plural de cada unidade. */
export const rotulosUnidade: Record<UnidadeQuantidade, [string, string]> = {
  SACOS: ['saco', 'sacos'],
  KG: ['kg', 'kg'],
  CAIXAS: ['caixa', 'caixas'],
  UNIDADES: ['unidade', 'unidades'],
}

/** Limites do back: quantidade de 0,1 a 10000, até 20 itens, observações até 500. */
export const QUANTIDADE_MINIMA = 0.1
export const QUANTIDADE_MAXIMA = 10000

export interface ItemPedido {
  categoria: Pick<CategoriaGuia, 'id' | 'nome' | 'slug' | 'cor'>
  quantidade: number
  unidade: UnidadeQuantidade
}

export interface Pedido {
  id: string
  protocolo: string
  status: StatusPedido
  endereco: string // cópia do endereço no momento do pedido
  itens: ItemPedido[]
  dataPreferida: string | null // AAAA-MM-DD
  periodoPreferido: PeriodoRetirada | null
  dataAgendada: string | null
  periodoAgendado: PeriodoRetirada | null
  observacoes: string | null
  motivo: string | null // da recusa ou do cancelamento
  notaConclusao: string | null
  cooperativa: { nome: string; telefone: string | null } | null
  coletor: { nome: string; telefone: string | null } | null
  atrasado: boolean
  criadoEm: string // ISO
  concluidoEm: string | null
}

export interface NovoPedido {
  enderecoId: string
  itens: { categoriaId: string; quantidade: number; unidade: UnidadeQuantidade }[]
  dataPreferida: string | null
  periodoPreferido: PeriodoRetirada | null
  observacoes: string
}

interface CategoriaApi {
  id: string
  name: string
  slug: string
  color: string | null
}

export interface PedidoApi {
  id: string
  protocol: string | null
  status: StatusPedido
  addressText: string
  items: { quantity: number; unit: UnidadeQuantidade; category: CategoriaApi }[]
  preferredDate: string | null
  preferredPeriod: PeriodoRetirada | null
  scheduledDate: string | null
  scheduledPeriod: PeriodoRetirada | null
  requesterNotes: string | null
  closingReason: string | null
  completionNotes: string | null
  cooperative: { name: string; phone: string | null } | null
  collector: { name: string; phone?: string | null } | null
  late: boolean
  createdAt: string
  completedAt: string | null
}

export function converterPedido(p: PedidoApi): Pedido {
  return {
    id: p.id,
    protocolo: p.protocol ?? '',
    status: p.status,
    endereco: p.addressText,
    itens: converterItens(p.items),
    dataPreferida: p.preferredDate,
    periodoPreferido: p.preferredPeriod,
    dataAgendada: p.scheduledDate,
    periodoAgendado: p.scheduledPeriod,
    observacoes: p.requesterNotes,
    motivo: p.closingReason,
    notaConclusao: p.completionNotes,
    cooperativa: p.cooperative ? { nome: p.cooperative.name, telefone: p.cooperative.phone } : null,
    coletor: p.collector ? { nome: p.collector.name, telefone: p.collector.phone ?? null } : null,
    atrasado: p.late,
    criadoEm: p.createdAt,
    concluidoEm: p.completedAt,
  }
}

/** Abertos (open=true) ou encerrados (open=false), mais recentes primeiro. */
export async function listarPedidos(
  { abertos, pagina = 1, limite = 20 }: { abertos: boolean; pagina?: number; limite?: number },
  sinal?: AbortSignal,
): Promise<Pagina<Pedido>> {
  const resposta = await api<Pagina<PedidoApi>>(
    `/pickup-requests${consulta({ open: abertos, page: pagina, limit: limite })}`,
    { sinal },
  )
  return { ...resposta, items: resposta.items.map(converterPedido) }
}

// ---------- Detalhe (GET /pickup-requests/:id) ----------

/** Tipo de cada evento da linha do tempo (campo `kind` do histórico do back). */
export type TipoEvento =
  | 'CREATED'
  | 'REVIEW_STARTED'
  | 'SCHEDULED'
  | 'RESCHEDULED'
  | 'ASSIGNED'
  | 'REFUSED'
  | 'ROUTE_STARTED'
  | 'COMPLETED'
  | 'NOT_COLLECTED'
  | 'CANCELLED_BY_REQUESTER'
  | 'CANCELLED_BY_COOPERATIVE'

export const rotulosEvento: Record<TipoEvento, string> = {
  CREATED: 'Pedido enviado',
  REVIEW_STARTED: 'Cooperativa começou a analisar',
  SCHEDULED: 'Coleta agendada',
  RESCHEDULED: 'Coleta reagendada',
  ASSIGNED: 'Coletor definido',
  REFUSED: 'Pedido recusado',
  ROUTE_STARTED: 'Coletor a caminho',
  COMPLETED: 'Coleta concluída',
  NOT_COLLECTED: 'Coleta não realizada',
  CANCELLED_BY_REQUESTER: 'Você cancelou o pedido',
  CANCELLED_BY_COOPERATIVE: 'Cancelado pela cooperativa',
}

export interface EventoPedido {
  id: string
  tipo: TipoEvento | string // o back pode criar tipos novos: mostra o status nesse caso
  de: StatusPedido | null
  para: StatusPedido
  autor: { id: string; nome: string } | null
  comentario: string | null
  criadoEm: string // ISO
}

export interface DetalhePedido extends Pedido {
  /** O que o coletor registrou ao concluir (pode ser diferente do pedido). */
  recolhidos: ItemPedido[]
  /** Linha do tempo, do mais antigo ao mais novo. */
  historico: EventoPedido[]
  regiao: string | null
  latitude: number
  longitude: number
}

export interface DetalhePedidoApi extends PedidoApi {
  collectedItems?: PedidoApi['items']
  history?: {
    id: string
    kind: string
    fromStatus: StatusPedido | null
    toStatus: StatusPedido
    comment: string | null
    createdAt: string
    author: { id: string; name: string } | null
  }[]
  region?: { name: string } | null
  latitude: number
  longitude: number
}

function converterItens(itens: PedidoApi['items']): ItemPedido[] {
  return itens.map((i) => ({
    categoria: {
      id: i.category.id,
      nome: i.category.name,
      slug: i.category.slug,
      cor: i.category.color ?? null,
    },
    quantidade: i.quantity,
    unidade: i.unit,
  }))
}

export function converterDetalhe(p: DetalhePedidoApi): DetalhePedido {
  return {
    ...converterPedido(p),
    recolhidos: converterItens(p.collectedItems ?? []),
    historico: (p.history ?? []).map((h) => ({
      id: h.id,
      tipo: h.kind,
      de: h.fromStatus,
      para: h.toStatus,
      autor: h.author ? { id: h.author.id, nome: h.author.name } : null,
      comentario: h.comment,
      criadoEm: h.createdAt,
    })),
    regiao: p.region?.name ?? null,
    latitude: p.latitude,
    longitude: p.longitude,
  }
}

/** Erros: 404 PICKUP_REQUEST_NOT_FOUND, 403 NOT_YOUR_REQUEST, 400 se o id não for um UUID. */
export async function buscarPedido(id: string, sinal?: AbortSignal): Promise<DetalhePedido> {
  const pedido = await api<DetalhePedidoApi>(`/pickup-requests/${encodeURIComponent(id)}`, { sinal })
  return converterDetalhe(pedido)
}

export async function criarPedido(dados: NovoPedido): Promise<Pedido> {
  const observacoes = dados.observacoes.trim()
  const criado = await api<PedidoApi>('/pickup-requests', {
    metodo: 'POST',
    corpo: {
      addressId: dados.enderecoId,
      items: dados.itens.map((i) => ({
        categoryId: i.categoriaId,
        quantity: i.quantidade,
        unit: i.unidade,
      })),
      ...(dados.dataPreferida ? { preferredDate: dados.dataPreferida } : {}),
      ...(dados.periodoPreferido ? { preferredPeriod: dados.periodoPreferido } : {}),
      ...(observacoes ? { notes: observacoes } : {}),
    },
  })
  return converterPedido(criado)
}

/** O back responde com o pedido completo (com a linha do tempo). */
export async function cancelarPedido(id: string, motivo: string): Promise<DetalhePedido> {
  const texto = motivo.trim()
  const cancelado = await api<DetalhePedidoApi>(`/pickup-requests/${encodeURIComponent(id)}/cancel`, {
    metodo: 'POST',
    corpo: texto ? { reason: texto } : {},
  })
  return converterDetalhe(cancelado)
}

/**
 * Quantas retiradas da pessoa logada já foram concluídas.
 * GET /pickup-requests?status=CONCLUIDA&limit=1 -> usa o `total` da paginação.
 */
export async function contarColetasConcluidas(sinal?: AbortSignal): Promise<number> {
  const pagina = await api<Pagina<unknown>>(
    `/pickup-requests${consulta({ status: 'CONCLUIDA', limit: 1 })}`,
    { sinal },
  )
  return pagina.total
}
