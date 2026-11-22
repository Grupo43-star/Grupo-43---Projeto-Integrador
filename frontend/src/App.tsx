import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import SomentePapeis from './components/SomentePapeis'
import { useAuth } from './context/useAuth'
import type { Papel } from './data/usuario'
import Cadastro from './pages/Cadastro'
import Calendario from './pages/Calendario'
import DetalhePedido from './pages/DetalhePedido'
import DetalhePonto from './pages/DetalhePonto'
import Entrar from './pages/Entrar'
import EsqueciSenha from './pages/EsqueciSenha'
import Guia from './pages/Guia'
import Inicio from './pages/Inicio'
import Perfil from './pages/Perfil'
import Pontos from './pages/Pontos'
import RedefinirSenha from './pages/RedefinirSenha'
import Solicitacoes from './pages/Solicitacoes'
import { ehSolicitante, inicioDoPapel, PAPEIS_SOLICITANTE } from './utils/papeis'

// Painéis da equipe: carregados sob demanda (quem pede retiradas nunca baixa esse código)
const CalendarioColeta = lazy(() => import('./pages/admin/CalendarioColeta'))
const Categorias = lazy(() => import('./pages/admin/Categorias'))
const Cooperativas = lazy(() => import('./pages/admin/Cooperativas'))
const DetalheCooperativa = lazy(() => import('./pages/admin/DetalheCooperativa'))
const Materiais = lazy(() => import('./pages/admin/Materiais'))
const Regioes = lazy(() => import('./pages/admin/Regioes'))
const EquipeCooperativa = lazy(() => import('./pages/equipe/EquipeCooperativa'))
const FilaCooperativa = lazy(() => import('./pages/equipe/FilaCooperativa'))
const GestaoPontos = lazy(() => import('./pages/equipe/GestaoPontos'))
const Indicadores = lazy(() => import('./pages/equipe/Indicadores'))
const MinhasColetas = lazy(() => import('./pages/equipe/MinhasColetas'))
const PedidoEquipe = lazy(() => import('./pages/equipe/PedidoEquipe'))

// Quem já chega logado não precisa ver as telas de entrar/cadastrar:
// volta para a página de origem (ex.: Solicitações) ou, se não houver, para o início.
// Só olha o estado de quando a tela abriu: quem acabou de entrar ou criar a conta
// segue o destino escolhido pela própria tela (origem, início ou perfil).
function SomenteVisitante({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [jaChegouLogado] = useState(() => usuario !== null)
  const origem = (useLocation().state as { de?: string } | null)?.de
  return jaChegouLogado ? (
    <Navigate to={origem ?? inicioDoPapel(usuario?.papel ?? null)} replace />
  ) : (
    children
  )
}

// O Início do esboço é de quem pede retiradas; as contas de equipe vão direto para o painel delas
function InicioPorPapel() {
  const { usuario } = useAuth()
  if (usuario && !ehSolicitante(usuario.papel)) return <Navigate to={inicioDoPapel(usuario.papel)} replace />
  return <Inicio />
}

const GESTOR: Papel[] = ['GESTOR_COOPERATIVA']
const COLETOR: Papel[] = ['COLETOR']
const EXECUCAO: Papel[] = ['COLETOR', 'GESTOR_COOPERATIVA']
const GUIA: Papel[] = ['ADMIN', 'EDUCADOR']
const ADMIN: Papel[] = ['ADMIN']
const PONTOS: Papel[] = ['ADMIN', 'GESTOR_COOPERATIVA']

const carregandoTela = (
  <div className="page" aria-busy="true">
    <p className="texto-suave">Carregando...</p>
  </div>
)

const so = (papeis: Papel[], tela: ReactNode) => (
  <SomentePapeis papeis={papeis}>
    <Suspense fallback={carregandoTela}>{tela}</Suspense>
  </SomentePapeis>
)

export default function App() {
  return (
    <Routes>
      <Route
        path="entrar"
        element={
          <SomenteVisitante>
            <Entrar />
          </SomenteVisitante>
        }
      />
      <Route
        path="cadastro"
        element={
          <SomenteVisitante>
            <Cadastro />
          </SomenteVisitante>
        }
      />
      <Route
        path="esqueci-senha"
        element={
          <SomenteVisitante>
            <EsqueciSenha />
          </SomenteVisitante>
        }
      />
      {/* Sem SomenteVisitante: o link do e-mail pode ser aberto com alguém logado no aparelho */}
      <Route path="redefinir-senha" element={<RedefinirSenha />} />

      <Route element={<AppLayout />}>
        <Route index element={<InicioPorPapel />} />
        <Route path="guia" element={<Guia />} />
        <Route path="pontos" element={<Pontos />} />
        <Route path="pontos/:id" element={<DetalhePonto />} />
        <Route path="calendario" element={<Calendario />} />
        {/* Visitante passa: a própria tela convida a entrar */}
        <Route
          path="solicitacoes"
          element={
            <SomentePapeis papeis={PAPEIS_SOLICITANTE} visitantePassa>
              <Solicitacoes />
            </SomentePapeis>
          }
        />
        <Route
          path="solicitacoes/:id"
          element={
            <SomentePapeis papeis={PAPEIS_SOLICITANTE} visitantePassa>
              <DetalhePedido />
            </SomentePapeis>
          }
        />
        <Route path="perfil" element={<Perfil />} />

        {/* Gestão da cooperativa */}
        <Route path="cooperativa/pedidos" element={so(GESTOR, <FilaCooperativa />)} />
        <Route path="cooperativa/pedidos/:id" element={so(GESTOR, <PedidoEquipe modo="gestor" />)} />
        <Route path="cooperativa/equipe" element={so(GESTOR, <EquipeCooperativa />)} />
        <Route path="cooperativa/indicadores" element={so(GESTOR, <Indicadores escopo="cooperativa" />)} />
        <Route path="gestao/pontos" element={so(PONTOS, <GestaoPontos />)} />

        {/* Coletor */}
        <Route path="coletor" element={so(COLETOR, <MinhasColetas />)} />
        <Route path="coletor/coletas/:id" element={so(EXECUCAO, <PedidoEquipe modo="coletor" />)} />

        {/* Administração (admin) e guia (admin e educador) */}
        <Route path="admin/indicadores" element={so(GUIA, <Indicadores escopo="plataforma" />)} />
        <Route path="admin/materiais" element={so(GUIA, <Materiais />)} />
        <Route path="admin/categorias" element={so(GUIA, <Categorias />)} />
        <Route path="admin/regioes" element={so(ADMIN, <Regioes />)} />
        <Route path="admin/calendario" element={so(ADMIN, <CalendarioColeta />)} />
        <Route path="admin/cooperativas" element={so(ADMIN, <Cooperativas />)} />
        <Route path="admin/cooperativas/:id" element={so(ADMIN, <DetalheCooperativa />)} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
