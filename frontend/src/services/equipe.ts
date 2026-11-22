// Pedidos de retirada vistos pela equipe: gestão da cooperativa e coletor.
//
// Gestão da cooperativa (GESTOR_COOPERATIVA):
//   GET  /cooperative/pickup-requests        fila: os pedidos da cooperativa + os novos (SOLICITADA,
//        sem cooperativa) das regiões que ela atende. Filtros: status, regionId, materialCategoryId,
//        collectorId, from/to (criação), scheduledDate, late, protocol, page, limit.
//   GET  /cooperative/pickup-requests/:id    detalhe (com o solicitante: nome, telefone, e-mail)
//   POST /:id/start-review                   SOLICITADA -> EM_ANALISE (assume para a cooperativa)
//   POST /:id/schedule  { scheduledDate, scheduledPeriod?, collectorId?, comment? }
//        EM_ANALISE -> AGENDADA, ou reagenda (AGENDADA -> AGENDADA, comment obrigatório)
//   POST /:id/assign    { collectorId }      só AGENDADA
//   POST /:id/refuse    { reason }           só EM_ANALISE (motivo de 3 a 500)
//   POST /:id/cancel    { reason }           qualquer status aberto
//
// Execução da coleta (COLETOR; o gestor também pode):
//   GET  /collector/pickups?date=            só COLETOR: coletas dele AGENDADA/EM_ROTA no dia
//        (sem data: hoje e as vencidas). Devolve uma lista simples, sem paginação.
//   GET  /collector/pickups/:id              detalhe
//   POST /:id/start-route                    AGENDADA -> EM_ROTA, só no dia agendado
//   POST /:id/complete  { collectedItems[], notes? }   EM_ROTA -> CONCLUIDA
//   POST /:id/not-collected  { reason }      EM_ROTA -> AGENDADA (precisa de nova data)
//
// Todas as ações devolvem o pedido completo (com a linha do tempo).

import { api, consulta, type Pagina } from './api'
import {
  converterDetalhe,
  converterPedido,
  type DetalhePedido,
  type DetalhePedidoApi,
  type Pedido,
  type PedidoApi,
  type PeriodoRetirada,
  type StatusPedido,
  type UnidadeQuantidade,
} from './pedidos'

export interface Solicitante {
  nome: string
  telefone: string | null
  email: string
}

export interface PedidoEquipe extends Pedido {
  solicitante: Solicitante | null
  regiao: string | null
  idColetor: string | null
}

export interface DetalhePedidoEquipe extends DetalhePedido {
  solicitante: Solicitante | null
  idColetor: string | null
}

interface ExtraEquipeApi {
  requester?: { id: string; name: string; phone: string | null; email: string } | null
  region?: { id: string; name: string } | null
  collectorId?: string | null
}

const solicitanteDe = (p: ExtraEquipeApi): Solicitante | null =>
  p.requester ? { nome: p.requester.name, telefone: p.requester.phone, email: p.requester.email } : null

function converterDaFila(p: PedidoApi & ExtraEquipeApi): PedidoEquipe {
  return {
    ...converterPedido(p),
    solicitante: solicitanteDe(p),
    regiao: p.region?.name ?? null,
    idColetor: p.collectorId ?? null,
  }
}

function converterDetalheEquipe(p: DetalhePedidoApi & ExtraEquipeApi): DetalhePedidoEquipe {
  return { ...converterDetalhe(p), solicitante: solicitanteDe(p), idColetor: p.collectorId ?? null }
}

// ---------- Fila da cooperativa ----------

export interface FiltrosFila {
  status: StatusPedido | ''
  regiaoId: string
  categoriaId: string
  coletorId: string
  /** Criados de/até (AAAA-MM-DD) */
  de: string
  ate: string
  agendadoPara: string
  atrasados: boolean
  protocolo: string
}

