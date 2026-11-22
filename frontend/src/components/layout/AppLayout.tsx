import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import './layout.css'

const CHAVE_RECOLHIDA = 'sidebar-recolhida'

function lerPreferencia() {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDA) === '1'
  } catch {
    return false
  }
}

export default function AppLayout() {
  const celular = useMediaQuery('(max-width: 900px)')
  // Computador: sidebar fixa que pode ser recolhida (preferência salva no navegador)
  const [recolhida, setRecolhida] = useState(lerPreferencia)
  // Celular: sidebar abre por cima do conteúdo
  const [menuAberto, setMenuAberto] = useState(false)
  const { pathname } = useLocation()

  // Volta ao topo ao trocar de página
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  function alternarSidebar() {
    if (celular) {
      setMenuAberto((aberto) => !aberto)
      return
    }
    const nova = !recolhida
    setRecolhida(nova)
    try {
      localStorage.setItem(CHAVE_RECOLHIDA, nova ? '1' : '0')
    } catch {
      // Sem acesso ao armazenamento: só não lembra a preferência
    }
  }

  const sidebarVisivel = celular ? menuAberto : !recolhida

  return (
    <div className={`app ${!celular && recolhida ? 'app--recolhida' : ''}`}>
      <Sidebar aberto={menuAberto} onFechar={() => setMenuAberto(false)} />
      {celular && menuAberto && (
        <div className="app__overlay" onClick={() => setMenuAberto(false)} />
      )}
      <div className="app__main">
        <Topbar sidebarVisivel={sidebarVisivel} onAlternarSidebar={alternarSidebar} />
        <main className="app__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
