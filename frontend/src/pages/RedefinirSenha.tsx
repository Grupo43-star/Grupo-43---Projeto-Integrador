import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, CircleCheck, Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react'
import AuthLayout from '../components/layout/AuthLayout'
import { useAuth } from '../context/useAuth'
import { ErroApi, mensagemDeErro } from '../services/api'
import { redefinirSenha } from '../services/conta'
import { LIMITES, MINIMOS } from '../utils/validar'

type Campos = 'codigo' | 'senha' | 'confirmacao'

/** Mínimo do back para o código (o e-mail manda 64 caracteres). */
const MINIMO_CODIGO = 10

/**
 * Aceita o código puro ou o link inteiro do e-mail colado no campo
 * (".../redefinir-senha?token=abc"), sem espaços nem quebras de linha.
 */
function extrairCodigo(valor: string) {
  const limpo = valor.replace(/\s+/g, '')
  const achado = /[?&]token=([^&#]+)/.exec(limpo)
  return achado ? decodeURIComponent(achado[1]) : limpo
}

// Define a senha nova com o código do e-mail (POST /auth/reset-password).
// Mesmo caminho do link que o back manda: /redefinir-senha?token=<código>.
// Sem token na URL, a pessoa cola o código (ou o link) no campo.
export default function RedefinirSenha() {
  const { usuario, sair } = useAuth()
  const location = useLocation()
  const destino = (location.state as { de?: string } | null)?.de
  const [parametros] = useSearchParams()
  const codigoDoLink = extrairCodigo(parametros.get('token') ?? '')

  const [dados, setDados] = useState<Record<Campos, string>>({
    codigo: codigoDoLink,
    senha: '',
    confirmacao: '',
  })
  // Veio pelo link: o campo do código fica escondido, até o back dizer que ele não vale
  const [mostrarCodigo, setMostrarCodigo] = useState(codigoDoLink.length === 0)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erros, setErros] = useState<Partial<Record<Campos | 'geral', string>>>({})
  const [codigoInvalido, setCodigoInvalido] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const avisoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (concluido) avisoRef.current?.focus()
  }, [concluido])

  const alterar = (campo: Campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDados((atual) => ({
      ...atual,
      [campo]: campo === 'codigo' ? extrairCodigo(e.target.value) : e.target.value,
    }))

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const novosErros: typeof erros = {}
    if (dados.codigo.length < MINIMO_CODIGO) {
      novosErros.codigo = 'Cole o código que chegou no seu e-mail.'
    }
    if (dados.senha.length < MINIMOS.senha)
      novosErros.senha = `A senha precisa ter pelo menos ${MINIMOS.senha} caracteres.`
    if (dados.confirmacao !== dados.senha) novosErros.confirmacao = 'As senhas não coincidem.'
    setErros(novosErros)
    setCodigoInvalido(false)
    if (novosErros.codigo) setMostrarCodigo(true)
    if (Object.keys(novosErros).length > 0) return

    setEnviando(true)
    try {
      await redefinirSenha(dados.codigo, dados.senha)
      // O back encerra as sessões da conta; quem estava logado entra de novo com a senha nova
      if (usuario) await sair()
      setConcluido(true)
    } catch (erro) {
      const invalido = erro instanceof ErroApi && erro.codigo === 'INVALID_RESET_TOKEN'
      setCodigoInvalido(invalido)
      if (invalido) setMostrarCodigo(true)
      setErros({ geral: mensagemDeErro(erro, 'Não foi possível redefinir a senha.') })
    } finally {
      setEnviando(false)
    }
  }

  if (concluido) {
    return (
      <AuthLayout
        titulo="Senha alterada."
        descricao="Pronto. Agora é só entrar com a senha nova."
      >
        <div className="formulario">
          <div className="alerta alerta--sucesso" ref={avisoRef} tabIndex={-1} role="status">
            <CircleCheck size={18} aria-hidden="true" />
            <span>
              Sua senha foi redefinida. Por segurança, encerramos as sessões abertas em outros
              aparelhos.
            </span>
          </div>
          <Link
            to="/entrar"
            state={destino ? { de: destino } : undefined}
            className="btn btn--primario btn--largo"
          >
            Entrar com a senha nova <ArrowRight size={16} />
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const campoSenha = (nome: 'senha' | 'confirmacao', rotulo: string, placeholder: string) => (
    <label className="campo">
      <span className="campo__rotulo campo__rotulo--obrigatorio">{rotulo}</span>
      <span className={nome === 'senha' ? 'input-com-botao' : undefined}>
        <input
          className={`input ${erros[nome] ? 'input--erro' : ''}`}
          aria-required
          type={mostrarSenha ? 'text' : 'password'}
          autoComplete="new-password"
          maxLength={LIMITES.senha}
          placeholder={placeholder}
          value={dados[nome]}
          onChange={alterar(nome)}
        />
        {nome === 'senha' && (
          <button
            type="button"
            className="input-com-botao__botao"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? 'Ocultar senhas' : 'Mostrar senhas'}
          >
            {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </span>
      {erros[nome] && <span className="campo__erro">{erros[nome]}</span>}
    </label>
  )

  return (
    <AuthLayout
      titulo="Crie uma senha nova."
      descricao="Use o código que chegou no seu e-mail. Ele vale por 60 minutos."
    >
      <form className="formulario" onSubmit={aoEnviar} noValidate>
        {erros.geral && (
          <p className="alerta alerta--erro" role="alert">
            <span>
              {erros.geral}
              {codigoInvalido && (
                <>
                  {' '}
                  <Link to="/esqueci-senha" state={destino ? { de: destino } : undefined}>
                    Pedir um novo código
                  </Link>
                </>
              )}
            </span>
          </p>
        )}

        {mostrarCodigo ? (
          <label className="campo">
            <span className="campo__rotulo campo__rotulo--obrigatorio">Código do e-mail</span>
            <input
              className={`input ${erros.codigo || codigoInvalido ? 'input--erro' : ''}`}
              aria-required
              autoComplete="one-time-code"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={400}
              placeholder="Cole aqui o código ou o link"
              value={dados.codigo}
              onChange={alterar('codigo')}
            />
            {erros.codigo ? (
              <span className="campo__erro">{erros.codigo}</span>
            ) : (
              <span className="campo__ajuda">
                Está no e-mail "Redefinição de senha". Pode colar o link inteiro.
              </span>
            )}
          </label>
        ) : (
          <p className="alerta alerta--info">
            <KeyRound size={18} aria-hidden="true" />
            <span>Código do e-mail reconhecido. Agora escolha a senha nova.</span>
          </p>
        )}

        <div className="formulario__linha">
          {campoSenha('senha', 'Senha nova', `Mínimo ${MINIMOS.senha} caracteres`)}
          {campoSenha('confirmacao', 'Confirmar senha', 'Repita a senha')}
        </div>

        <p className="legenda-obrigatorio">
          <span>*</span> Campos obrigatórios
        </p>

        <button className="btn btn--primario btn--largo" disabled={enviando}>
          {enviando ? (
            <>
              <LoaderCircle size={16} className="girando" /> Salvando...
            </>
          ) : (
            <>
              Salvar senha nova <ArrowRight size={16} />
            </>
          )}
        </button>

        <p className="formulario__rodape">
          Não tem o código?{' '}
          <Link to="/esqueci-senha" state={destino ? { de: destino } : undefined}>
            Pedir um código
          </Link>
          <br />
          Lembrou a senha?{' '}
          <Link to="/entrar" state={destino ? { de: destino } : undefined}>
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
