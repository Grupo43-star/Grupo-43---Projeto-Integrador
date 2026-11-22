// Regiões atendidas e calendário da coleta seletiva, vindos do back (rotas públicas):
//   GET /regions                              -> regiões ativas (ordem: cidade, nome), cada uma
//                                                com a lista de bairros que ela atende
//   GET /schedule?neighborhood=&city=&lat=&lng= -> calendário da região do local: primeiro pelo
//                                                nome do bairro (na mesma cidade), depois pelas
//                                                coordenadas (centro + raio da região).
//                                                404 REGION_NOT_SERVED se nenhuma região atende.
// O calendário traz a coleta de toda semana (dia + período + categorias) e as próximas
// datas sem coleta (feriados etc., até 30, a partir de hoje no fuso do back).

import { isoDeData, normalizarTexto } from '../utils/formatar'
import { api, consulta } from './api'
import { converterCategoria, type CategoriaApi, type CategoriaGuia } from './materiais'
import type { PeriodoRetirada } from './pedidos'

interface RegiaoApi {
  id: string
  name: string
  city: string
  state: string
  neighborhoods: string[]
}

interface CalendarioApi {
  region: { id: string; name: string; city: string }
  weekly: {
    id: string
    weekday: number
    period: PeriodoRetirada
    notes: string | null
    categories: CategoriaApi[]
  }[]
  exceptions: { id: string; date: string; reason: string }[]
}

export interface Regiao {
  id: string
  nome: string
  cidade: string
  uf: string
  bairros: string[]
}

export interface ColetaSemanal {
  id: string
  dia: number // 0 = domingo
  periodo: PeriodoRetirada
  observacao: string | null
  categorias: CategoriaGuia[]
}

/** Dia em que a coleta regular não acontece (feriado etc.). */
export interface DiaSemColeta {
  id: string
  data: string // AAAA-MM-DD
  motivo: string
}

export interface CalendarioColeta {
  regiao: { id: string; nome: string; cidade: string }
  semanal: ColetaSemanal[]
  semColeta: DiaSemColeta[]
}

export interface LocalCalendario {
  bairro: string
  cidade?: string
  latitude?: number | null
  longitude?: number | null
}

/** Limite do back para bairro e cidade na consulta. */
export const LIMITE_LOCAL = 120

/** Ordem dos períodos dentro do dia. */
export const ordemPeriodo: Record<PeriodoRetirada, number> = { MANHA: 0, TARDE: 1, NOITE: 2 }

// A lista de regiões muda pouco e é usada no Calendário e no Explorar bairros da topbar:
// fica guardada enquanto a página estiver aberta (se der erro, a próxima chamada tenta de novo).
let regioesEmCache: Promise<Regiao[]> | null = null

/** Depois que o admin cria ou altera uma região, a próxima consulta busca a lista de novo. */
export function limparCacheRegioes() {
  regioesEmCache = null
}

export function listarRegioes(): Promise<Regiao[]> {
  regioesEmCache ??= api<RegiaoApi[]>('/regions')
    .then((lista) =>
      lista.map((r) => ({
        id: r.id,
        nome: r.name,
        cidade: r.city,
        uf: r.state,
        bairros: [...r.neighborhoods].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      })),
    )
    .catch((erro: unknown) => {
      regioesEmCache = null
      throw erro
    })
  return regioesEmCache
}

/** Região (e o nome oficial do bairro) que atende um bairro, comparando sem acentos. */
export function acharBairro(regioes: Regiao[], bairro: string, cidade?: string | null) {
  const nome = normalizarTexto(bairro)
  const daCidade = cidade ? normalizarTexto(cidade) : null
  for (const regiao of regioes) {
    if (daCidade && normalizarTexto(regiao.cidade) !== daCidade) continue
    const achado = regiao.bairros.find((b) => normalizarTexto(b) === nome)
    if (achado) return { regiao, bairro: achado }
  }
  return null
}

/**
 * Próximo dia (a partir de hoje, até 8 semanas) em que a coleta seletiva passa,
 * pulando os dias sem coleta. null se a região não tem dias cadastrados.
 */
export function proximaColeta(calendario: CalendarioColeta, hoje: Date) {
  const semColeta = new Set(calendario.semColeta.map((d) => d.data))
  for (let i = 0; i < 56; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i)
    const coletas = calendario.semanal.filter((c) => c.dia === data.getDay())
    if (coletas.length > 0 && !semColeta.has(isoDeData(data))) return { data, emDias: i, coletas }
  }
  return null
}

export async function consultarCalendario(
  { bairro, cidade, latitude, longitude }: LocalCalendario,
  sinal?: AbortSignal,
): Promise<CalendarioColeta> {
  const comCoordenadas = latitude != null && longitude != null
  const resposta = await api<CalendarioApi>(
    `/schedule${consulta({
      neighborhood: bairro.trim().slice(0, LIMITE_LOCAL),
      city: cidade?.trim().slice(0, LIMITE_LOCAL),
      lat: comCoordenadas ? latitude : null,
      lng: comCoordenadas ? longitude : null,
    })}`,
    { sinal },
  )
  return {
    regiao: { id: resposta.region.id, nome: resposta.region.name, cidade: resposta.region.city },
    semanal: resposta.weekly
      .map((c) => ({
        id: c.id,
        dia: c.weekday,
        periodo: c.period,
        observacao: c.notes?.trim() || null,
        categorias: c.categories
          .map(converterCategoria)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      }))
      .sort((a, b) => a.dia - b.dia || ordemPeriodo[a.periodo] - ordemPeriodo[b.periodo]),
    semColeta: resposta.exceptions.map((e) => ({ id: e.id, data: e.date, motivo: e.reason })),
  }
}
