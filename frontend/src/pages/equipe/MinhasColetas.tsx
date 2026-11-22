import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, LoaderCircle, Play, Truck } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { CartaoPedidoEquipe, Carregando, ErroComTentar, Vazio } from '../../components/Painel'
import { useAuth } from '../../context/useAuth'
import { useConsulta } from '../../hooks/useConsulta'
import { mensagemDeErro } from '../../services/api'
import { iniciarRota, listarColetas, type PedidoEquipe } from '../../services/equipe'
import { dataDeIso, dataPorExtenso, isoDeData, somarDias } from '../../utils/formatar'
import '../solicitacoes.css'
import './equipe.css'

const DATA = /^\d{4}-\d{2}-\d{2}$/

// Coletas do coletor (GET /collector/pickups): sem data, as de hoje e as vencidas; com data
// (?data=AAAA-MM-DD na URL), as daquele dia. Só aparecem as AGENDADA e EM_ROTA dele.
export default function MinhasColetas() {
  const { usuario } = useAuth()
  const [busca, setBusca] = useSearchParams()
  const [hoje] = useState(() => isoDeData(new Date()))
  const amanha = isoDeData(somarDias(dataDeIso(hoje), 1))
  const data = DATA.test(busca.get('data') ?? '') ? (busca.get('data') as string) : ''
  const coletas = useConsulta(`coletas|${data}`, (s) => listarColetas(data, s))
  const [iniciando, setIniciando] = useState<string | null>(null)
  const [erroRota, setErroRota] = useState<{ id: string; mensagem: string } | null>(null)

  function escolher(nova: string) {
    setErroRota(null)
    setBusca(nova ? { data: nova } : {}, { replace: true })
  }

  async function comecar(p: PedidoEquipe) {
    setIniciando(p.id)
    setErroRota(null)
    try {
      await iniciarRota(p.id)
      coletas.recarregar()
    } catch (erro) {
      setErroRota({ id: p.id, mensagem: mensagemDeErro(erro) })
    } finally {
      setIniciando(null)
    }
  }

  const lista = coletas.dados ?? []
  const emRota = lista.filter((p) => p.status === 'EM_ROTA')
  const agendadas = lista.filter((p) => p.status === 'AGENDADA')
  const atrasadas = agendadas.filter((p) => p.dataAgendada && p.dataAgendada < hoje)
  const doDia = agendadas.filter((p) => !atrasadas.includes(p))

  const titulo = !data
    ? 'Hoje e atrasadas'
    : data === hoje
      ? 'Hoje'
      : dataPorExtenso(dataDeIso(data))

  function cartoes(itens: PedidoEquipe[]) {
    return (
      <ul className={`painel__lista ${coletas.carregando ? 'painel__lista--atualizando' : ''}`}>
        {itens.map((p) => (
          <CartaoPedidoEquipe key={p.id} pedido={p} link={`/coletor/coletas/${p.id}`} mostrarColetor={false}>
            {p.status === 'AGENDADA' && p.dataAgendada === hoje && (
              <button
                type="button"
                className="btn btn--primario btn--pequeno"
                disabled={iniciando !== null}
                onClick={() => comecar(p)}
              >
                {iniciando === p.id ? <LoaderCircle size={14} className="girando" /> : <Play size={14} />} Iniciar rota
              </button>
            )}
            {erroRota?.id === p.id && (
              <span className="campo__erro" role="alert">
                {erroRota.mensagem}
              </span>
            )}
          </CartaoPedidoEquipe>
        ))}
      </ul>
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={usuario?.cooperativa?.nome ?? 'Coletas'}
        titulo="Minhas coletas"
        descricao="As coletas agendadas para você. Inicie a rota no dia, registre o que foi recolhido ou que não foi possível coletar."
        icon={Truck}
      />

      <div className="card painel__filtros painel__dia">
        <div className="painel__dias" role="group" aria-label="Dia das coletas">
          <button type="button" className={`painel__chip ${!data ? 'painel__chip--ativo' : ''}`} aria-pressed={!data} onClick={() => escolher('')}>
            Hoje e atrasadas
          </button>
          <button
            type="button"
            className={`painel__chip ${data === amanha ? 'painel__chip--ativo' : ''}`}
            aria-pressed={data === amanha}
            onClick={() => escolher(amanha)}
          >
            Amanhã
          </button>
        </div>
        <label className="campo painel__outro-dia">
          <span className="campo__rotulo">Outro dia</span>
          <input type="date" className="input" value={data} onChange={(e) => escolher(e.target.value)} />
        </label>
      </div>

      <h2 className="titulo-secao painel__titulo-dia">{titulo}</h2>

      {coletas.erro ? (
        <ErroComTentar erro={coletas.erro} titulo="Não foi possível carregar suas coletas agora." aoTentar={coletas.recarregar} />
      ) : !coletas.dados ? (
        <Carregando texto="Carregando suas coletas..." />
      ) : lista.length === 0 ? (
        <Vazio icone={CalendarCheck} titulo={data ? 'Nenhuma coleta neste dia.' : 'Nenhuma coleta para hoje.'}>
          <p className="texto-suave">Quando a cooperativa agendar uma coleta para você, ela aparece aqui e você recebe um aviso.</p>
        </Vazio>
      ) : (
        <>
          {emRota.length > 0 && (
            <section className="painel__grupo" aria-labelledby="g-rota">
              <h3 id="g-rota" className="painel__grupo-titulo">
                A caminho ({emRota.length})
              </h3>
              {cartoes(emRota)}
            </section>
          )}
          {atrasadas.length > 0 && (
            <section className="painel__grupo" aria-labelledby="g-atrasadas">
              <h3 id="g-atrasadas" className="painel__grupo-titulo painel__grupo-titulo--alerta">
                Atrasadas ({atrasadas.length})
              </h3>
              <p className="texto-suave">A data já passou. Peça à gestão da cooperativa para reagendar.</p>
              {cartoes(atrasadas)}
            </section>
          )}
          {doDia.length > 0 && (
            <section className="painel__grupo" aria-labelledby="g-agendadas">
              <h3 id="g-agendadas" className="painel__grupo-titulo">
                Agendadas ({doDia.length})
              </h3>
              {cartoes(doDia)}
            </section>
          )}
        </>
      )}
    </div>
  )
}
