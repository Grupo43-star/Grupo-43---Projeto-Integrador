import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Recycle } from 'lucide-react'
import Logo from './Logo'
import './auth.css'

interface Props {
  titulo: string
  descricao: string
  children: ReactNode
}

// Estrutura das telas de entrar/cadastrar: cartão centralizado sobre o fundo verde,
// com o painel da marca à esquerda e o formulário à direita.
export default function AuthLayout({ titulo, descricao, children }: Props) {
  return (
    <div className="auth">
      <span className="auth__anel auth__anel--1" aria-hidden="true" />
      <span className="auth__anel auth__anel--2" aria-hidden="true" />

      <Link to="/" className="auth__voltar">
        <ArrowLeft size={15} /> Voltar ao início
      </Link>

      <div className="auth__cartao">
        <aside className="auth__marca">
          <div className="auth__marca-centro">
            <Link to="/" className="auth__logo">
              <Logo size={40} />
              <span>
                <strong>Recicla</strong>Bairro
              </span>
            </Link>
            <p className="auth__slogan">Um bairro melhor começa com um descarte de cada vez.</p>
          </div>

          <ul className="auth__beneficios">
            <li>
              <Calendar size={17} strokeWidth={1.75} /> Agende retiradas sem sair de casa
            </li>
            <li>
              <MapPin size={17} strokeWidth={1.75} /> Encontre pontos de coleta perto de você
            </li>
            <li>
              <Recycle size={17} strokeWidth={1.75} /> Acompanhe o quanto você já reciclou
            </li>
          </ul>
        </aside>

        <main className="auth__conteudo">
          <p className="eyebrow">Acesso à sua conta</p>
          <h1 className="auth__titulo">{titulo}</h1>
          <p className="texto-suave auth__descricao">{descricao}</p>
          {children}
        </main>
      </div>
    </div>
  )
}
