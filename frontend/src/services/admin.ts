// Administração da plataforma.
//
// ADMIN e EDUCADOR (guia de materiais):
//   POST/PATCH /admin/material-categories[/:id]  { name 2-60, color? até 20, icon? até 40, description? até 400 }
//              (a slug sai do nome; não há exclusão de categoria)
//   GET        /admin/materials?search=&categoryId=&recyclable=&page=&limit=  (inclui inativos)
//   POST/PATCH /admin/materials[/:id]  { categoryId, name 2-120, recyclable, preparation 2-1000,
//              notes? até 1000, synonyms? até 30, active? }  (desativar = active false)
//
// Só ADMIN:
//   GET /admin/regions (inclui inativas), POST, PATCH /:id, DELETE /:id (desativa)
//       { name, city, state (UF), neighborhoods[] até 200, centerLatitude?, centerLongitude?, radiusKm?, active? }
//   GET /regions/:id/schedule (público): weekly (com id) + próximas exceptions (com id)
//   POST/PATCH/DELETE /admin/schedules[/:id]  { regionId, weekday 0-6, period, categoryIds[], notes? até 400 }
//   POST/DELETE /admin/schedule-exceptions[/:id]  { regionId, date AAAA-MM-DD, reason 2-200 }
//   GET/POST/PATCH /admin/cooperatives[/:id]  { name, cnpj?, phone?, email?, regionIds[], active? }
//   POST /admin/cooperatives/:id/members  { memberRole GESTOR|COLETOR, name, email, password, phone? }
//
// Nomes repetidos (categoria, material na mesma categoria, região na mesma cidade, CNPJ) voltam
// como 409 ALREADY_EXISTS; registro em uso, 409 IN_USE.

import { api, consulta, type Pagina } from './api'
import { converterMembro, corpoDoMembro, type Membro, type MembroApi, type NovoMembro } from './equipe'
import { converterCategoria, type CategoriaApi, type CategoriaGuia } from './materiais'
import type { PeriodoRetirada } from './pedidos'

// ---------- Categorias ----------

export interface DadosCategoria {
  nome: string
  cor: string
  icone: string
  descricao: string
}

export const LIMITES_CATEGORIA = { nome: 60, cor: 20, icone: 40, descricao: 400 }

export async function salvarCategoria(dados: DadosCategoria, id: string | null): Promise<CategoriaGuia> {
  const corpo = {
    name: dados.nome.trim(),
    // Na edição, vazio apaga; no cadastro, só vai se preenchido
    ...(dados.cor.trim() || id ? { color: dados.cor.trim() } : {}),
    ...(dados.icone.trim() || id ? { icon: dados.icone.trim() } : {}),
    ...(dados.descricao.trim() || id ? { description: dados.descricao.trim() } : {}),
  }
  const resposta = id
    ? await api<CategoriaApi & { icon: string | null }>(`/admin/material-categories/${encodeURIComponent(id)}`, {
        metodo: 'PATCH',
        corpo,
      })
    : await api<CategoriaApi & { icon: string | null }>('/admin/material-categories', { metodo: 'POST', corpo })
  return converterCategoria(resposta)
}

/** GET /material-categories devolve também o ícone, que o guia público não usa. */
export interface CategoriaAdmin extends CategoriaGuia {
  icone: string | null
}

export async function listarCategoriasAdmin(sinal?: AbortSignal): Promise<CategoriaAdmin[]> {
  const lista = await api<(CategoriaApi & { icon: string | null })[]>('/material-categories', { sinal })
  return lista.map((c) => ({ ...converterCategoria(c), icone: c.icon ?? null }))
}

// ---------- Materiais ----------

export interface MaterialAdmin {
  id: string
  categoriaId: string
  nome: string
  reciclavel: boolean
  preparo: string
  observacao: string | null
  sinonimos: string[]
  ativo: boolean
  categoria: CategoriaGuia | null
}

