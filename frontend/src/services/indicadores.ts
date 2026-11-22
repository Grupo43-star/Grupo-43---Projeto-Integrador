// Indicadores dos atendimentos (seção 5.4 do projeto do back):
//   GET /cooperative/dashboard   GESTOR_COOPERATIVA: só os pedidos da cooperativa
//   GET /admin/dashboard         ADMIN e EDUCADOR: toda a plataforma + uso do guia de materiais
// Filtros: from/to (AAAA-MM-DD, pela data de criação do pedido) e regionId.
// Dados agregados, sem dados pessoais.

import { api, consulta } from './api'
import type { StatusPedido, UnidadeQuantidade } from './pedidos'

export type EscopoIndicadores = 'cooperativa' | 'plataforma'

export interface FiltrosIndicadores {
  de: string
  ate: string
  regiaoId: string
}

export interface Indicadores {
  pedidos: {
    total: number
    abertos: number
    concluidos: number
    /** Cancelados + recusados */
    naoConcluidos: number
    cancelados: number
    recusados: number
    /** Atrasados neste momento (não depende do período) */
    atrasadosAgora: number
    /** % de concluídos sobre o total (uma casa decimal); null sem pedidos */
    taxaConclusao: number | null
    porStatus: Record<StatusPedido, number>
  }
  /** Tempos médios em horas; null quando ainda não há casos */
  horasMedias: {
    ateConfirmar: number | null
    confirmacaoAteConcluir: number | null
    ateConcluir: number | null
  }
  porRegiao: { regiaoId: string; nome: string; total: number; concluidos: number; abertos: number }[]
  materiaisRecolhidos: { categoriaId: string; nome: string; unidade: UnidadeQuantidade; quantidade: number }[]
  /** Só na visão da plataforma */
  guia: { visualizacoes: number; maisVistos: { materialId: string; nome: string; vezes: number }[] } | null
}

interface IndicadoresApi {
  requests: {
    total: number
    open: number
    concluded: number
    notConcluded: number
    cancelled: number
    refused: number
    lateNow: number
    completionRate: number | null
    byStatus: Record<StatusPedido, number>
  }
  averageHours: {
    requestToConfirmation: number | null
    confirmationToCompletion: number | null
    requestToCompletion: number | null
  }
  byRegion: { regionId: string; regionName: string; total: number; concluded: number; open: number }[]
  collectedMaterials: { categoryId: string; categoryName: string; unit: UnidadeQuantidade; quantity: number }[]
  materialGuide?: { views: number; topMaterials: { materialId: string; name: string; views: number }[] }
}

export async function buscarIndicadores(
  escopo: EscopoIndicadores,
  filtros: FiltrosIndicadores,
  sinal?: AbortSignal,
): Promise<Indicadores> {
  const caminho = escopo === 'cooperativa' ? '/cooperative/dashboard' : '/admin/dashboard'
  const r = await api<IndicadoresApi>(
    `${caminho}${consulta({ from: filtros.de, to: filtros.ate, regionId: filtros.regiaoId })}`,
    { sinal },
  )
  return {
    pedidos: {
      total: r.requests.total,
      abertos: r.requests.open,
      concluidos: r.requests.concluded,
      naoConcluidos: r.requests.notConcluded,
      cancelados: r.requests.cancelled,
      recusados: r.requests.refused,
      atrasadosAgora: r.requests.lateNow,
      taxaConclusao: r.requests.completionRate,
      porStatus: r.requests.byStatus,
    },
    horasMedias: {
      ateConfirmar: r.averageHours.requestToConfirmation,
      confirmacaoAteConcluir: r.averageHours.confirmationToCompletion,
      ateConcluir: r.averageHours.requestToCompletion,
    },
    porRegiao: r.byRegion.map((x) => ({
      regiaoId: x.regionId,
      nome: x.regionName,
      total: x.total,
      concluidos: x.concluded,
      abertos: x.open,
    })),
    materiaisRecolhidos: r.collectedMaterials.map((x) => ({
      categoriaId: x.categoryId,
      nome: x.categoryName,
      unidade: x.unit,
      quantidade: x.quantity,
    })),
    guia: r.materialGuide
      ? {
          visualizacoes: r.materialGuide.views,
          maisVistos: r.materialGuide.topMaterials.map((m) => ({
            materialId: m.materialId,
            nome: m.name,
            vezes: m.views,
          })),
        }
      : null,
  }
}
