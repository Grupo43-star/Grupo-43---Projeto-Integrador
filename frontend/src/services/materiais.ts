// Guia de materiais, vindo do back (rotas públicas, não precisam de login):
//   GET /material-categories                       -> lista de categorias (ordem alfabética)
//   GET /materials?search=&categoryId=&recyclable=&page=&limit= -> Pagina<Material> (só os ativos)
//   GET /materials/:id                             -> um material ("como separar e descartar")
// A busca do back procura no nome e nos sinônimos, ignorando acentos e maiúsculas.
// Cada GET /materials/:id conta no indicador "uso do guia" do back (com o id da pessoa,
// se ela estiver logada), por isso o detalhe é sempre pedido ao back ao abrir.

import { api, consulta, type Pagina } from './api'

export interface CategoriaApi {
  id: string
  name: string
  slug: string
  color: string | null
  description: string | null
}

interface MaterialApi {
  id: string
  name: string
  recyclable: boolean
  preparation: string
  notes: string | null
  synonyms: string[]
  category: CategoriaApi
}

export interface CategoriaGuia {
  id: string
  nome: string
  slug: string // ex.: papel-e-papelao (dá a cor: classe tag--<slug>)
  /** Cor do back (hex). Usada só quando a slug não tem classe própria (ver utils/corCategoria.ts). */
  cor: string | null
  descricao: string | null
}

export interface MaterialGuia {
  id: string
  nome: string
  reciclavel: boolean
  preparo: string // como separar antes do descarte
  observacao: string | null
  sinonimos: string[]
  categoria: CategoriaGuia
}

export interface FiltrosMateriais {
  busca?: string
  categoriaId?: string
  /** true: só recicláveis; false: só não recicláveis; ausente: todos. */
  reciclavel?: boolean
  pagina?: number
  /** Itens por página (o back aceita até 100). */
  limite?: number
}

/** Limites do back: busca até 80 caracteres, até 100 itens por página. */
export const LIMITE_BUSCA_MATERIAL = 80
export const MATERIAIS_POR_PAGINA = 20

export function converterCategoria(c: CategoriaApi): CategoriaGuia {
  return { id: c.id, nome: c.name, slug: c.slug, cor: c.color ?? null, descricao: c.description ?? null }
}

export async function listarCategorias(sinal?: AbortSignal): Promise<CategoriaGuia[]> {
  const lista = await api<CategoriaApi[]>('/material-categories', { sinal })
  return lista.map(converterCategoria)
}

export async function listarMateriais(
  { busca, categoriaId, reciclavel, pagina = 1, limite = MATERIAIS_POR_PAGINA }: FiltrosMateriais,
  sinal?: AbortSignal,
): Promise<Pagina<MaterialGuia>> {
  const resposta = await api<Pagina<MaterialApi>>(
    `/materials${consulta({
      search: busca?.trim().slice(0, LIMITE_BUSCA_MATERIAL),
      categoryId: categoriaId,
      recyclable: reciclavel,
      page: pagina,
      limit: limite,
    })}`,
    { sinal },
  )
  return { ...resposta, items: resposta.items.map(converterMaterial) }
}

function converterMaterial(m: MaterialApi): MaterialGuia {
  return {
    id: m.id,
    nome: m.name,
    reciclavel: m.recyclable,
    preparo: m.preparation,
    observacao: m.notes,
    sinonimos: m.synonyms ?? [],
    categoria: converterCategoria(m.category),
  }
}

/** Detalhe de um material. 404 MATERIAL_NOT_FOUND se não existir ou estiver inativo. */
export async function obterMaterial(id: string, sinal?: AbortSignal): Promise<MaterialGuia> {
  return converterMaterial(await api<MaterialApi>(`/materials/${encodeURIComponent(id)}`, { sinal }))
}
