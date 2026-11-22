import { createContext, useContext } from 'react'
import type { Endereco, EnderecoSalvo, Usuario } from '../data/usuario'
import type { DadosCadastro } from '../services/conta'

export type { DadosCadastro }

/** O que o perfil pode alterar: PATCH /me (nome, telefone) e o endereço principal (com o nome dele). */
export type DadosPerfil = Pick<Usuario, 'nome' | 'telefone' | 'endereco' | 'nomeEndereco'>

/** Um endereço além do principal (janela "Outros endereços" do Perfil). */
export interface DadosEndereco {
  endereco: Endereco
  nome: string
  /** true = vira o principal (o back desmarca o anterior) */
  principal: boolean
}

export interface AuthContextValue {
  usuario: Usuario | null
  entrar: (email: string, senha: string) => Promise<void>
  cadastrar: (dados: DadosCadastro) => Promise<void>
  /** Salva só o que mudou. Lança ErroApi com a mensagem do back se algo falhar. */
  atualizarPerfil: (dados: Partial<DadosPerfil>) => Promise<void>
  /** POST (enderecoId null) ou PATCH de um endereço. Lança ErroApi. */
  salvarOutroEndereco: (dados: DadosEndereco, enderecoId: string | null) => Promise<EnderecoSalvo>
  /** PATCH { isPrimary: true }. Lança ErroApi. */
  tornarPrincipal: (enderecoId: string) => Promise<void>
  /** DELETE /me/addresses/:id. Lança ErroApi. */
  excluirEndereco: (enderecoId: string) => Promise<void>
  sair: () => Promise<void>
  /** DELETE /me e apaga a sessão local. Lança ErroApi (STAFF_ACCOUNT, PICKUP_IN_ROUTE). */
  excluirConta: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
