import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, LoaderCircle, MailCheck } from 'lucide-react'
import AuthLayout from '../components/layout/AuthLayout'
import { mensagemDeErro } from '../services/api'
import { pedirCodigoDeSenha } from '../services/conta'
import { emailValido, LIMITES } from '../utils/validar'

// Pede o código de redefinição (POST /auth/forgot-password).
// O back responde igual exista ou não a conta, então a mensagem de sucesso diz "se existir".
export default function EsqueciSenha() {
  const location = useLocation()
  const estado = location.state as { de?: string; email?: string } | null

  const [email, setEmail] = useState(estado?.email ?? '')
  const [erro, setErro] = useState<{ email?: string; geral?: string }>({})
  const [enviando, setEnviando] = useState(false)
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null)
  const [vezes, setVezes] = useState(0)
  const avisoRef = useRef<HTMLDivElement>(null)

  // O aviso de envio recebe o foco (leitor de tela anuncia; a tela mostra o topo)
  useEffect(() => {
    if (vezes > 0) avisoRef.current?.focus()
  }, [vezes])

  async function enviar(endereco: string) {
    setEnviando(true)
    setErro({})
    try {
      await pedirCodigoDeSenha(endereco)
      setEnviadoPara(endereco)
      setVezes((n) => n + 1)
    } catch (e) {
      setErro({ geral: mensagemDeErro(e, 'Não foi possível enviar o código agora.') })
    } finally {
      setEnviando(false)
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = email.trim()
    if (!emailValido(limpo)) {
      setErro({ email: 'Informe um e-mail válido.' })
      return
    }
    void enviar(limpo)
  }

  return (
    <AuthLayout
      titulo="Esqueceu a senha?"
      descricao="Informe o e-mail da sua conta. Vamos mandar um código para você criar uma senha nova."
    >
      {enviadoPara ? (
        <div className="formulario">
          {erro.geral && <p className="alerta alerta--erro">{erro.geral}</p>}
          <div className="alerta alerta--sucesso" ref={avisoRef} tabIndex={-1} role="status">
            <MailCheck size={18} aria-hidden="true" />
            <span>
              Se existir uma conta com <strong>{enviadoPara}</strong>, enviamos um e-mail com o
              código para redefinir a senha. Ele vale por 60 minutos. Confira também a caixa de
              spam.
            </span>
          </div>

          <Link
            to="/redefinir-senha"
            state={estado?.de ? { de: estado.de } : undefined}
            className="btn btn--primario btn--largo"
          >
            Já recebi o código <ArrowRight size={16} />
          </Link>

          <p className="formulario__rodape">
            Não chegou?{' '}
            <button
              type="button"
              className="auth__link-botao"
              disabled={enviando}
              onClick={() => void enviar(enviadoPara)}
            >
              {enviando ? 'Enviando...' : 'Enviar de novo'}
            </button>{' '}
            ou{' '}
            <button
              type="button"
              className="auth__link-botao"
              onClick={() => {
                setEnviadoPara(null)
                setErro({})
              }}
            >
              usar outro e-mail
            </button>
          </p>
        </div>
      ) : (
        <form className="formulario" onSubmit={aoEnviar} noValidate>
          {erro.geral && <p className="alerta alerta--erro">{erro.geral}</p>}

          <label className="campo">
            <span className="campo__rotulo campo__rotulo--obrigatorio">E-mail</span>
            <input
              className={`input ${erro.email ? 'input--erro' : ''}`}
              type="email"
              aria-required
              maxLength={LIMITES.email}
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {erro.email && <span className="campo__erro">{erro.email}</span>}
          </label>

          <p className="legenda-obrigatorio">
            <span>*</span> Campos obrigatórios
          </p>

          <button className="btn btn--primario btn--largo" disabled={enviando}>
            {enviando ? (
              <>
                <LoaderCircle size={16} className="girando" /> Enviando...
              </>
            ) : (
              <>
                Enviar código <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="formulario__rodape">
            Já tem um código?{' '}
            <Link to="/redefinir-senha" state={estado?.de ? { de: estado.de } : undefined}>
              Usar o código
            </Link>
            <br />
            Lembrou a senha?{' '}
            <Link to="/entrar" state={estado?.de ? { de: estado.de } : undefined}>
              Entrar
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
