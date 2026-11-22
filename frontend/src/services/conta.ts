// Conta da pessoa logada: entrar, cadastrar, sair, dados do perfil e endereço.
// Converte os campos do back (inglês) para os tipos do front (português).
//
// Rotas usadas:
//   POST  /auth/login, /auth/register  -> { accessToken, refreshToken, expiresIn, user }
//         (register: name, email, password, role MORADOR|COMERCIANTE, acceptTerms)
//   POST  /auth/logout                 (revoga o refreshToken)
//   GET   /me, PATCH /me               { name, phone }
//   DELETE /me                         (exclui a conta, LGPD)
//   GET   /me/addresses, POST /me/addresses, PATCH/DELETE /me/addresses/:id
//         (label até 40, isPrimary; o 1º endereço vira principal; marcar outro desmarca o anterior)
//
// Vários endereços por pessoa: o Perfil edita o principal e gerencia os outros;
// Solicitações escolhe em qual a retirada acontece.
// latitude/longitude são obrigatórias no back: vêm do mapa (components/MapaDoEndereco.tsx).

import {
  enderecoVazio,
  type Endereco,
  type EnderecoSalvo,
  type Papel,
  type PapelNaCooperativa,
  type TipoConta,
  type Usuario,
} from '../data/usuario'
import { mascaraCep } from '../utils/validar'
import { api, salvarTokens, tokenDeRenovacao, type Tokens } from './api'

interface UsuarioApi {
  id: string
  name: string
  email: string
  phone: string | null
  role: Papel
  createdAt?: string
  /** Só no GET /me: cooperativa do gestor ou coletor */
  cooperative?: { id: string; name: string; memberRole: PapelNaCooperativa } | null
}

interface RespostaLogin extends Tokens {
  expiresIn: number
  user: UsuarioApi
}

export interface EnderecoApi {
  id: string
  label: string | null
  zipCode: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  latitude: number
  longitude: number
  isPrimary: boolean
  region: { id: string; name: string } | null
}

export interface DadosCadastro {
  nome: string
  email: string
  senha: string
  /** `role` do register: o back só aceita MORADOR ou COMERCIANTE por conta própria */
  tipoConta: TipoConta
  aceitouTermos: boolean
}

export function enderecoDaApi(endereco: EnderecoApi): Endereco {
  return {
    cep: mascaraCep(endereco.zipCode),
    rua: endereco.street,
    numero: endereco.number,
    complemento: endereco.complement ?? '',
    bairro: endereco.neighborhood,
    cidade: endereco.city,
    uf: endereco.state,
    latitude: endereco.latitude,
    longitude: endereco.longitude,
  }
}

function enderecoParaApi(endereco: Endereco) {
  return {
    zipCode: endereco.cep,
    street: endereco.rua.trim(),
    number: endereco.numero.trim(),
    // Vazio vai como "" para apagar um complemento que existia
    complement: endereco.complemento.trim(),
    neighborhood: endereco.bairro.trim(),
    city: endereco.cidade.trim(),
    state: endereco.uf,
    // Marcadas no mapa (MapaDoEndereco); validarEndereco garante que existem
    latitude: endereco.latitude,
    longitude: endereco.longitude,
  }
}

function enderecoSalvoDaApi(endereco: EnderecoApi): EnderecoSalvo {
  return {
    id: endereco.id,
    nome: endereco.label ?? '',
    principal: endereco.isPrimary,
    regiao: endereco.region ? { id: endereco.region.id, nome: endereco.region.name } : null,
    endereco: enderecoDaApi(endereco),
  }
}

/**
 * Atualiza a lista de endereços e os atalhos do principal. O back não escolhe outro
 * principal quando o principal é excluído: nesse caso vale o primeiro da lista.
 */
export function usuarioComEnderecos(usuario: Usuario, enderecos: EnderecoSalvo[]): Usuario {
  const principal = enderecos.find((e) => e.principal) ?? enderecos[0] ?? null
  return {
    ...usuario,
    enderecos: principal ? [principal, ...enderecos.filter((e) => e !== principal)] : [],
    endereco: principal ? principal.endereco : { ...enderecoVazio },
    enderecoId: principal?.id ?? null,
    nomeEndereco: principal?.nome ?? '',
  }
}

/** Põe o endereço salvo na lista (troca pelo id ou acrescenta). Se ele virou principal, desmarca os outros. */
export function aplicarEndereco(lista: EnderecoSalvo[], salvo: EnderecoSalvo): EnderecoSalvo[] {
  const existe = lista.some((e) => e.id === salvo.id)
  const nova = existe ? lista.map((e) => (e.id === salvo.id ? salvo : e)) : [...lista, salvo]
  return salvo.principal
    ? nova.map((e) => (e.id === salvo.id ? e : { ...e, principal: false }))
    : nova
}

function montarUsuario(dados: UsuarioApi, enderecos: EnderecoApi[]): Usuario {
  const base: Usuario = {
    id: dados.id,
    nome: dados.name,
    email: dados.email,
    telefone: dados.phone ?? '',
    papel: dados.role,
    membroDesde: (dados.createdAt ?? new Date().toISOString()).slice(0, 10),
    cooperativa: dados.cooperative
      ? { id: dados.cooperative.id, nome: dados.cooperative.name, papel: dados.cooperative.memberRole }
      : null,
    enderecos: [],
    endereco: { ...enderecoVazio },
    enderecoId: null,
    nomeEndereco: '',
  }
  return usuarioComEnderecos(base, enderecos.map(enderecoSalvoDaApi))
}