interface MaterialAdminApi {
  id: string
  categoryId: string
  name: string
  recyclable: boolean
  preparation: string
  notes: string | null
  synonyms: string[]
  active: boolean
  category?: CategoriaApi
}

const converterMaterial = (m: MaterialAdminApi): MaterialAdmin => ({
  id: m.id,
  categoriaId: m.categoryId,
  nome: m.name,
  reciclavel: m.recyclable,
  preparo: m.preparation,
  observacao: m.notes,
  sinonimos: m.synonyms ?? [],
  ativo: m.active,
  categoria: m.category ? converterCategoria(m.category) : null,
})

export const MATERIAIS_ADMIN_POR_PAGINA = 20
export const LIMITES_MATERIAL = { nome: 120, preparo: 1000, observacao: 1000, sinonimos: 30, busca: 80 }

export async function listarMateriaisAdmin(
  filtros: { busca: string; categoriaId: string; reciclavel: boolean | null },
  pagina: number,
  sinal?: AbortSignal,
): Promise<Pagina<MaterialAdmin>> {
  const r = await api<Pagina<MaterialAdminApi>>(
    `/admin/materials${consulta({
      search: filtros.busca.trim().slice(0, LIMITES_MATERIAL.busca),
      categoryId: filtros.categoriaId,
      recyclable: filtros.reciclavel ?? undefined,
      page: pagina,
      limit: MATERIAIS_ADMIN_POR_PAGINA,
    })}`,
    { sinal },
  )
  return { ...r, items: r.items.map(converterMaterial) }
}

export interface DadosMaterial {
  categoriaId: string
  nome: string
  reciclavel: boolean
  preparo: string
  observacao: string
  sinonimos: string[]
  ativo: boolean
}

/** A resposta do back não traz a categoria (só o categoryId). */
export async function salvarMaterial(dados: DadosMaterial, id: string | null): Promise<MaterialAdmin> {
  const observacao = dados.observacao.trim()
  const corpo = {
    categoryId: dados.categoriaId,
    name: dados.nome.trim(),
    recyclable: dados.reciclavel,
    preparation: dados.preparo.trim(),
    ...(observacao || id ? { notes: observacao } : {}),
    synonyms: dados.sinonimos,
    active: dados.ativo,
  }
  const resposta = id
    ? await api<MaterialAdminApi>(`/admin/materials/${encodeURIComponent(id)}`, { metodo: 'PATCH', corpo })
    : await api<MaterialAdminApi>('/admin/materials', { metodo: 'POST', corpo })
  return converterMaterial(resposta)
}

export async function alterarAtivoMaterial(id: string, ativo: boolean): Promise<MaterialAdmin> {
  return converterMaterial(
    await api<MaterialAdminApi>(`/admin/materials/${encodeURIComponent(id)}`, {
      metodo: 'PATCH',
      corpo: { active: ativo },
    }),
  )
}

// ---------- Regiões ----------

export interface RegiaoAdmin {
  id: string
  nome: string
  cidade: string
  uf: string
  bairros: string[]
  centroLatitude: number | null
  centroLongitude: number | null
  raioKm: number | null
  ativa: boolean
}

interface RegiaoAdminApi {
  id: string
  name: string
  city: string
  state: string
  neighborhoods: string[]
  centerLatitude: number | null
  centerLongitude: number | null
  radiusKm: number | null
  active: boolean
}

const converterRegiao = (r: RegiaoAdminApi): RegiaoAdmin => ({
  id: r.id,
  nome: r.name,
  cidade: r.city,
  uf: r.state,
  bairros: r.neighborhoods ?? [],
  centroLatitude: r.centerLatitude,
  centroLongitude: r.centerLongitude,
  raioKm: r.radiusKm,
  ativa: r.active,
})

export const LIMITES_REGIAO = { nome: 120, cidade: 120, bairros: 200 }

