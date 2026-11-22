import { useEffect, useState, type ReactNode } from 'react'
import type { Usuario } from '../data/usuario'
import { EVENTO_SESSAO_EXPIRADA, ErroApi, tokenDeRenovacao } from '../services/api'
import {
  aplicarEndereco,
  carregarUsuario,
  criarConta,
  entrarNaConta,
  excluirConta as excluirContaNoBack,
  excluirEndereco as excluirEnderecoNoBack,
  sairDaConta,
  salvarDadosPessoais,
  salvarEndereco,
  tornarEnderecoPrincipal,
  usuarioComEnderecos,
} from '../services/conta'
import {
  AuthContext,
  type DadosCadastro,
  type DadosEndereco,
  type DadosPerfil,
} from './useAuth'

// Guarda uma cópia do usuário para a tela abrir já logada; ao carregar,
// os dados são atualizados com GET /me. Os tokens ficam em services/api.ts.
const CHAVE_SESSAO = 'sessao-usuario'

function lerSessao(): Usuario | null {
  try {
    if (!tokenDeRenovacao()) return null
    const salvo = localStorage.getItem(CHAVE_SESSAO)
    if (!salvo) return null
    const usuario = JSON.parse(salvo) as Usuario
    // Sessão do login simulado antigo (id numérico): descarta
    if (typeof usuario.id !== 'string') return null
    // Sessão salva antes dos vários endereços (22/11/2026): monta a lista com o principal
    if (!Array.isArray(usuario.enderecos)) {
      usuario.nomeEndereco = ''
      usuario.enderecos = usuario.enderecoId
        ? [{ id: usuario.enderecoId, nome: '', principal: true, regiao: null, endereco: usuario.endereco }]
        : []
    }
    // Sessão salva antes dos painéis da equipe (22/11/2026)
    if (usuario.cooperativa === undefined) usuario.cooperativa = null
    return usuario
  } catch {
    return null
  }
}

function salvarSessao(usuario: Usuario | null) {
  try {
    if (usuario) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario))
    else localStorage.removeItem(CHAVE_SESSAO)
  } catch {
    // Sem acesso ao armazenamento: a sessão dura só até recarregar a página
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(lerSessao)

  function definirUsuario(novo: Usuario | null) {
    setUsuario(novo)
    salvarSessao(novo)
  }

  // Ao abrir o site, atualiza os dados da sessão salva; sessão inválida desloga
  useEffect(() => {
    if (!lerSessao()) return
    carregarUsuario()
      .then(definirUsuario)
      .catch((erro: unknown) => {
        if (erro instanceof ErroApi && erro.status === 401) definirUsuario(null)
      })
  }, [])

  // Refresh token vencido ou revogado em qualquer chamada: volta a ser visitante
  useEffect(() => {
    const aoExpirar = () => definirUsuario(null)
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar)
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar)
  }, [])

  async function entrar(email: string, senha: string) {
    definirUsuario(await entrarNaConta(email, senha))
  }

  async function cadastrar(dados: DadosCadastro) {
    definirUsuario(await criarConta(dados))
  }

  async function atualizarPerfil(dados: Partial<DadosPerfil>) {
    if (!usuario) return
    let atual = usuario

    if (dados.nome !== undefined || dados.telefone !== undefined) {
      const nome = dados.nome ?? atual.nome
      const telefone = dados.telefone ?? atual.telefone
      await salvarDadosPessoais(nome, telefone)
      atual = { ...atual, nome, telefone }
      definirUsuario(atual)
    }

    if (dados.endereco !== undefined || dados.nomeEndereco !== undefined) {
      const salvo = await salvarEndereco(dados.endereco ?? atual.endereco, atual.enderecoId, {
        nome: dados.nomeEndereco ?? atual.nomeEndereco,
        // O 1º endereço da conta é o principal
        principal: atual.enderecoId === null ? true : undefined,
      })
      atual = usuarioComEnderecos(atual, aplicarEndereco(atual.enderecos, salvo))
      definirUsuario(atual)
    }
  }

  async function salvarOutroEndereco(dados: DadosEndereco, enderecoId: string | null) {
    if (!usuario) throw new Error('Sem sessão')
    const salvo = await salvarEndereco(dados.endereco, enderecoId, {
      nome: dados.nome,
      principal: dados.principal || usuario.enderecos.length === 0 || undefined,
    })
    definirUsuario(usuarioComEnderecos(usuario, aplicarEndereco(usuario.enderecos, salvo)))
    return salvo
  }

  async function tornarPrincipal(enderecoId: string) {
    if (!usuario) return
    const salvo = await tornarEnderecoPrincipal(enderecoId)
    definirUsuario(usuarioComEnderecos(usuario, aplicarEndereco(usuario.enderecos, salvo)))
  }

  async function excluirEndereco(enderecoId: string) {
    if (!usuario) return
    await excluirEnderecoNoBack(enderecoId)
    definirUsuario(
      usuarioComEnderecos(
        usuario,
        usuario.enderecos.filter((e) => e.id !== enderecoId),
      ),
    )
  }

  async function sair() {
    definirUsuario(null)
    await sairDaConta()
  }

  async function excluirConta() {
    await excluirContaNoBack()
    definirUsuario(null)
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        entrar,
        cadastrar,
        atualizarPerfil,
        salvarOutroEndereco,
        tornarPrincipal,
        excluirEndereco,
        sair,
        excluirConta,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
