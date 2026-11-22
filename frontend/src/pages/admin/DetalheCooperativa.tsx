import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Mail, Pencil, Phone, SearchX, UserPlus } from 'lucide-react'
import JanelaCooperativa from '../../components/JanelaCooperativa'
import JanelaMembro from '../../components/JanelaMembro'
import { Carregando, ErroComTentar, SeloAtivo } from '../../components/Painel'
import { useConsulta } from '../../hooks/useConsulta'
import { buscarCooperativa, cadastrarMembroDaCooperativa } from '../../services/admin'
import { ErroApi } from '../../services/api'
import '../equipe/equipe.css'

const formatoDesde = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

// Uma cooperativa e a equipe dela (GET /admin/cooperatives/:id). O admin cadastra gestores e
// coletores (POST /:id/members); ativar ou desativar membros é com a gestão da cooperativa.
export default function DetalheCooperativa() {
  const { id = '' } = useParams()
  const cooperativa = useConsulta(`cooperativa|${id}`, (s) => buscarCooperativa(id, s))
  const [editando, setEditando] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const [aviso, setAviso] = useState('')
  const c = cooperativa.dados
  const naoAchou =
    cooperativa.erro instanceof ErroApi && (cooperativa.erro.status === 404 || cooperativa.erro.status === 400)

  return (
    <div className="page page--larga detalhe">
      <Link to="/admin/cooperativas" className="voltar">
        <ArrowLeft size={16} aria-hidden="true" /> Cooperativas
      </Link>

      {naoAchou ? (
        <div className="card painel__vazio">
          <span className="icon-circle">
            <SearchX size={20} strokeWidth={1.75} />
          </span>
          <h1 className="card__titulo">Cooperativa não encontrada.</h1>
          <Link to="/admin/cooperativas" className="btn btn--primario">
            Ver as cooperativas <ArrowRight size={16} />
          </Link>
        </div>
      ) : cooperativa.erro ? (
        <ErroComTentar erro={cooperativa.erro} titulo="Não foi possível carregar a cooperativa agora." aoTentar={cooperativa.recarregar} />
      ) : !c ? (
        <Carregando />
      ) : (
        <>
          <header className="detalhe__cabecalho">
            <div className="detalhe__cabecalho-topo">
              <p className="eyebrow eyebrow--simples">Cooperativa</p>
              <SeloAtivo ativo={c.ativa} feminino />
            </div>
            <h1 className="page-header__titulo">{c.nome}</h1>
            <p className="detalhe__linha">
              {[c.cnpj && `CNPJ ${c.cnpj}`, c.telefone, c.email].filter(Boolean).join(' · ') || 'Sem dados de contato.'}
            </p>
            <p className="detalhe__linha">
              {c.regioes.length === 0 ? 'Nenhuma região atendida.' : `Atende: ${c.regioes.map((r) => r.nome).join(', ')}`}
            </p>
          </header>

          {aviso && (
            <p className="alerta alerta--sucesso painel__erro" role="status">
              <Check size={16} aria-hidden="true" /> {aviso}
            </p>
          )}

          <div className="painel__barra">
            <button type="button" className="btn btn--contorno" onClick={() => setEditando(true)}>
              <Pencil size={16} /> Editar dados
            </button>
            <button type="button" className="btn btn--primario" onClick={() => setCadastrando(true)}>
              <UserPlus size={16} /> Cadastrar membro
            </button>
          </div>

          <section className="painel__grupo" aria-labelledby="t-equipe">
            <h2 id="t-equipe" className="painel__grupo-titulo">
              Equipe ({c.membros.length})
            </h2>
            {c.membros.length === 0 ? (
              <p className="texto-suave">Ninguém cadastrado ainda. Comece pela gestão da cooperativa.</p>
            ) : (
              <ul className="membros">
                {c.membros.map((m) => (
                  <li key={m.id} className={`card membro ${m.ativo ? '' : 'membro--inativo'}`}>
                    <div className="membro__identidade">
                      <strong>{m.usuario.nome}</strong>
                      <span className="pontos__tipo">{m.papel === 'GESTOR' ? 'Gestão' : 'Coletor(a)'}</span>
                      <SeloAtivo ativo={m.ativo} />
                    </div>
                    <div className="membro__contato">
                      <a href={`mailto:${m.usuario.email}`}>
                        <Mail size={13} aria-hidden="true" /> {m.usuario.email}
                      </a>
                      {m.usuario.telefone && (
                        <span>
                          <Phone size={13} aria-hidden="true" /> {m.usuario.telefone}
                        </span>
                      )}
                      <span className="texto-suave">Desde {formatoDesde.format(new Date(m.desde))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="texto-nota">Ativar ou desativar membros é feito pela gestão da cooperativa, na tela Equipe.</p>
          </section>
        </>
      )}

      {editando && c && (
        <JanelaCooperativa
          original={c}
          aoFechar={() => setEditando(false)}
          aoSalvar={(nova) => {
            setEditando(false)
            setAviso('Dados da cooperativa atualizados.')
            cooperativa.substituir(nova)
          }}
        />
      )}
      {cadastrando && c && (
        <JanelaMembro
          titulo="Cadastrar membro"
          descricao={`Cria a conta de acesso já ligada a ${c.nome}.`}
          escolherPapel
          aoFechar={() => setCadastrando(false)}
          aoEnviar={(dados, papel) => cadastrarMembroDaCooperativa(c.id, papel, dados)}
          aoSalvar={(m) => {
            setCadastrando(false)
            setAviso(`Conta de ${m.usuario.nome} criada. Ela já pode entrar com o e-mail e a senha inicial.`)
            cooperativa.substituir({ ...c, membros: [...c.membros, m], totalMembros: c.totalMembros + 1 })
          }}
        />
      )}
    </div>
  )
}