export async function listarRegioesAdmin(sinal?: AbortSignal): Promise<RegiaoAdmin[]> {
  return (await api<RegiaoAdminApi[]>('/admin/regions', { sinal })).map(converterRegiao)
}

export interface DadosRegiao {
  nome: string
  cidade: string
  uf: string
  bairros: string[]
  /** As três juntas ou nenhuma: centro + raio para achar a região pelas coordenadas */
  centroLatitude: number | null
  centroLongitude: number | null
  raioKm: number | null
  ativa: boolean
}

export async function salvarRegiao(dados: DadosRegiao, id: string | null): Promise<RegiaoAdmin> {
  const corpo = {
    name: dados.nome.trim(),
    city: dados.cidade.trim(),
    state: dados.uf,
    neighborhoods: dados.bairros,
    // O back aceita null para apagar (IsOptional); no cadastro, só vai se preenchido
    ...(dados.centroLatitude !== null || id ? { centerLatitude: dados.centroLatitude } : {}),
    ...(dados.centroLongitude !== null || id ? { centerLongitude: dados.centroLongitude } : {}),
    ...(dados.raioKm !== null || id ? { radiusKm: dados.raioKm } : {}),
    active: dados.ativa,
  }
  const resposta = id
    ? await api<RegiaoAdminApi>(`/admin/regions/${encodeURIComponent(id)}`, { metodo: 'PATCH', corpo })
    : await api<RegiaoAdminApi>('/admin/regions', { metodo: 'POST', corpo })
  return converterRegiao(resposta)
}

export async function desativarRegiao(id: string): Promise<RegiaoAdmin> {
  return converterRegiao(await api<RegiaoAdminApi>(`/admin/regions/${encodeURIComponent(id)}`, { metodo: 'DELETE' }))
}

// ---------- Calendário da região ----------

export interface ColetaSemanalAdmin {
  id: string
  dia: number
  periodo: PeriodoRetirada
  observacao: string | null
  categorias: CategoriaGuia[]
}

export interface ExcecaoAdmin {
  id: string
  data: string
  motivo: string
}

export interface CalendarioAdmin {
  semanal: ColetaSemanalAdmin[]
  excecoes: ExcecaoAdmin[]
}

interface ColetaSemanalApi {
  id: string
  weekday: number
  period: PeriodoRetirada
  notes: string | null
  categories: CategoriaApi[]
}

const converterColeta = (c: ColetaSemanalApi): ColetaSemanalAdmin => ({
  id: c.id,
  dia: c.weekday,
  periodo: c.period,
  observacao: c.notes,
  categorias: (c.categories ?? []).map(converterCategoria),
})

/** Exceções: só as de hoje em diante (até 30), como o back devolve. */
export async function buscarCalendarioDaRegiao(regiaoId: string, sinal?: AbortSignal): Promise<CalendarioAdmin> {
  const r = await api<{ weekly: ColetaSemanalApi[]; exceptions: { id: string; date: string; reason: string }[] }>(
    `/regions/${encodeURIComponent(regiaoId)}/schedule`,
    { sinal },
  )
  return {
    semanal: r.weekly.map(converterColeta),
    excecoes: r.exceptions.map((e) => ({ id: e.id, data: e.date, motivo: e.reason })),
  }
}

export interface DadosColetaSemanal {
  dia: number
  periodo: PeriodoRetirada
  categoriaIds: string[]
  observacao: string
}

export const LIMITES_CALENDARIO = { observacao: 400, motivo: 200 }

export async function salvarColetaSemanal(
  regiaoId: string,
  dados: DadosColetaSemanal,
  id: string | null,
): Promise<ColetaSemanalAdmin> {
  const observacao = dados.observacao.trim()
  const corpo = {
    regionId: regiaoId,
    weekday: dados.dia,
    period: dados.periodo,
    categoryIds: dados.categoriaIds,
    ...(observacao || id ? { notes: observacao } : {}),
  }
  const resposta = id
    ? await api<ColetaSemanalApi>(`/admin/schedules/${encodeURIComponent(id)}`, { metodo: 'PATCH', corpo })
    : await api<ColetaSemanalApi>('/admin/schedules', { metodo: 'POST', corpo })
  return converterColeta(resposta)
}

