import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Lock, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { nomesPapel, type Papel } from '../data/usuario'
import { inicioDoPapel, nomeDaArea } from '../utils/papeis'

interface Props {
  papeis: Papel[]
  /** Visitante passa direto (a própria tela convida a entrar, ex.: Solicitações) */
  visitantePassa?: boolean
  children: ReactNode
}

// Protege uma tela no front: só os papéis da lista veem o conteúdo. O back já recusa
// as rotas (403); aqui a pessoa vê um aviso claro e o caminho para a área dela.
export default function SomentePapeis({ papeis, visitantePassa = false, children }: Props) {
  const { usuario } = useAuth()
  const { pathname, search } = useLocation()

  if (!usuario) {
    if (visitantePassa) return children
    return (
      <div className="page">
        <div className="card card--row acesso">
          <span className="icon-circle icon-circle--lg">
            <Lock size={20} strokeWidth={1.75} />
          </span>
          <div className="acesso__texto">
            <p className="eyebrow eyebrow--simples">Área da equipe</p>
            <h1 className="card__titulo">Entre para continuar.</h1>
            <p className="texto-suave">Esta tela é usada pela equipe do ReciclaBairro.</p>
            <Link to="/entrar" state={{ de: pathname + search }} className="btn btn--primario">
              Entrar na conta <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!papeis.includes(usuario.papel)) {
    return (
      <div className="page">
        <div className="card card--row acesso">
          <span className="icon-circle icon-circle--lg">
            <ShieldAlert size={20} strokeWidth={1.75} />
          </span>
          <div className="acesso__texto">
            <p className="eyebrow eyebrow--simples">Sem acesso</p>
            <h1 className="card__titulo">Esta tela não faz parte da sua conta.</h1>
            <p className="texto-suave">
              Você entrou como {nomesPapel[usuario.papel].toLowerCase()}. O que é seu fica em{' '}
              {nomeDaArea(usuario.papel)}.
            </p>
            <Link to={inicioDoPapel(usuario.papel)} className="btn btn--primario">
              Ir para {nomeDaArea(usuario.papel)} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return children
}
