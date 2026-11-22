import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Janela from './Janela'
import { mensagemDeErro } from '../services/api'
import type { Membro, NovoMembro } from '../services/equipe'
import { emailValido, LIMITES, mascaraTelefone, MINIMOS, telefoneValido } from '../utils/validar'

interface Props {
  titulo: string
  descricao: string
  /** Só o admin escolhe (gestor ou coletor); a gestão da cooperativa cadastra só coletores */
  escolherPapel?: boolean
  aoFechar: () => void
  aoEnviar: (dados: NovoMembro, papel: 'GESTOR' | 'COLETOR') => Promise<Membro>
  aoSalvar: (membro: Membro) => void
}

type Erros = Partial<Record<keyof NovoMembro, string>>

// Cria a conta de um membro da cooperativa (POST /cooperative/members ou
// POST /admin/cooperatives/:id/members). A pessoa entra com a senha inicial e pode trocá-la
// depois em "Esqueci minha senha".
export default function JanelaMembro({ titulo, descricao, escolherPapel = false, aoFechar, aoEnviar, aoSalvar }: Props) {
  const [dados, setDados] = useState<NovoMembro>({ nome: '', email: '', senha: '', telefone: '' })
  const [papel, setPapel] = useState<'GESTOR' | 'COLETOR'>('COLETOR')
  const [verSenha, setVerSenha] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function alterar(campo: keyof NovoMembro, valor: string) {
    setDados((d) => ({ ...d, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
  }

  async function confirmar() {
    const novos: Erros = {}
    if (dados.nome.trim().length < MINIMOS.nome) novos.nome = 'Informe o nome.'
    if (!emailValido(dados.email)) novos.email = 'Informe um e-mail válido.'
    if (dados.senha.length < MINIMOS.senha) novos.senha = 'A senha precisa ter ao menos 8 caracteres.'
    if (dados.telefone && !telefoneValido(dados.telefone)) novos.telefone = 'Informe o telefone com DDD.'
    setErros(novos)
    if (Object.keys(novos).length > 0) return
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await aoEnviar(dados, papel))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível cadastrar agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={titulo}
      descricao={descricao}
      salvando={salvando}
      erro={erro}
      rotuloConfirmar="Cadastrar"
      rotuloSalvando="Cadastrando..."
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      {escolherPapel && (
        <fieldset className="grupo-opcoes">
          <legend className="campo__rotulo campo__rotulo--obrigatorio">Função na cooperativa</legend>
          <div className="escolhas escolhas--2">
            {(['GESTOR', 'COLETOR'] as const).map((p) => (
              <label key={p} className={`escolha ${papel === p ? 'escolha--marcada' : ''}`}>
                <input
                  type="radio"
                  name="papel-membro"
                  className="escolha__input"
                  checked={papel === p}
                  onChange={() => setPapel(p)}
                />
                <span className="escolha__texto">
                  <strong>{p === 'GESTOR' ? 'Gestão' : 'Coletor(a)'}</strong>
                  <small>{p === 'GESTOR' ? 'Analisa e agenda os pedidos' : 'Faz as coletas agendadas'}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="janela__campos">
        <label className="campo campo--inteiro">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Nome</span>
          <input
            className={`input ${erros.nome ? 'input--erro' : ''}`}
            maxLength={LIMITES.nome}
            autoComplete="off"
            aria-required
            value={dados.nome}
            onChange={(e) => alterar('nome', e.target.value)}
          />
          {erros.nome && <span className="campo__erro">{erros.nome}</span>}
        </label>
        <label className="campo">
          <span className="campo__rotulo campo__rotulo--obrigatorio">E-mail</span>
          <input
            type="email"
            className={`input ${erros.email ? 'input--erro' : ''}`}
            maxLength={LIMITES.email}
            autoComplete="off"
            aria-required
            value={dados.email}
            onChange={(e) => alterar('email', e.target.value)}
          />
          {erros.email && <span className="campo__erro">{erros.email}</span>}
        </label>
        <label className="campo">
          <span className="campo__rotulo">Telefone</span>
          <input
            className={`input ${erros.telefone ? 'input--erro' : ''}`}
            inputMode="tel"
            placeholder="(00) 00000-0000"
            value={dados.telefone}
            onChange={(e) => alterar('telefone', mascaraTelefone(e.target.value))}
          />
          {erros.telefone && <span className="campo__erro">{erros.telefone}</span>}
        </label>
        <label className="campo campo--inteiro">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Senha inicial</span>
          <span className="input-com-botao">
            <input
              type={verSenha ? 'text' : 'password'}
              className={`input ${erros.senha ? 'input--erro' : ''}`}
              maxLength={LIMITES.senha}
              autoComplete="new-password"
              aria-required
              value={dados.senha}
              onChange={(e) => alterar('senha', e.target.value)}
            />
            <button
              type="button"
              className="input-com-botao__botao"
              aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
              onClick={() => setVerSenha((v) => !v)}
            >
              {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
          {erros.senha ? (
            <span className="campo__erro">{erros.senha}</span>
          ) : (
            <span className="campo__ajuda">
              De 8 a 72 caracteres. Passe para a pessoa em particular; ela pode trocar depois em "Esqueci minha senha".
            </span>
          )}
        </label>
      </div>
    </Janela>
  )
}
