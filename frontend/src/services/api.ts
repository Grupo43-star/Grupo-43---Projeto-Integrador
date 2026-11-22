// Cliente HTTP para a API do ReciclaBairro (back-end NestJS).
// - URL base em VITE_API_URL (ex.: /api/v1 com o proxy do Vite, ou a URL completa da API).
// - Autenticação: accessToken no cabeçalho Authorization; quando ele vence (401), troca o
//   refreshToken por um par novo em POST /auth/refresh e repete a chamada uma vez.
// - Erros do back chegam como { statusCode, code, message } e viram ErroApi.

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

const CHAVE_ACESSO = 'token'
const CHAVE_RENOVACAO = 'token-renovacao'

/** Avisado quando a sessão não pode mais ser renovada (o AuthContext desloga). */
export const EVENTO_SESSAO_EXPIRADA = 'sessao-expirada'

export interface Tokens {
  accessToken: string
  refreshToken: string
}

/** Lista paginada do back: `?page=1&limit=20`. */
export interface Pagina<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export class ErroApi extends Error {
  status: number
  codigo: string
  detalhes?: unknown

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.codigo = codigo
    this.detalhes = detalhes
  }
}

/** Mensagem para mostrar na tela a partir de qualquer erro. */
export function mensagemDeErro(erro: unknown, padrao = 'Algo deu errado. Tente de novo.') {
  return erro instanceof Error && erro.message ? erro.message : padrao
}

function ler(chave: string) {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

export function salvarTokens(tokens: Tokens | null) {
  try {
    if (tokens) {
      localStorage.setItem(CHAVE_ACESSO, tokens.accessToken)
      localStorage.setItem(CHAVE_RENOVACAO, tokens.refreshToken)
    } else {
      localStorage.removeItem(CHAVE_ACESSO)
      localStorage.removeItem(CHAVE_RENOVACAO)
    }
  } catch {
    // Sem acesso ao armazenamento: a sessão dura só até recarregar a página
  }
}

export function tokenDeRenovacao() {
  return ler(CHAVE_RENOVACAO)
}

/** Monta a query string ignorando valores vazios: consulta({ page: 1, search: '' }) -> "?page=1". */
export function consulta(parametros: Record<string, string | number | boolean | null | undefined>) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor))
  }
  const texto = busca.toString()
  return texto ? `?${texto}` : ''
}

interface OpcoesApi {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  corpo?: unknown
  sinal?: AbortSignal
}

async function requisitar(caminho: string, { metodo = 'GET', corpo, sinal }: OpcoesApi) {
  const token = ler(CHAVE_ACESSO)
  try {
    return await fetch(`${BASE_URL}${caminho}`, {
      method: metodo,
      signal: sinal,
      headers: {
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    })
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') throw erro
    throw new ErroApi(
      0,
      'SEM_CONEXAO',
      'Não foi possível falar com o servidor. Confira sua internet e tente de novo.',
    )
  }
}

// Uma renovação por vez: chamadas que recebem 401 juntas esperam a mesma troca de tokens
let renovacaoEmAndamento: Promise<boolean> | null = null

function renovarSessao(): Promise<boolean> {
  renovacaoEmAndamento ??= (async () => {
    const refreshToken = tokenDeRenovacao()
    if (!refreshToken) return false
    try {
      const resposta = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!resposta.ok) return false
      salvarTokens((await resposta.json()) as Tokens)
      return true
    } catch {
      return false
    }
  })().finally(() => {
    renovacaoEmAndamento = null
  })
  return renovacaoEmAndamento
}

async function erroDaResposta(resposta: Response) {
  try {
    const corpo = (await resposta.json()) as { code?: string; message?: string; details?: unknown }
    return new ErroApi(
      resposta.status,
      corpo.code ?? 'ERRO',
      corpo.message ?? 'Algo deu errado. Tente de novo.',
      corpo.details,
    )
  } catch {
    return new ErroApi(resposta.status, 'ERRO', 'Algo deu errado. Tente de novo.')
  }
}

export async function api<T>(caminho: string, opcoes: OpcoesApi = {}): Promise<T> {
  let resposta = await requisitar(caminho, opcoes)

  const rotaDeLogin = caminho.startsWith('/auth/')
  if (resposta.status === 401 && !rotaDeLogin && ler(CHAVE_ACESSO)) {
    if (await renovarSessao()) {
      resposta = await requisitar(caminho, opcoes)
    } else {
      salvarTokens(null)
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
    }
  }

  if (!resposta.ok) throw await erroDaResposta(resposta)
  if (resposta.status === 204) return undefined as T
  return (await resposta.json()) as T
}
