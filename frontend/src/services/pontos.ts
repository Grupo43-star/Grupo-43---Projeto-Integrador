// Pontos de coleta, vindos do back (rotas públicas, não precisam de login):
//   GET /collection-points?categoryId=&type=&openNow=&lat=&lng=&radiusKm=&page=&limit=
//     -> Pagina<Ponto> (só os ativos). Com lat/lng vem do mais perto ao mais longe, com
//        distanceKm; sem, em ordem de nome. radiusKm (0,1 a 100) exige lat/lng.
//   GET /collection-points/:id -> Ponto (404 COLLECTION_POINT_NOT_FOUND se não existe ou foi desativado)
// "openNow" é calculado pelo back no fuso dele, na hora da consulta.

import { api, consulta, type Pagina } from './api'
import { converterCategoria, type CategoriaApi, type CategoriaGuia } from './materiais'

export type TipoPonto = 'ECOPONTO' | 'PEV' | 'COOPERATIVA' | 'COMERCIO'

export const tiposPonto: { valor: TipoPonto; nome: string; descricao: string }[] = [
  { valor: 'ECOPONTO', nome: 'Ecoponto', descricao: 'Recebe recicláveis e volumes maiores' },
  { valor: 'PEV', nome: 'PEV', descricao: 'Ponto de entrega voluntária (contêineres)' },
  { valor: 'COOPERATIVA', nome: 'Cooperativa', descricao: 'Sede de cooperativa de reciclagem' },
  { valor: 'COMERCIO', nome: 'Comércio parceiro', descricao: 'Loja ou mercado com coletor' },
]

export const nomeDoTipo = (tipo: TipoPonto) =>
  tiposPonto.find((t) => t.valor === tipo)?.nome ?? tipo

export function tipoValido(texto: string): texto is TipoPonto {
  return tiposPonto.some((t) => t.valor === texto)
}

export interface PontoApi {
  id: string
  name: string
  type: TipoPonto
  zipCode: string | null
  street: string
  number: string | null
  neighborhood: string
  city: string
  state: string
  latitude: number
  longitude: number
  instructions: string | null
  phone: string | null
  cooperative: { id: string; name: string } | null
  region?: { id: string; name: string } | null
  categories: CategoriaApi[]
  hours: { weekday: number; opensAt: string; closesAt: string }[]
  openNow: boolean
  distanceKm: number | null
}

export interface HorarioPonto {
  dia: number // 0 = domingo
  inicio: string // HH:MM
  fim: string // HH:MM
}

export interface Ponto {
  id: string
  nome: string
  tipo: TipoPonto
  cep: string | null
  rua: string
  numero: string | null
  bairro: string
  cidade: string
  uf: string
  latitude: number
  longitude: number
  orientacoes: string | null
  telefone: string | null
  cooperativa: string | null
  /** Região atendida em que o ponto fica (null = fora das regiões cadastradas). */
  regiao: string | null
  categorias: CategoriaGuia[]
  horarios: HorarioPonto[]
  abertoAgora: boolean
  distanciaKm: number | null
}

export interface FiltrosPontos {
  categoriaId?: string
  tipo?: TipoPonto
  abertoAgora?: boolean
  /** Com origem, o back ordena por distância; o raio só vale com origem. */
  origem?: { latitude: number; longitude: number } | null
  raioKm?: number | null
  pagina?: number
  /** Itens por página (o Início pede 1 só para saber o total). */
  limite?: number
}

export const PONTOS_POR_PAGINA = 20
/** Opções de raio (o back aceita de 0,1 a 100 km). */
export const RAIOS_KM = [1, 2, 5, 10, 25]

/** "Rua X, 120 - Bairro, Cidade/UF" (sem número: "s/n") */
export function enderecoDoPonto(p: Ponto) {
  return `${p.rua}, ${p.numero || 's/n'} - ${p.bairro}, ${p.cidade}/${p.uf}`
}

/** Rota no Google Maps até as coordenadas do ponto */
export function linkDoMapa(p: Ponto) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`
}

export function converterPonto(p: PontoApi): Ponto {
  return {
    id: p.id,
    nome: p.name,
    tipo: p.type,
    cep: p.zipCode,
    rua: p.street,
    numero: p.number,
    bairro: p.neighborhood,
    cidade: p.city,
    uf: p.state,
    latitude: p.latitude,
    longitude: p.longitude,
    orientacoes: p.instructions,
    telefone: p.phone,
    cooperativa: p.cooperative?.name ?? null,
    regiao: p.region?.name ?? null,
    categorias: (p.categories ?? []).map(converterCategoria),
    horarios: (p.hours ?? []).map((h) => ({ dia: h.weekday, inicio: h.opensAt, fim: h.closesAt })),
    abertoAgora: p.openNow,
    distanciaKm: p.distanceKm,
  }
}

export async function listarPontos(
  { categoriaId, tipo, abertoAgora, origem, raioKm, pagina = 1, limite = PONTOS_POR_PAGINA }: FiltrosPontos,
  sinal?: AbortSignal,
): Promise<Pagina<Ponto>> {
  const resposta = await api<Pagina<PontoApi>>(
    `/collection-points${consulta({
      categoryId: categoriaId,
      type: tipo,
      openNow: abertoAgora ? 'true' : undefined,
      lat: origem?.latitude,
      lng: origem?.longitude,
      radiusKm: origem && raioKm ? raioKm : undefined,
      page: pagina,
      limit: limite,
    })}`,
    { sinal },
  )
  return { ...resposta, items: resposta.items.map(converterPonto) }
}

/** Detalhe de um ponto (sem distância: o back só calcula na busca com lat/lng). */
export async function buscarPonto(id: string, sinal?: AbortSignal): Promise<Ponto> {
  const ponto = await api<PontoApi>(`/collection-points/${encodeURIComponent(id)}`, { sinal })
  return converterPonto(ponto)
}
