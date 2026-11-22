import { NavLink, Link } from 'react-router-dom'
import { ChevronRight, X } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { nomesPapel } from '../../data/usuario'
import { iniciais } from '../../utils/formatar'
import { ehSolicitante, inicioDoPapel, menuDoPapel } from '../../utils/papeis'
import Logo from './Logo'

interface Props {
  aberto: boolean
  onFechar: () => void
}

export default function Sidebar({ aberto, onFechar }: Props) {
  const { usuario } = useAuth()
  const papel = usuario?.papel ?? null
  const secoes = menuDoPapel(papel)
  const equipe = papel !== null && !ehSolicitante(papel)

  return (
    <aside className={`sidebar ${aberto ? 'sidebar--aberto' : ''}`}>
      <div className="sidebar__top">
        <Link to={inicioDoPapel(papel)} className="sidebar__brand" onClick={onFechar}>
          <Logo size={34} />
          <span>
            <strong>Recicla</strong>Bairro
          </span>
        </Link>
        <button className="sidebar__fechar" onClick={onFechar} aria-label="Fechar menu">
          <X size={20} />
        </button>
      </div>

      <p className="sidebar__slogan">Um bairro melhor começa com um descarte de cada vez.</p>

      {equipe ? (
        <p className="sidebar__tagline sidebar__tagline--equipe">
          {usuario?.cooperativa?.nome ?? nomesPapel[papel]}
        </p>
      ) : (
        <p className="sidebar__tagline">Sua comunidade, em ciclo</p>
      )}

      <nav className={`sidebar__nav ${secoes.length > 1 ? 'sidebar__nav--secoes' : ''}`}>
        {secoes.map((secao, i) => (
          <div key={secao.titulo ?? i} className="sidebar__secao">
            {secao.titulo && <p className="sidebar__secao-titulo">{secao.titulo}</p>}
            {secao.itens.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onFechar}
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--ativo' : ''}`}
              >
                <Icon size={20} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__bottom">
        {/* Acesso ao "Meu perfil" (logado) ou à tela de entrar (visitante) */}
        <NavLink
          to={usuario ? '/perfil' : '/entrar'}
          onClick={onFechar}
          className={({ isActive }) => `sidebar__conta ${isActive ? 'sidebar__conta--ativo' : ''}`}
        >
          <span className="sidebar__conta-avatar">
            {usuario ? iniciais(usuario.nome) : 'RB'}
          </span>
          <span className="sidebar__conta-texto">
            <strong>{usuario ? usuario.nome : 'Entrar na conta'}</strong>
            <small>{usuario ? 'Ver meu perfil' : 'Entre para acompanhar'}</small>
          </span>
          <ChevronRight size={16} />
        </NavLink>
      </div>
    </aside>
  )
}