/** Busca os dados atuais da pessoa logada (perfil + endereço). */
export async function carregarUsuario(): Promise<Usuario> {
  const [dados, enderecos] = await Promise.all([
    api<UsuarioApi>('/me'),
    api<EnderecoApi[]>('/me/addresses'),
  ])
  return montarUsuario(dados, enderecos)
}

export async function entrarNaConta(email: string, senha: string): Promise<Usuario> {
  const resposta = await api<RespostaLogin>('/auth/login', {
    metodo: 'POST',
    corpo: { email, password: senha },
  })
  salvarTokens(resposta)
  return carregarUsuario()
}

export async function criarConta(dados: DadosCadastro): Promise<Usuario> {
  const resposta = await api<RespostaLogin>('/auth/register', {
    metodo: 'POST',
    corpo: {
      name: dados.nome,
      email: dados.email,
      password: dados.senha,
      role: dados.tipoConta,
      acceptTerms: dados.aceitouTermos,
    },
  })
  salvarTokens(resposta)
  // Conta nova ainda não tem endereço
  return montarUsuario({ ...resposta.user, createdAt: new Date().toISOString() }, [])
}

/** Encerra a sessão no back. Se a API falhar, a sessão local é apagada do mesmo jeito. */
export async function sairDaConta() {
  const refreshToken = tokenDeRenovacao()
  salvarTokens(null)
  if (!refreshToken) return
  try {
    await api<void>('/auth/logout', { metodo: 'POST', corpo: { refreshToken } })
  } catch {
    // O token expira sozinho no back
  }
}

/**
 * POST /auth/forgot-password (204). O back responde igual exista ou não a conta
 * (não revela e-mails cadastrados) e manda um código válido por 60 minutos.
 */
export async function pedirCodigoDeSenha(email: string) {
  await api<void>('/auth/forgot-password', { metodo: 'POST', corpo: { email } })
}

/**
 * POST /auth/reset-password (204). Código vencido, já usado ou errado: ErroApi INVALID_RESET_TOKEN.
 * O back encerra todas as sessões da conta depois de trocar a senha.
 */
export async function redefinirSenha(codigo: string, senha: string) {
  await api<void>('/auth/reset-password', {
    metodo: 'POST',
    corpo: { token: codigo, password: senha },
  })
}

/**
 * DELETE /me (204): exclui a conta e anonimiza os dados (LGPD). O back cancela os pedidos
 * SOLICITADA/EM_ANALISE/AGENDADA, apaga endereços, notificações e sessões. Erros:
 * STAFF_ACCOUNT (403, conta de equipe) e PICKUP_IN_ROUTE (409, coleta a caminho).
 * Depois de excluir, a sessão local é apagada (os tokens já não valem no back).
 */
export async function excluirConta() {
  await api<void>('/me', { metodo: 'DELETE' })
  salvarTokens(null)
}

/** PATCH /me. O back não aceita telefone vazio, então ele só vai quando preenchido. */
export async function salvarDadosPessoais(nome: string, telefone: string) {
  await api<UsuarioApi>('/me', {
    metodo: 'PATCH',
    corpo: { name: nome, ...(telefone ? { phone: telefone } : {}) },
  })
}

/**
 * Cria (enderecoId null, POST) ou atualiza (PATCH) um endereço. `nome` vai como `label`
 * (vazio apaga o nome no PATCH; no POST só vai se preenchido). `principal: true` faz o back
 * desmarcar o principal anterior; o 1º endereço da conta já nasce principal.
 */
export async function salvarEndereco(
  endereco: Endereco,
  enderecoId: string | null,
  { nome = '', principal }: { nome?: string; principal?: boolean } = {},
): Promise<EnderecoSalvo> {
  const label = nome.trim()
  const salvo = enderecoId
    ? await api<EnderecoApi>(`/me/addresses/${encodeURIComponent(enderecoId)}`, {
        metodo: 'PATCH',
        corpo: { ...enderecoParaApi(endereco), label, ...(principal ? { isPrimary: true } : {}) },
      })
    : await api<EnderecoApi>('/me/addresses', {
        metodo: 'POST',
        corpo: {
          ...enderecoParaApi(endereco),
          ...(label ? { label } : {}),
          ...(principal !== undefined ? { isPrimary: principal } : {}),
        },
      })
  return enderecoSalvoDaApi(salvo)
}

/** PATCH /me/addresses/:id { isPrimary: true }: o back desmarca o principal anterior. */
export async function tornarEnderecoPrincipal(enderecoId: string): Promise<EnderecoSalvo> {
  const salvo = await api<EnderecoApi>(`/me/addresses/${encodeURIComponent(enderecoId)}`, {
    metodo: 'PATCH',
    corpo: { isPrimary: true },
  })
  return enderecoSalvoDaApi(salvo)
}

/** DELETE /me/addresses/:id (204). Pedidos antigos guardam uma cópia do endereço em texto. */
export async function excluirEndereco(enderecoId: string) {
  await api<void>(`/me/addresses/${encodeURIComponent(enderecoId)}`, { metodo: 'DELETE' })
}
