// Consulta de endereço pelo CEP no back: GET /cep/:cep
// (o back consulta a ViaCEP e devolve { zipCode, street, neighborhood, city, state }).
import { api, ErroApi } from './api'

export interface EnderecoCep {
  rua: string
  bairro: string
  cidade: string
  uf: string
}

interface RespostaCep {
  zipCode: string
  street: string
  neighborhood: string
  city: string
  state: string
}

/**
 * Retorna o endereço do CEP, `null` se o CEP não existir,
 * ou lança erro se o serviço estiver indisponível.
 */
export async function buscarCep(cep: string, sinal?: AbortSignal): Promise<EnderecoCep | null> {
  const digitos = cep.replace(/\D/g, '')
  if (digitos.length !== 8) return null

  try {
    const dados = await api<RespostaCep>(`/cep/${digitos}`, { sinal })
    return { rua: dados.street, bairro: dados.neighborhood, cidade: dados.city, uf: dados.state }
  } catch (erro) {
    // CEP_NOT_FOUND (404) e INVALID_CEP (400): CEP inexistente
    if (erro instanceof ErroApi && (erro.status === 404 || erro.status === 400)) return null
    throw erro
  }
}
