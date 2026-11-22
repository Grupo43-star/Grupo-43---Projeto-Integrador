// Tipos da conta da pessoa logada (perfil + endereço), usados em todo o front.
// A conversão a partir dos campos do back (em inglês) fica em services/conta.ts.

export interface Endereco {
  cep: string // formato 00000-000
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  /** Local marcado no mapa (o back exige). null = ainda não marcado. */
  latitude: number | null
  longitude: number | null
}

export const enderecoVazio: Endereco = {
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  latitude: null,
  longitude: null,
}

export const ufs = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

/** Papéis de conta do back (`role`). Cada papel vê o seu menu (utils/papeis.ts). */
export type Papel =
  | 'MORADOR'
  | 'COMERCIANTE'
  | 'GESTOR_COOPERATIVA'
  | 'COLETOR'
  | 'EDUCADOR'
  | 'ADMIN'

/** Tipos de conta que a própria pessoa pode criar (POST /auth/register, campo `role`). */
export type TipoConta = Extract<Papel, 'MORADOR' | 'COMERCIANTE'>

/** Nome de cada papel para mostrar na tela. */
export const nomesPapel: Record<Papel, string> = {
  MORADOR: 'Morador(a)',
  COMERCIANTE: 'Comerciante',
  GESTOR_COOPERATIVA: 'Gestão da cooperativa',
  COLETOR: 'Coletor(a)',
  EDUCADOR: 'Educador(a)',
  ADMIN: 'Administração',
}

/** Papel dentro da cooperativa (`memberRole` do back). */
export type PapelNaCooperativa = 'GESTOR' | 'COLETOR'

/** Cooperativa da conta de equipe (GET /me `cooperative`); null para quem não é membro ativo. */
export interface CooperativaDoUsuario {
  id: string
  nome: string
  papel: PapelNaCooperativa
}

/** Um endereço cadastrado (GET /me/addresses). */
export interface EnderecoSalvo {
  id: string
  /** `label` do back ("Casa", "Loja"); '' = sem nome */
  nome: string
  principal: boolean
  /** Região da coleta seletiva que atende o endereço; null = a coleta ainda não passa lá */
  regiao: { id: string; nome: string } | null
  endereco: Endereco
}

/** Pessoa logada: GET /me + GET /me/addresses. */
export interface Usuario {
  id: string
  nome: string
  email: string
  telefone: string
  papel: Papel
  membroDesde: string // ISO yyyy-mm-dd
  /** Só gestores e coletores (membro ativo de uma cooperativa ativa) */
  cooperativa: CooperativaDoUsuario | null
  /** Todos os endereços, na ordem do back (o principal primeiro) */
  enderecos: EnderecoSalvo[]
  // Atalhos para o endereço principal (usado no Início, Calendário, Pontos e Perfil)
  endereco: Endereco
  enderecoId: string | null // id do principal no back (null = ainda não cadastrou)
  nomeEndereco: string
}