export const filtrosFilaVazios: FiltrosFila = {
  status: '',
  regiaoId: '',
  categoriaId: '',
  coletorId: '',
  de: '',
  ate: '',
  agendadoPara: '',
  atrasados: false,
  protocolo: '',
}

export const POR_PAGINA_FILA = 20

/**
 * Ordem do back: "fila de trabalho" (status aberto ou só atrasados) do mais antigo ao mais
 * novo; consulta geral do mais novo ao mais antigo.
 */
export async function listarFila(
  filtros: FiltrosFila,
  pagina: number,
  sinal?: AbortSignal,
): Promise<Pagina<PedidoEquipe>> {
  const resposta = await api<Pagina<PedidoApi & ExtraEquipeApi>>(
    `/cooperative/pickup-requests${consulta({
      status: filtros.status,
      regionId: filtros.regiaoId,
      materialCategoryId: filtros.categoriaId,
      collectorId: filtros.coletorId,
      from: filtros.de,
      to: filtros.ate,
      scheduledDate: filtros.agendadoPara,
      late: filtros.atrasados ? true : undefined,
      protocol: filtros.protocolo.trim(),
      page: pagina,
      limit: POR_PAGINA_FILA,
    })}`,
    { sinal },
  )
  return { ...resposta, items: resposta.items.map(converterDaFila) }
}

/** Quantos pedidos em um status (ou atrasados), para os atalhos da fila: usa o `total`. */
export async function contarFila(
  filtro: { status?: StatusPedido; atrasados?: boolean },
  sinal?: AbortSignal,
): Promise<number> {
  const pagina = await api<Pagina<unknown>>(
    `/cooperative/pickup-requests${consulta({
      status: filtro.status,
      late: filtro.atrasados ? true : undefined,
      limit: 1,
    })}`,
    { sinal },
  )
  return pagina.total
}

const caminhoCooperativa = (id: string) => `/cooperative/pickup-requests/${encodeURIComponent(id)}`
const caminhoColetor = (id: string) => `/collector/pickups/${encodeURIComponent(id)}`

/** Erros: 404 PICKUP_REQUEST_NOT_FOUND, 403 NOT_YOUR_REQUEST (de outra cooperativa), 400 id inválido. */
export async function buscarPedidoCooperativa(id: string, sinal?: AbortSignal) {
  return converterDetalheEquipe(await api<DetalhePedidoApi & ExtraEquipeApi>(caminhoCooperativa(id), { sinal }))
}

async function acao(caminho: string, corpo: object = {}) {
  return converterDetalheEquipe(
    await api<DetalhePedidoApi & ExtraEquipeApi>(caminho, { metodo: 'POST', corpo }),
  )
}

export const iniciarAnalise = (id: string) => acao(`${caminhoCooperativa(id)}/start-review`)

export interface Agendamento {
  data: string
  /** null = o back mantém o período já combinado ou o preferido */
  periodo: PeriodoRetirada | null
  coletorId: string
  /** Recado ao solicitante (obrigatório ao reagendar) */
  comentario: string
}

export function agendarPedido(id: string, dados: Agendamento) {
  const comentario = dados.comentario.trim()
  return acao(`${caminhoCooperativa(id)}/schedule`, {
    scheduledDate: dados.data,
    ...(dados.periodo ? { scheduledPeriod: dados.periodo } : {}),
    ...(dados.coletorId ? { collectorId: dados.coletorId } : {}),
    ...(comentario ? { comment: comentario } : {}),
  })
}

export const atribuirColetor = (id: string, coletorId: string) =>
  acao(`${caminhoCooperativa(id)}/assign`, { collectorId: coletorId })

export const recusarPedido = (id: string, motivo: string) =>
  acao(`${caminhoCooperativa(id)}/refuse`, { reason: motivo.trim() })

export const cancelarPelaCooperativa = (id: string, motivo: string) =>
  acao(`${caminhoCooperativa(id)}/cancel`, { reason: motivo.trim() })

// ---------- Execução da coleta ----------

