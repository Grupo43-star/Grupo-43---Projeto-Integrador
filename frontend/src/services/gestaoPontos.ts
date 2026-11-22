// Cadastro de pontos de coleta (ADMIN e GESTOR_COOPERATIVA):
//   GET    /collection-points/manage?page=&limit=   admin: todos (inclusive inativos);
//          gestor: os da cooperativa dele. Ativos primeiro, depois por nome.
//   POST   /collection-points                       cria (gestor: sempre na própria cooperativa;
//          admin escolhe a cooperativa responsável ou nenhuma)
//   PATCH  /collection-points/:id                   altera (categoryIds e hours substituem a lista)
//   DELETE /collection-points/:id (204)             desativa (some da busca pública);
//          reativar = PATCH { active: true }
// O back calcula a região pelo bairro/coordenadas. Erros: INVALID_HOURS (abertura depois do
// fechamento), NOT_YOUR_COLLECTION_POINT (403, ponto de outra cooperativa).

import { api, consulta, type Pagina } from './api'
import { converterPonto, type HorarioPonto, type Ponto, type PontoApi, type TipoPonto } from './pontos'

export interface PontoGerido extends Ponto {
  ativo: boolean
  cooperativaId: string | null
}

type PontoGeridoApi = PontoApi & { active: boolean; cooperativeId: string | null }

const converter = (p: PontoGeridoApi): PontoGerido => ({
  ...converterPonto(p),
  ativo: p.active,
  cooperativaId: p.cooperativeId ?? p.cooperative?.id ?? null,
})

export const PONTOS_GERIDOS_POR_PAGINA = 20

export async function listarPontosGeridos(pagina: number, sinal?: AbortSignal): Promise<Pagina<PontoGerido>> {
  const r = await api<Pagina<PontoGeridoApi>>(
    `/collection-points/manage${consulta({ page: pagina, limit: PONTOS_GERIDOS_POR_PAGINA })}`,
    { sinal },
  )
  return { ...r, items: r.items.map(converter) }
}

export interface DadosPonto {
  nome: string
  tipo: TipoPonto
  cep: string
  rua: string
  /** '' ou 'S/N' = sem número (o back aceita ausente) */
  numero: string
  bairro: string
  cidade: string
  uf: string
  latitude: number
  longitude: number
  orientacoes: string
  telefone: string
  categoriaIds: string[]
  horarios: HorarioPonto[]
  /** Só o admin escolhe; '' = nenhuma */
  cooperativaId: string
  ativo: boolean
}

/** Limites do back (CreateCollectionPointDto) */
export const LIMITES_PONTO = { nome: 160, rua: 160, bairro: 120, cidade: 120, orientacoes: 1000, horarios: 28 }

function corpo(d: DadosPonto, admin: boolean, original: PontoGerido | null) {
  const novo = original === null
  const numero = d.numero.trim()
  const orientacoes = d.orientacoes.trim()
  return {
    name: d.nome.trim(),
    type: d.tipo,
    ...(d.cep ? { zipCode: d.cep } : {}),
    street: d.rua.trim(),
    // Sem número: não vai; se tinha número e a pessoa tirou, vai "s/n" (o back não apaga com vazio)
    ...(numero && numero !== 'S/N' ? { number: numero } : original?.numero ? { number: 's/n' } : {}),
    neighborhood: d.bairro.trim(),
    city: d.cidade.trim(),
    state: d.uf,
    latitude: d.latitude,
    longitude: d.longitude,
    ...(orientacoes || !novo ? { instructions: orientacoes } : {}),
    ...(d.telefone ? { phone: d.telefone } : {}),
    categoryIds: d.categoriaIds,
    hours: d.horarios.map((h) => ({ weekday: h.dia, opensAt: h.inicio, closesAt: h.fim })),
    ...(admin ? { cooperativeId: d.cooperativaId || (novo ? undefined : null) } : {}),
    active: d.ativo,
  }
}

export async function salvarPonto(
  dados: DadosPonto,
  original: PontoGerido | null,
  admin: boolean,
): Promise<PontoGerido> {
  const resposta = original
    ? await api<PontoGeridoApi>(`/collection-points/${encodeURIComponent(original.id)}`, {
        metodo: 'PATCH',
        corpo: corpo(dados, admin, original),
      })
    : await api<PontoGeridoApi>('/collection-points', { metodo: 'POST', corpo: corpo(dados, admin, null) })
  return converter(resposta)
}

export async function desativarPonto(id: string) {
  await api<void>(`/collection-points/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

export async function reativarPonto(id: string): Promise<PontoGerido> {
  return converter(
    await api<PontoGeridoApi>(`/collection-points/${encodeURIComponent(id)}`, {
      metodo: 'PATCH',
      corpo: { active: true },
    }),
  )
}
