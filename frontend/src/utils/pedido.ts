// Textos e regras de exibição de um pedido de retirada, usados no cartão de "Seus pedidos"
// (Solicitações) e na página de detalhe do pedido.

import {
  rotulosUnidade,
  type Pedido,
  type StatusPedido,
  type UnidadeQuantidade,
} from '../services/pedidos'

const formatoNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** "2 sacos", "1,5 kg" */
export function rotuloQuantidade(quantidade: number, unidade: UnidadeQuantidade) {
  const [singular, plural] = rotulosUnidade[unidade]
  return `${formatoNumero.format(quantidade)} ${quantidade === 1 ? singular : plural}`
}

/** EM_ANALISE -> "em-analise" (sufixo de .pedido__status--) */
export const classeStatus = (status: StatusPedido) => status.toLowerCase().replace('_', '-')

/** Data que vale para mostrar e ordenar: a agendada, senão a preferida */
export const dataDoPedido = (p: Pedido) => p.dataAgendada ?? p.dataPreferida

/** Etapas da barra de andamento (só para pedidos em aberto) */
export const ETAPAS: { status: StatusPedido; nome: string }[] = [
  { status: 'SOLICITADA', nome: 'Enviado' },
  { status: 'EM_ANALISE', nome: 'Em análise' },
  { status: 'AGENDADA', nome: 'Agendado' },
  { status: 'EM_ROTA', nome: 'A caminho' },
]

/** Uma frase sobre a situação atual do pedido */
export function notaDoPedido(p: Pedido) {
  const cooperativa = p.cooperativa?.nome ?? 'a cooperativa'
  switch (p.status) {
    case 'SOLICITADA':
      return 'Aguardando uma cooperativa assumir o pedido.'
    case 'EM_ANALISE':
      return `Em análise por ${cooperativa}.`
    case 'AGENDADA':
      return `Agendado por ${cooperativa}${p.coletor ? `, com ${p.coletor.nome}` : ''}. Deixe os materiais separados.`
    case 'EM_ROTA':
      return `${p.coletor?.nome ?? 'O coletor'} está a caminho.`
    case 'CONCLUIDA':
      return p.notaConclusao ? `Coleta concluída: ${p.notaConclusao}` : 'Coleta concluída. Obrigado por reciclar!'
    case 'CANCELADA':
      return p.motivo ? `Cancelado: ${p.motivo}` : 'Pedido cancelado.'
    case 'RECUSADA':
      return `Recusado${p.cooperativa ? ` por ${p.cooperativa.nome}` : ''}${p.motivo ? `: ${p.motivo}` : '.'}`
  }
}

/** Telefone da cooperativa, só enquanto o pedido está com ela (depois de assumido e antes de encerrar) */
export function telefoneDaCooperativa(p: Pedido) {
  const comACooperativa = ['EM_ANALISE', 'AGENDADA', 'EM_ROTA'].includes(p.status)
  return comACooperativa ? (p.cooperativa?.telefone ?? null) : null
}
