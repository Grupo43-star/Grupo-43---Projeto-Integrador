import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { dataPorExtenso, iniciais } from '../../utils/formatar'
import MenuRegiao from './MenuRegiao'
import Notificacoes from './Notificacoes'

interface Props {
  sidebarVisivel: boolean
  onAlternarSidebar: () => void
}

export default function Topbar({ sidebarVisivel, onAlternarSidebar }: Props) {
  const { usuario } = useAuth()
  const [hoje] = useState(() => dataPorExtenso(new Date()))
  const rotulo = sidebarVisivel ? 'Recolher menu' : 'Abrir menu'

  return (
    <header className="topbar">
      <button
        className="topbar__icone topbar__toggle"
        onClick={onAlternarSidebar}
        aria-label={rotulo}
        aria-expanded={sidebarVisivel}
        title={rotulo}
      >
        {sidebarVisivel ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
      </button>

      <span className="topbar__data">
        <span className="topbar__dot" />
        {hoje}
      </span>

      <div className="topbar__acoes">
        <MenuRegiao />
        {/* key: ao trocar de conta, as notificações e as lidas começam do zero */}
        <Notificacoes key={usuario?.id ?? 'visitante'} />
        <Link
          to={usuario ? '/perfil' : '/entrar'}
          className="topbar__avatar"
          title={usuario ? 'Meu perfil' : 'Entrar na conta'}
        >
          {usuario ? iniciais(usuario.nome) : 'RB'}
        </Link>
      </div>
    </header>
  )
}
