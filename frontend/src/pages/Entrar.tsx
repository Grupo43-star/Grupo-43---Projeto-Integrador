import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import AuthLayout from '../components/layout/AuthLayout'
import { useAuth } from '../context/useAuth'
import { mensagemDeErro } from '../services/api'
import { emailValido, LIMITES } from '../utils/validar'

export default function Entrar() {
  const { entrar } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Volta para a página que a pessoa tentou acessar antes de entrar
  const destino = (location.state as { de?: string } | null)?.de ?? '/'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erros, setErros] = useState<{ email?: string; senha?: string; geral?: string }>({})
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const novosErros: typeof erros = {}
    if (!emailValido(email)) novosErros.email = 'Informe um e-mail válido.'
    if (!senha) novosErros.senha = 'Informe sua senha.'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setEnviando(true)
    try {
      await entrar(email.trim(), senha)
      navigate(destino, { replace: true })
    } catch (erro) {
      setErros({ geral: mensagemDeErro(erro, 'Não foi possível entrar.') })
      setEnviando(false)
    }
  }

  return (
    <AuthLayout
      titulo="Bom te ver de novo."
      descricao="Entre para solicitar retiradas, acompanhar seus pedidos e cuidar do seu perfil."
    >
      <form className="formulario" onSubmit={aoEnviar} noValidate>
        {erros.geral && <p className="alerta alerta--erro">{erros.geral}</p>}

        <label className="campo">
          <span className="campo__rotulo">E-mail</span>
          <input
            className={`input ${erros.email ? 'input--erro' : ''}`}
            type="email"
            maxLength={LIMITES.email}
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {erros.email && <span className="campo__erro">{erros.email}</span>}
        </label>

        <label className="campo">
          <span className="campo__rotulo">Senha</span>
          <span className="input-com-botao">
            <input
              className={`input ${erros.senha ? 'input--erro' : ''}`}
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={LIMITES.senha}
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <button
              type="button"
              className="input-com-botao__botao"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
          {erros.senha && <span className="campo__erro">{erros.senha}</span>}
        </label>

        <p className="auth__esqueci">
          <Link
            to="/esqueci-senha"
            state={{ ...(location.state as object | null), email: email.trim() || undefined }}
          >
            Esqueci minha senha
          </Link>
        </p>

        <button className="btn btn--primario btn--largo" disabled={enviando}>
          {enviando ? (
            <>
              <LoaderCircle size={16} className="girando" /> Entrando...
            </>
          ) : (
            <>
              Entrar <ArrowRight size={16} />
            </>
          )}
        </button>

        <p className="formulario__rodape">
          Ainda não tem conta? <Link to="/cadastro" state={location.state}>Criar conta</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
