import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, House, LoaderCircle, Store, type LucideIcon } from 'lucide-react'
import AuthLayout from '../components/layout/AuthLayout'
import { useAuth } from '../context/useAuth'
import type { TipoConta } from '../data/usuario'
import { mensagemDeErro } from '../services/api'
import { emailValido, LIMITES, MINIMOS } from '../utils/validar'

type Campos = 'nome' | 'email' | 'senha' | 'confirmacao'

// O back aceita só estes dois no cadastro (role); as contas de equipe são criadas pelo admin
const tiposConta: { valor: TipoConta; titulo: string; descricao: string; Icone: LucideIcon }[] = [
  {
    valor: 'MORADOR',
    titulo: 'Sou morador(a)',
    descricao: 'Separo os recicláveis da minha casa.',
    Icone: House,
  },
  {
    valor: 'COMERCIANTE',
    titulo: 'Sou comerciante',
    descricao: 'Tenho um comércio ou negócio no bairro.',
    Icone: Store,
  },
]

export default function Cadastro() {
  const { cadastrar } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = (location.state as { de?: string } | null)?.de ?? '/'

  const [dados, setDados] = useState<Record<Campos, string>>({
    nome: '',
    email: '',
    senha: '',
    confirmacao: '',
  })
  const [tipoConta, setTipoConta] = useState<TipoConta>('MORADOR')
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [erros, setErros] = useState<Partial<Record<Campos | 'termos' | 'geral', string>>>({})
  const [enviando, setEnviando] = useState(false)

  const alterar = (campo: Campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDados((atual) => ({ ...atual, [campo]: e.target.value }))

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const novosErros: typeof erros = {}
    if (dados.nome.trim().length < MINIMOS.nome) novosErros.nome = 'Informe seu nome.'
    if (!emailValido(dados.email)) novosErros.email = 'Informe um e-mail válido.'
    if (dados.senha.length < MINIMOS.senha)
      novosErros.senha = `A senha precisa ter pelo menos ${MINIMOS.senha} caracteres.`
    if (dados.confirmacao !== dados.senha) novosErros.confirmacao = 'As senhas não coincidem.'
    if (!aceitouTermos)
      novosErros.termos = 'É preciso aceitar os termos de uso e a política de privacidade.'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setEnviando(true)
    try {
      await cadastrar({
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        senha: dados.senha,
        tipoConta,
        aceitouTermos,
      })
      // Igual ao login: volta para a página de origem ou vai para o início
      // (o Início lembra quem não tem endereço de cadastrar no perfil)
      navigate(destino, { replace: true })
    } catch (erro) {
      setErros({ geral: mensagemDeErro(erro, 'Não foi possível criar a conta.') })
      setEnviando(false)
    }
  }

  const campo = (
    nome: Campos,
    rotulo: string,
    tipo: string,
    autoComplete: string,
    placeholder: string,
  ) => (
    <label className="campo">
      <span className="campo__rotulo campo__rotulo--obrigatorio">{rotulo}</span>
      <input
        className={`input ${erros[nome] ? 'input--erro' : ''}`}
        aria-required
        maxLength={LIMITES[nome === 'confirmacao' ? 'senha' : nome]}
        type={tipo}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={dados[nome]}
        onChange={alterar(nome)}
      />
      {erros[nome] && <span className="campo__erro">{erros[nome]}</span>}
    </label>
  )

  return (
    <AuthLayout
      titulo="Faça parte do ciclo."
      descricao="Crie sua conta para agendar coletas e acompanhar sua contribuição no bairro."
    >
      <form className="formulario" onSubmit={aoEnviar} noValidate>
        {erros.geral && <p className="alerta alerta--erro">{erros.geral}</p>}

        <fieldset className="grupo-opcoes">
          <legend className="campo__rotulo campo__rotulo--obrigatorio">Tipo de conta</legend>
          <div className="escolhas escolhas--2">
            {tiposConta.map(({ valor, titulo, descricao, Icone }) => {
              const marcado = tipoConta === valor
              return (
                <label key={valor} className={`escolha ${marcado ? 'escolha--marcada' : ''}`}>
                  <input
                    className="escolha__input"
                    type="radio"
                    name="tipo-conta"
                    value={valor}
                    checked={marcado}
                    onChange={() => setTipoConta(valor)}
                  />
                  <Icone size={18} className="escolha__icone" aria-hidden="true" />
                  <span className="escolha__texto">
                    <strong>{titulo}</strong>
                    <small>{descricao}</small>
                  </span>
                  <Check size={15} className="escolha__check" aria-hidden="true" />
                </label>
              )
            })}
          </div>
          <span className="campo__ajuda">
            Os dois podem pedir retiradas, consultar o guia e os pontos de coleta.
          </span>
        </fieldset>

        {campo('nome', 'Nome completo', 'text', 'name', 'Como você se chama?')}
        {campo('email', 'E-mail', 'email', 'email', 'voce@exemplo.com')}
        <div className="formulario__linha">
          {campo('senha', 'Senha', 'password', 'new-password', `Mínimo ${MINIMOS.senha} caracteres`)}
          {campo('confirmacao', 'Confirmar senha', 'password', 'new-password', 'Repita a senha')}
        </div>

        <div className="campo">
          <label className="caixa">
            <input
              type="checkbox"
              aria-required
              aria-invalid={Boolean(erros.termos)}
              checked={aceitouTermos}
              onChange={(e) => {
                setAceitouTermos(e.target.checked)
                if (e.target.checked) setErros(({ termos: _termos, ...resto }) => resto)
              }}
            />
            <span className="campo__rotulo--obrigatorio">
              Li e aceito os termos de uso e a política de privacidade (LGPD).
            </span>
          </label>
          {erros.termos && <span className="campo__erro">{erros.termos}</span>}
        </div>

        <p className="legenda-obrigatorio">
          <span>*</span> Campos obrigatórios
        </p>

        <button className="btn btn--primario btn--largo" disabled={enviando}>
          {enviando ? (
            <>
              <LoaderCircle size={16} className="girando" /> Criando conta...
            </>
          ) : (
            <>
              Criar conta <ArrowRight size={16} />
            </>
          )}
        </button>

        <p className="formulario__rodape">
          Já tem conta? <Link to="/entrar" state={location.state}>Entrar</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
