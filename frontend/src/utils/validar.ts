import type { Endereco } from '../data/usuario'

/**
 * Tamanho máximo de cada campo, igual às validações do back (DTOs do NestJS).
 * CEP e telefone não aparecem aqui porque as máscaras já limitam o tamanho.
 * O número aceita até 20 caracteres no back; o front usa só dígitos (até 6) ou S/N.
 */
export const LIMITES = {
  nome: 120,
  email: 120,
  senha: 72,
  rua: 160,
  numero: 6,
  complemento: 80,
  bairro: 120,
  cidade: 120,
  /** `label` do endereço ("Casa", "Loja") */
  nomeEndereco: 40,
  observacoes: 500,
} as const

/** Mínimos do back: nome, rua, bairro e cidade com 2+ caracteres; senha com 8+. */
export const MINIMOS = {
  nome: 2,
  senha: 8,
  textoEndereco: 2,
} as const

export type ErrosEndereco = Partial<Record<keyof Endereco, string>>

/** Todos os campos do endereço são obrigatórios, exceto o complemento. O local no mapa também. */
export function validarEndereco(e: Endereco): ErrosEndereco {
  const erros: ErrosEndereco = {}
  if (e.cep.replace(/\D/g, '').length !== 8) erros.cep = 'Informe um CEP com 8 dígitos.'
  if (e.rua.trim().length < MINIMOS.textoEndereco) erros.rua = 'Informe a rua.'
  if (!numeroValido(e.numero)) erros.numero = 'Informe o número ou marque "Sem número".'
  if (e.bairro.trim().length < MINIMOS.textoEndereco) erros.bairro = 'Informe o bairro.'
  if (e.cidade.trim().length < MINIMOS.textoEndereco) erros.cidade = 'Informe a cidade.'
  if (!e.uf) erros.uf = 'Selecione.'
  if (e.latitude === null || e.longitude === null)
    erros.latitude = 'Marque no mapa o local do endereço.'
  return erros
}

/** Valor gravado quando a pessoa marca "Sem número" */
export const SEM_NUMERO = 'S/N'

/** Número do endereço: só dígitos, ou S/N quando "Sem número" está marcado */
export function numeroValido(numero: string) {
  return numero === SEM_NUMERO || /^\d+$/.test(numero)
}

/** Enquanto digita: só dígitos */
export function filtrarNumero(valor: string) {
  return valor.replace(/\D/g, '').slice(0, LIMITES.numero)
}

export function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Formata enquanto digita: 00000-000 */
export function mascaraCep(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Formata enquanto digita: (11) 98765-4321 */
export function mascaraTelefone(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Telefone com DDD: 10 dígitos (fixo) ou 11 (celular) */
export function telefoneValido(telefone: string) {
  const d = telefone.replace(/\D/g, '')
  return d.length === 10 || d.length === 11
}
