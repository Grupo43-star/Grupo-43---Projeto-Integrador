// O que cada papel de conta vê: menu da sidebar, página inicial e quem pode abrir cada tela.
// O back já protege as rotas (403); aqui é só para cada pessoa ver o que é dela.

import {
  BookOpen,
  Building2,
  Calendar,
  CalendarCog,
  ChartColumn,
  ClipboardList,
  House,
  Map as IconeMapa,
  MapPin,
  MapPinned,
  Package,
  Recycle,
  Tags,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Papel } from '../data/usuario'

export interface ItemMenu {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export interface SecaoMenu {
  /** Sem título: menu de morador/comerciante/visitante, igual ao esboço */
  titulo?: string
  itens: ItemMenu[]
}

/** Quem pede retiradas (as telas de Solicitações e o Início do esboço). */
export const PAPEIS_SOLICITANTE: Papel[] = ['MORADOR', 'COMERCIANTE']

export const ehSolicitante = (papel: Papel) => PAPEIS_SOLICITANTE.includes(papel)

// Telas públicas que servem para todo mundo consultar
const guia: ItemMenu = { to: '/guia', label: 'Guia de materiais', icon: Recycle }
const pontos: ItemMenu = { to: '/pontos', label: 'Pontos de coleta', icon: MapPin }
const calendario: ItemMenu = { to: '/calendario', label: 'Calendário', icon: Calendar }
const consulta: SecaoMenu = { titulo: 'Para consultar', itens: [guia, pontos, calendario] }

const indicadoresAdmin: ItemMenu = { to: '/admin/indicadores', label: 'Indicadores', icon: ChartColumn }
const materiaisAdmin: ItemMenu = { to: '/admin/materiais', label: 'Materiais do guia', icon: BookOpen }
const categoriasAdmin: ItemMenu = { to: '/admin/categorias', label: 'Categorias', icon: Tags }

const menus: Record<Papel, SecaoMenu[]> = {
  MORADOR: [],
  COMERCIANTE: [],
  GESTOR_COOPERATIVA: [
    {
      titulo: 'Gestão',
      itens: [
        { to: '/cooperativa/pedidos', label: 'Pedidos', icon: ClipboardList },
        { to: '/cooperativa/equipe', label: 'Equipe', icon: Users },
        { to: '/cooperativa/indicadores', label: 'Indicadores', icon: ChartColumn },
        { to: '/gestao/pontos', label: 'Pontos da cooperativa', icon: MapPinned },
      ],
    },
    consulta,
  ],
  COLETOR: [
    { titulo: 'Coletas', itens: [{ to: '/coletor', label: 'Minhas coletas', icon: Truck }] },
    consulta,
  ],
  EDUCADOR: [
    { titulo: 'Educação', itens: [indicadoresAdmin, materiaisAdmin, categoriasAdmin] },
    consulta,
  ],
  ADMIN: [
    {
      titulo: 'Plataforma',
      itens: [
        indicadoresAdmin,
        materiaisAdmin,
        categoriasAdmin,
        { to: '/admin/regioes', label: 'Regiões', icon: IconeMapa },
        { to: '/admin/calendario', label: 'Calendário de coleta', icon: CalendarCog },
        { to: '/admin/cooperativas', label: 'Cooperativas', icon: Building2 },
        { to: '/gestao/pontos', label: 'Gestão de pontos', icon: MapPinned },
      ],
    },
    consulta,
  ],
}

/** Menu do esboço: visitante, morador e comerciante */
const menuSolicitante: SecaoMenu[] = [
  {
    itens: [
      { to: '/', label: 'Início', icon: House, end: true },
      guia,
      pontos,
      calendario,
      { to: '/solicitacoes', label: 'Solicitações', icon: Package },
    ],
  },
]

export function menuDoPapel(papel: Papel | null): SecaoMenu[] {
  return papel && !ehSolicitante(papel) ? menus[papel] : menuSolicitante
}

/** Primeira tela de cada papel (o "/" das contas de equipe leva para cá). */
export function inicioDoPapel(papel: Papel | null): string {
  switch (papel) {
    case 'GESTOR_COOPERATIVA':
      return '/cooperativa/pedidos'
    case 'COLETOR':
      return '/coletor'
    case 'EDUCADOR':
    case 'ADMIN':
      return '/admin/indicadores'
    default:
      return '/'
  }
}

/** Nome da área de cada papel, para os avisos de "esta tela não é da sua conta". */
export function nomeDaArea(papel: Papel): string {
  switch (papel) {
    case 'GESTOR_COOPERATIVA':
      return 'o painel da cooperativa'
    case 'COLETOR':
      return 'suas coletas'
    case 'EDUCADOR':
    case 'ADMIN':
      return 'o painel de administração'
    default:
      return 'o início'
  }
}
