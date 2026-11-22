import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Check, Mail, Pencil, Phone, Plus } from 'lucide-react'
import JanelaCooperativa from '../../components/JanelaCooperativa'
import PageHeader from '../../components/PageHeader'
import { Carregando, ErroComTentar, SeloAtivo, Vazio } from '../../components/Painel'
import { useConsulta } from '../../hooks/useConsulta'
import { listarCooperativas, type CooperativaAdmin } from '../../services/admin'
import '../equipe/equipe.css'

// Cooperativas (GET/POST/PATCH /admin/cooperatives): só admin.
export default function Cooperativas() {
  const cooperativas = useConsulta('cooperativas', (s) => listarCooperativas(s))
  const [editando, setEditando] = useState<CooperativaAdmin | 'nova' | null>(null)
  const [aviso, setAviso] = useState('')

  return (
    <div className="page page--larga">
      <PageHeader
        eyebrow="Administração"
        titulo="Cooperativas"
        descricao="Quem atende os pedidos de retirada. Cada cooperativa recebe os pedidos das regiões marcadas e tem a própria equipe."
        icon={Building2}
      />

      <div className="painel__barra">
        <p className="texto-suave">{cooperativas.dados ? `${cooperativas.dados.length} cooperativas` : ''}</p>
        <button type="button" className="btn btn--primario" onClick={() => setEditando('nova')}>
          <Plus size={16} /> Nova cooperativa
        </button>
      </div>

      {aviso && (
        <p className="alerta alerta--sucesso painel__erro" role="status">
          <Check size={16} aria-hidden="true" /> {aviso}
        </p>
      )}

      {cooperativas.erro ? (
        <ErroComTentar erro={cooperativas.erro} titulo="Não foi possível carregar as cooperativas agora." aoTentar={cooperativas.recarregar} />
      ) : !cooperativas.dados ? (
        <Carregando />
      ) : cooperativas.dados.length === 0 ? (
        <Vazio icone={Building2} titulo="Nenhuma cooperativa cadastrada." />
      ) : (
        <ul className="painel__lista painel__lista--2">
          {cooperativas.dados.map((c) => (
            <li key={c.id} className={`card ponto-gerido ${c.ativa ? '' : 'ponto-gerido--inativo'}`}>
              <div className="ponto-gerido__topo">
                <span className="pontos__tipo">{c.cnpj ? `CNPJ ${c.cnpj}` : 'Sem CNPJ'}</span>
                <SeloAtivo ativo={c.ativa} feminino />
              </div>
              <h2 className="card__titulo">
                <Link to={`/admin/cooperativas/${c.id}`}>{c.nome}</Link>
              </h2>
              <div className="membro__contato">
                {c.telefone && (
                  <span>
                    <Phone size={13} aria-hidden="true" /> {c.telefone}
                  </span>
                )}
                {c.email && (
                  <span>
                    <Mail size={13} aria-hidden="true" /> {c.email}
                  </span>
                )}
              </div>
              <p className="texto-suave">
                {c.regioes.length === 0 ? 'Nenhuma região atendida.' : `Atende: ${c.regioes.map((r) => r.nome).join(', ')}`}
              </p>
              <p className="texto-suave">
                {c.totalMembros} {c.totalMembros === 1 ? 'pessoa na equipe' : 'pessoas na equipe'}
              </p>
              <div className="ponto-gerido__acoes">
                <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setEditando(c)}>
                  <Pencil size={14} /> Editar
                </button>
                <Link to={`/admin/cooperativas/${c.id}`} className="link-seta">
                  Ver equipe <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <JanelaCooperativa
          original={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(c) => {
            setAviso(editando === 'nova' ? `${c.nome} foi cadastrada. Agora cadastre a equipe dela.` : `${c.nome} foi atualizada.`)
            setEditando(null)
            cooperativas.recarregar()
          }}
        />
      )}
    </div>
  )
}