export async function excluirColetaSemanal(id: string) {
  await api<void>(`/admin/schedules/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

export async function criarExcecao(regiaoId: string, data: string, motivo: string): Promise<ExcecaoAdmin> {
  const r = await api<{ id: string; date: string; reason: string }>('/admin/schedule-exceptions', {
    metodo: 'POST',
    corpo: { regionId: regiaoId, date: data, reason: motivo.trim() },
  })
  return { id: r.id, data: r.date, motivo: r.reason }
}

export async function excluirExcecao(id: string) {
  await api<void>(`/admin/schedule-exceptions/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

// ---------- Cooperativas ----------

export interface CooperativaAdmin {
  id: string
  nome: string
  cnpj: string | null
  telefone: string | null
  email: string | null
  ativa: boolean
  regioes: { id: string; nome: string }[]
  /** Na lista: quantos membros; no detalhe: a lista */
  totalMembros: number
  membros: Membro[]
}

interface CooperativaApi {
  id: string
  name: string
  cnpj: string | null
  phone: string | null
  email: string | null
  active: boolean
  regions: { region: { id: string; name: string } }[]
  _count?: { members: number }
  members?: MembroApi[]
}

const converterCooperativa = (c: CooperativaApi): CooperativaAdmin => ({
  id: c.id,
  nome: c.name,
  cnpj: c.cnpj,
  telefone: c.phone,
  email: c.email,
  ativa: c.active,
  regioes: (c.regions ?? []).map((r) => ({ id: r.region.id, nome: r.region.name })),
  totalMembros: c._count?.members ?? c.members?.length ?? 0,
  membros: (c.members ?? []).map(converterMembro),
})

export async function listarCooperativas(sinal?: AbortSignal): Promise<CooperativaAdmin[]> {
  return (await api<CooperativaApi[]>('/admin/cooperatives', { sinal })).map(converterCooperativa)
}

export async function buscarCooperativa(id: string, sinal?: AbortSignal): Promise<CooperativaAdmin> {
  return converterCooperativa(await api<CooperativaApi>(`/admin/cooperatives/${encodeURIComponent(id)}`, { sinal }))
}

export interface DadosCooperativa {
  nome: string
  cnpj: string
  telefone: string
  email: string
  regiaoIds: string[]
  ativa: boolean
}

export const LIMITE_NOME_COOPERATIVA = 160

export async function salvarCooperativa(dados: DadosCooperativa, id: string | null): Promise<CooperativaAdmin> {
  const corpo = {
    name: dados.nome.trim(),
    ...(dados.cnpj ? { cnpj: dados.cnpj } : {}),
    ...(dados.telefone ? { phone: dados.telefone } : {}),
    ...(dados.email.trim() ? { email: dados.email.trim() } : {}),
    regionIds: dados.regiaoIds,
    active: dados.ativa,
  }
  const resposta = id
    ? await api<CooperativaApi>(`/admin/cooperatives/${encodeURIComponent(id)}`, { metodo: 'PATCH', corpo })
    : await api<CooperativaApi>('/admin/cooperatives', { metodo: 'POST', corpo })
  return converterCooperativa(resposta)
}

/** Erro EMAIL_IN_USE (409). */
export async function cadastrarMembroDaCooperativa(
  cooperativaId: string,
  papel: 'GESTOR' | 'COLETOR',
  dados: NovoMembro,
): Promise<Membro> {
  return converterMembro(
    await api<MembroApi>(`/admin/cooperatives/${encodeURIComponent(cooperativaId)}/members`, {
      metodo: 'POST',
      corpo: { memberRole: papel, ...corpoDoMembro(dados) },
    }),
  )
}