/** Só COLETOR. `data` vazia: as de hoje e as vencidas (o padrão do back). */
export async function listarColetas(data: string, sinal?: AbortSignal): Promise<PedidoEquipe[]> {
  const lista = await api<(PedidoApi & ExtraEquipeApi)[]>(
    `/collector/pickups${consulta({ date: data })}`,
    { sinal },
  )
  return lista.map(converterDaFila)
}

/** Erros: 404, 403 NOT_YOUR_REQUEST / NOT_ASSIGNED_TO_YOU (está com outro coletor). */
export async function buscarColeta(id: string, sinal?: AbortSignal) {
  return converterDetalheEquipe(await api<DetalhePedidoApi & ExtraEquipeApi>(caminhoColetor(id), { sinal }))
}

/** Erro NOT_SCHEDULED_FOR_TODAY (422) se a coleta não for de hoje. */
export const iniciarRota = (id: string) => acao(`${caminhoColetor(id)}/start-route`)

export interface ItemRecolhido {
  categoriaId: string
  quantidade: number
  unidade: UnidadeQuantidade
}

export function concluirColeta(id: string, itens: ItemRecolhido[], observacao: string) {
  const notas = observacao.trim()
  return acao(`${caminhoColetor(id)}/complete`, {
    collectedItems: itens.map((i) => ({ categoryId: i.categoriaId, quantity: i.quantidade, unit: i.unidade })),
    ...(notas ? { notes: notas } : {}),
  })
}

export const registrarNaoRealizada = (id: string, motivo: string) =>
  acao(`${caminhoColetor(id)}/not-collected`, { reason: motivo.trim() })

// ---------- Equipe da cooperativa ----------
//   GET   /cooperative/members              gestores e coletores
//   POST  /cooperative/members  { name, email, password, phone? }   cria a conta de um COLETOR
//   PATCH /cooperative/members/:memberId { active }  desativar tira o acesso, encerra as sessões
//         e deixa as coletas AGENDADAS dele sem coletor

export interface Membro {
  /** id do vínculo (usado no PATCH) */
  id: string
  papel: 'GESTOR' | 'COLETOR'
  ativo: boolean
  desde: string
  usuario: { id: string; nome: string; email: string; telefone: string | null }
}

export interface MembroApi {
  id: string
  role: 'GESTOR' | 'COLETOR'
  active: boolean
  createdAt: string
  user: { id: string; name: string; email: string; phone: string | null }
}

export function converterMembro(m: MembroApi): Membro {
  return {
    id: m.id,
    papel: m.role,
    ativo: m.active,
    desde: m.createdAt,
    usuario: { id: m.user.id, nome: m.user.name, email: m.user.email, telefone: m.user.phone },
  }
}

export async function listarMembros(sinal?: AbortSignal): Promise<Membro[]> {
  return (await api<MembroApi[]>('/cooperative/members', { sinal })).map(converterMembro)
}

export interface NovoMembro {
  nome: string
  email: string
  /** Senha inicial (8 a 72); a pessoa pode trocar depois em "Esqueci minha senha" */
  senha: string
  telefone: string
}

export const corpoDoMembro = (dados: NovoMembro) => ({
  name: dados.nome.trim(),
  email: dados.email.trim(),
  password: dados.senha,
  ...(dados.telefone ? { phone: dados.telefone } : {}),
})

/** Erro EMAIL_IN_USE (409). */
export async function cadastrarColetor(dados: NovoMembro): Promise<Membro> {
  return converterMembro(
    await api<MembroApi>('/cooperative/members', { metodo: 'POST', corpo: corpoDoMembro(dados) }),
  )
}

export async function alterarMembro(id: string, ativo: boolean): Promise<Membro> {
  return converterMembro(
    await api<MembroApi>(`/cooperative/members/${encodeURIComponent(id)}`, {
      metodo: 'PATCH',
      corpo: { active: ativo },
    }),
  )
}
