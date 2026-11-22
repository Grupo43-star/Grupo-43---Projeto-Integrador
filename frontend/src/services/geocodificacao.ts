// Posição aproximada de um endereço, para colocar o pino do mapa no lugar certo.
// Usa o Nominatim (OpenStreetMap), público e gratuito: até 1 consulta por segundo,
// por isso o mapa só busca depois que a pessoa para de digitar.
// A pessoa sempre confere e ajusta o pino; o que vai para o back é a posição final.
import type { Endereco } from '../data/usuario'
import { SEM_NUMERO } from '../utils/validar'

const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search'

export interface Coordenadas {
  latitude: number
  longitude: number
}

/** Até onde o OpenStreetMap conseguiu chegar: a casa (número), só a rua ou só o bairro */
export type Precisao = 'numero' | 'rua' | 'bairro'

interface ResultadoNominatim {
  lat: string
  lon: string
  category?: string
  type?: string
  addresstype?: string
}

/** Endereço com o mínimo para tentar achar no mapa: rua, cidade e UF */
export function enderecoLocalizavel(e: Endereco) {
  return e.rua.trim().length >= 2 && e.cidade.trim().length >= 2 && e.uf.length === 2
}

/** Intervalo entre consultas seguidas (regra de uso do Nominatim) */
const INTERVALO_MS = 1100

function pausa(ms: number, sinal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const tempo = setTimeout(resolve, ms)
    sinal?.addEventListener('abort', () => {
      clearTimeout(tempo)
      reject(new DOMException('Cancelado', 'AbortError'))
    })
  })
}

/** Resultado que é uma casa/prédio (o OpenStreetMap tem o número cadastrado) */
const ehCasa = (r: ResultadoNominatim) =>
  r.type === 'house' || r.addresstype === 'house' || r.category === 'building'

async function consultar(
  parametros: Record<string, string>,
  sinal?: AbortSignal,
): Promise<{ coordenadas: Coordenadas; casa: boolean } | null> {
  const busca = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    'accept-language': 'pt-BR',
    ...parametros,
  })
  const resposta = await fetch(`${URL_NOMINATIM}?${busca}`, { signal: sinal })
  if (!resposta.ok) throw new Error('Serviço de mapa indisponível')
  const [primeiro] = (await resposta.json()) as ResultadoNominatim[]
  if (!primeiro) return null
  return {
    coordenadas: { latitude: Number(primeiro.lat), longitude: Number(primeiro.lon) },
    casa: ehCasa(primeiro),
  }
}

/**
 * Tenta do mais preciso ao mais genérico: rua com número, rua sem número e, por fim,
 * o bairro. Em muitas ruas o OpenStreetMap não tem os números das casas: aí ele devolve
 * um ponto qualquer da rua (o mesmo para qualquer número) e a precisão é 'rua'.
 * Lança erro se o serviço estiver fora do ar.
 */
export async function localizarEndereco(
  e: Endereco,
  sinal?: AbortSignal,
): Promise<{ coordenadas: Coordenadas; precisao: Precisao } | null> {
  const lugar = { city: e.cidade.trim(), state: e.uf, country: 'Brasil' }
  const numero = e.numero && e.numero !== SEM_NUMERO ? `${e.numero} ` : ''

  const comNumero = await consultar({ ...lugar, street: `${numero}${e.rua.trim()}` }, sinal)
  if (comNumero) {
    return {
      coordenadas: comNumero.coordenadas,
      precisao: numero && comNumero.casa ? 'numero' : 'rua',
    }
  }

  if (numero) {
    await pausa(INTERVALO_MS, sinal)
    const semNumero = await consultar({ ...lugar, street: e.rua.trim() }, sinal)
    if (semNumero) return { coordenadas: semNumero.coordenadas, precisao: 'rua' }
  }

  await pausa(INTERVALO_MS, sinal)
  const bairro = await consultar(
    { q: [e.bairro.trim(), e.cidade.trim(), e.uf].filter(Boolean).join(', ') },
    sinal,
  )
  return bairro ? { coordenadas: bairro.coordenadas, precisao: 'bairro' } : null
}
