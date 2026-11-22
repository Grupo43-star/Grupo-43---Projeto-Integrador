import type { LucideIcon } from 'lucide-react'

interface Props {
  eyebrow: string
  titulo: string
  descricao?: string
  icon?: LucideIcon
}

export default function PageHeader({ eyebrow, titulo, descricao, icon: Icon }: Props) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-header__titulo">{titulo}</h1>
        {descricao && <p className="page-header__descricao">{descricao}</p>}
      </div>
      {Icon && (
        <span className="icon-circle icon-circle--lg">
          <Icon size={22} strokeWidth={1.75} />
        </span>
      )}
    </header>
  )
}
