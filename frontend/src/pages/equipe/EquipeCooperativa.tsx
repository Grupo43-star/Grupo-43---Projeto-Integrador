import { useState } from 'react'
import { Check, LoaderCircle, Mail, Phone, UserPlus, Users } from 'lucide-react'
import Janela from '../../components/Janela'
import JanelaMembro from '../../components/JanelaMembro'
import PageHeader from '../../components/PageHeader'
import { Carregando, ErroComTentar, SeloAtivo } from '../../components/Painel'
import { useAuth } from '../../context/useAuth'
import { useConsulta } from '../../hooks/useConsulta'
import { mensagemDeErro } from '../../services/api'
import { alterarMembro, cadastrarColetor, listarMembros, type Membro } from '../../services/equipe'
import './equipe.css'

const formatoDesde = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

// Equipe da cooperativa (GET/POST/PATCH /cooperative/members): gestores e coletores.
// A gestão cadastra coletores e ativa ou desativa membros (gestores novos só o admin cria).
export default function EquipeCooperativa() {
  const { usuario } = useAuth()
  const membros = useConsulta('membros', (s) => listarMembros(s))
  const [cadastrando, setCadastrando] = useState(false)
  const [desativando, setDesativando] = useState<Membro | null>(null)
  const [reativando, setReativando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [erroLinha, setErroLinha] = useState<{ id: string; mensagem: string } | null>(null)

  function atualizar(membro: Membro, mensagem: string) {
    const lista = membros.dados ?? []
    const existe = lista.some((m) => m.id === membro.id)
    membros.substituir(existe ? lista.map((m) => (m.id === membro.id ? membro : m)) : [...lista, membro])
    setAviso(mensagem)
    setErroLinha(null)
  }

  async function reativar(m: Membro) {
    setReativando(m.id)
    setAviso('')
    setErroLinha(null)
    try {
      atualizar(await alterarMembro(m.id, true), `${m.usuario.nome} voltou a ter acesso.`)
    } catch (erro) {
      setErroLinha({ id: m.id, mensagem: mensagemDeErro(erro) })
    } finally {
      setReativando(null)
    }
  }

  const lista = membros.dados ?? []
  const gestores = lista.filter((m) => m.papel === 'GESTOR')
  const coletores = lista.filter((m) => m.papel === 'COLETOR')

  function grupo(titulo: string, itens: Membro[], vazio: string) {
    return (
      <section className="painel__grupo" aria-label={titulo}>
        <h2 className="painel__grupo-titulo">
          {titulo} ({itens.length})
        </h2>
        {itens.length === 0 ? (
          <p className="texto-suave">{vazio}</p>
        ) : (
          <ul className="membros">
            {itens.map((m) => {
              const eu = m.usuario.id === usuario?.id
              return (
                <li key={m.id} className={`card membro ${m.ativo ? '' : 'membro--inativo'}`}>
                  <div className="membro__identidade">
                    <strong>
                      {m.usuario.nome}
                      {eu && <span className="texto-suave"> (você)</span>}
                    </strong>
                    <SeloAtivo ativo={m.ativo} />
                  </div>
                  <div className="membro__contato">
                    <a href={`mailto:${m.usuario.email}`}>
                      <Mail size={13} aria-hidden="true" /> {m.usuario.email}
                    </a>
                    {m.usuario.telefone && (
                      <a href={`tel:${m.usuario.telefone.replace(/\D/g, '')}`}>
                        <Phone size={13} aria-hidden="true" /> {m.usuario.telefone}
                      </a>
                    )}
                    <span className="texto-suave">Na equipe desde {formatoDesde.format(new Date(m.desde))}</span>
                  </div>
                  {!eu && (
                    <div className="membro__acoes">
                      {m.ativo ? (
                        <button type="button" className="btn btn--texto-perigo btn--pequeno" onClick={() => setDesativando(m)}>
                          Desativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--contorno btn--pequeno"
                          disabled={reativando !== null}
                          onClick={() => reativar(m)}
                        >
                          {reativando === m.id && <LoaderCircle size={14} className="girando" />} Reativar
                        </button>
                      )}
                    </div>
                  )}
                  {erroLinha?.id === m.id && (
                    <p className="campo__erro membro__erro" role="alert">
                      {erroLinha.mensagem}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={usuario?.cooperativa?.nome ?? 'Cooperativa'}
        titulo="Equipe"
        descricao="Quem trabalha com a cooperativa no ReciclaBairro. Cadastre coletores e controle quem tem acesso."
        icon={Users}
      />

      <div className="painel__barra">
        <p className="texto-suave">Novos gestores são cadastrados pela administração da plataforma.</p>
        <button type="button" className="btn btn--primario" onClick={() => setCadastrando(true)}>
          <UserPlus size={16} /> Cadastrar coletor
        </button>
      </div>

      {aviso && (
        <p className="alerta alerta--sucesso painel__erro" role="status">
          <Check size={16} aria-hidden="true" /> {aviso}
        </p>
      )}

      {membros.erro ? (
        <ErroComTentar erro={membros.erro} titulo="Não foi possível carregar a equipe agora." aoTentar={membros.recarregar} />
      ) : !membros.dados ? (
        <Carregando texto="Carregando a equipe..." />
      ) : (
        <>
          {grupo('Coletores', coletores, 'Nenhum coletor cadastrado ainda.')}
          {grupo('Gestão', gestores, 'Nenhum gestor.')}
        </>
      )}

      {cadastrando && (
        <JanelaMembro
          titulo="Cadastrar coletor"
          descricao="Cria a conta de acesso do coletor, já ligada à cooperativa."
          aoFechar={() => setCadastrando(false)}
          aoEnviar={(dados) => cadastrarColetor(dados)}
          aoSalvar={(m) => {
            setCadastrando(false)
            atualizar(m, `Conta de ${m.usuario.nome} criada. Ela já pode entrar com o e-mail e a senha inicial.`)
          }}
        />
      )}
      {desativando && (
        <JanelaDesativar
          membro={desativando}
          aoFechar={() => setDesativando(null)}
          aoSalvar={(m) => {
            setDesativando(null)
            atualizar(m, `${m.usuario.nome} não tem mais acesso.`)
          }}
        />
      )}
    </div>
  )
}

function JanelaDesativar({
  membro,
  aoFechar,
  aoSalvar,
}: {
  membro: Membro
  aoFechar: () => void
  aoSalvar: (m: Membro) => void
}) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await alterarMembro(membro.id, false))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível desativar agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={`Desativar ${membro.usuario.nome}?`}
      salvando={salvando}
      erro={erro}
      rotuloConfirmar="Desativar"
      rotuloSalvando="Desativando..."
      perigo
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <ul className="janela__lista">
        <li>A pessoa perde o acesso e sai da conta em todos os aparelhos.</li>
        {membro.papel === 'COLETOR' && (
          <li>As coletas agendadas com ela ficam sem coletor: defina outro em cada pedido.</li>
        )}
        <li>Dá para reativar depois.</li>
      </ul>
    </Janela>
  )
}
