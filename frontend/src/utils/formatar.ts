import type { Endereco, EnderecoSalvo, Usuario } from '../data/usuario'

/** Bairro cadastrado no endereço, usado como referência de localização no app */
export function bairroDoUsuario(usuario: Usuario | null): string | null {
  return usuario?.endereco.bairro.trim() || null
}

/** "Rua Domingos de Morais, 2000 - Apto 12" */
export function ruaENumero(e: Endereco) {
  return `${e.rua}, ${e.numero}${e.complemento ? ` - ${e.complemento}` : ''}`
}

/** Nome para mostrar de um endereço salvo: o `label` ou, sem ele, a rua. */
export function tituloDoEndereco(e: EnderecoSalvo) {
  return e.nome.trim() || ruaENumero(e.endereco)
}

/** "Vila Mariana, São Paulo/SP - CEP 04010-100" */
export function bairroECidade(e: Endereco) {
  return `${e.bairro}, ${e.cidade}/${e.uf} - CEP ${e.cep}`
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase()
}

/** Ex.: "Quinta-feira, 19 de novembro" */
export function dataPorExtenso(data: Date) {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(data)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Converte "2026-11-24" em Date sem problemas de fuso horário */
export function dataDeIso(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

/** Minúsculas e sem acentos, para buscas ("Plástico" e "plastico" batem) */
export function normalizarTexto(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Converte Date em "2026-11-24" (data local, sem fuso) */
export function isoDeData(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

/** Mesma data somando (ou subtraindo) dias */
export function somarDias(data: Date, dias: number) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias)
}
