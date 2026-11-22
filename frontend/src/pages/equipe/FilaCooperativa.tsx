import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardList, Inbox, LoaderCircle, Search } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { CartaoPedidoEquipe, ErroComTentar } from '../../components/Painel'
import { useAuth } from '../../context/useAuth'
import { useConsulta } from '../../hooks/useConsulta'
import { mensagemDeErro } from '../../services/api'
import { listarRegioes } from '../../services/calendario'
import {
  contarFila,
  filtrosFilaVazios,
  listarFila,
  listarMembros,
  POR_PAGINA_FILA,
  type FiltrosFila,
  type PedidoEquipe,
} from '../../services/equipe'
import { listarCategorias } from '../../services/materiais'
import { rotulosStatus, type StatusPedido } from '../../services/pedidos'
import '../solicitacoes.css' // .pedido__status, .pedido__materiais
import './equipe.css'

const STATUS: StatusPedido[] = ['SOLICITADA', 'EM_ANALISE', 'AGENDADA', 'EM_ROTA', 'CONCLUIDA', 'CANCELADA', 'RECUSADA']
const DATA = /^\d{4}-\d{2}-\d{2}$/

/** Atalhos do topo: a fila de trabalho do dia a dia */
const ATALHOS: { rotulo: string; status?: StatusPedido; atrasados?: boolean }[] = [
  { rotulo: 'Novos', status: 'SOLICITADA' },
  { rotulo: 'Em análise', status: 'EM_ANALISE' },
  { rotulo: 'Agendados', status: 'AGENDADA' },
  { rotulo: 'A caminho', status: 'EM_ROTA' },
  { rotulo: 'Atrasados', atrasados: true },
]

/** Filtros na URL: /cooperativa/pedidos?status=SOLICITADA&atrasados=1 (inválidos são ignorados) */
function lerFiltros(busca: URLSearchParams): FiltrosFila {
  const status = busca.get('status') ?? ''
  const data = (chave: string) => {
    const valor = busca.get(chave) ?? ''
    return DATA.test(valor) ? valor : ''
  }
  return {
    status: STATUS.includes(status as StatusPedido) ? (status as StatusPedido) : '',
    regiaoId: busca.get('regiao') ?? '',
    categoriaId: busca.get('material') ?? '',
    coletorId: busca.get('coletor') ?? '',
    de: data('de'),
    ate: data('ate'),
    agendadoPara: data('agendado'),
    atrasados: busca.get('atrasados') === '1',
    protocolo: (busca.get('protocolo') ?? '').slice(0, 40),
  }
}

const CHAVES_URL: Record<keyof FiltrosFila, string> = {
  status: 'status',
  regiaoId: 'regiao',
  categoriaId: 'material',
  coletorId: 'coletor',
  de: 'de',
  ate: 'ate',
  agendadoPara: 'agendado',
  atrasados: 'atrasados',
  protocolo: 'protocolo',
}

// Fila de pedidos da cooperativa (GET /cooperative/pickup-requests): os pedidos dela e os novos
// das regiões que ela atende. Filtros na URL, atalhos com contagem e "Carregar mais".
export default function FilaCooperativa() {
  const { usuario } = useAuth()
  const [busca, setBusca] = useSearchParams()
  const filtros = lerFiltros(busca)
  const chave = JSON.stringify(filtros)

  // Protocolo: espera parar de digitar antes de consultar
  const [protocolo, setProtocolo] = useState(filtros.protocolo)
  useEffect(() => {
    if (protocolo.trim() === filtros.protocolo) return
    const espera = setTimeout(() => alterar({ protocolo: protocolo.trim() }), 350)
    return () => clearTimeout(espera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolo])

  const categorias = useConsulta('categorias', (s) => listarCategorias(s))
  const regioes = useConsulta('regioes', () => listarRegioes())
  const membros = useConsulta('membros', (s) => listarMembros(s))
  const coletores = (membros.dados ?? []).filter((m) => m.papel === 'COLETOR')

  const contagens = useConsulta(`contagens|${usuario?.id}`, (s) =>
    Promise.all(ATALHOS.map((a) => contarFila({ status: a.status, atrasados: a.atrasados }, s))),
  )
  const fila = useConsulta(`fila|${chave}`, (s) => listarFila(filtros, 1, s))

  // "Carregar mais": páginas seguintes desta mesma consulta
  const [mais, setMais] = useState<{ chave: string; itens: PedidoEquipe[]; pagina: number } | null>(null)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erroMais, setErroMais] = useState<{ chave: string; mensagem: string } | null>(null)
  const extras = mais?.chave === chave ? mais : null
  const itens = [...(fila.dados?.items ?? []), ...(extras?.itens ?? [])]
  const total = fila.dados?.total ?? 0

  async function carregarMais() {
    const pagina = (extras?.pagina ?? 1) + 1
    setCarregandoMais(true)
    setErroMais(null)
    try {
      const resposta = await listarFila(filtros, pagina)
      setMais({ chave, itens: [...(extras?.itens ?? []), ...resposta.items], pagina })
    } catch (erro) {
      setErroMais({ chave, mensagem: mensagemDeErro(erro) })
    } finally {
      setCarregandoMais(false)
    }
  }

  function alterar(parcial: Partial<FiltrosFila>) {
    const novos = { ...filtros, ...parcial }
    const proxima = new URLSearchParams()
    for (const [campo, chaveUrl] of Object.entries(CHAVES_URL) as [keyof FiltrosFila, string][]) {
      const valor = novos[campo]
      if (valor === true) proxima.set(chaveUrl, '1')
      else if (typeof valor === 'string' && valor) proxima.set(chaveUrl, valor)
    }
    setBusca(proxima, { replace: true })
  }

  function limpar() {
    setProtocolo('')
    setBusca(new URLSearchParams(), { replace: true })
  }

  const filtrando = JSON.stringify(filtros) !== JSON.stringify(filtrosFilaVazios)
  const atalhoAtivo = (a: (typeof ATALHOS)[number]) =>
    a.atrasados
      ? filtros.atrasados && !filtros.status
      : filtros.status === a.status && !filtros.atrasados

  return (
    <div className="page page--larga">
      <PageHeader
        eyebrow={usuario?.cooperativa?.nome ?? 'Cooperativa'}
        titulo="Pedidos de retirada"
        descricao="Os pedidos da sua cooperativa e os novos das regiões que ela atende. Assuma, agende e acompanhe cada coleta."
        icon={ClipboardList}
      />

      <div className="painel__atalhos" role="group" aria-label="Atalhos da fila">
        {ATALHOS.map((a, i) => (
          <button
            key={a.rotulo}
            type="button"
            className={`painel__atalho ${atalhoAtivo(a) ? 'painel__atalho--ativo' : ''} ${
              a.atrasados ? 'painel__atalho--alerta' : ''
            }`}
            aria-pressed={atalhoAtivo(a)}
            onClick={() =>
              atalhoAtivo(a)
                ? alterar({ status: '', atrasados: false })
                : alterar({ status: a.status ?? '', atrasados: a.atrasados ?? false })
            }
          >
            <strong>{contagens.dados ? contagens.dados[i] : '-'}</strong>
            <span>{a.rotulo}</span>
          </button>
        ))}
      </div>

      <section className="card painel__filtros" aria-label="Filtros">
        <div className="painel__campos">
          <label className="campo">
            <span className="campo__rotulo">Protocolo</span>
            <span className="input-com-icone">
              <Search size={16} className="input-com-icone__icone" aria-hidden="true" />
              <input
                className="input"
                placeholder="Ex.: RB-2026-000012"
                maxLength={40}
                value={protocolo}
                onChange={(e) => setProtocolo(e.target.value)}
              />
            </span>
          </label>
          <label className="campo">
            <span className="campo__rotulo">Status</span>
            <select
              className="input"
              value={filtros.status}
              onChange={(e) => alterar({ status: e.target.value as StatusPedido | '' })}
            >
              <option value="">Todos</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {rotulosStatus[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span className="campo__rotulo">Região</span>
            <select
              className="input"
              value={filtros.regiaoId}
              disabled={!regioes.dados}
              onChange={(e) => alterar({ regiaoId: e.target.value })}
            >
              <option value="">Todas</option>
              {regioes.dados?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome} ({r.cidade}/{r.uf})
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span className="campo__rotulo">Material</span>
            <select
              className="input"
              value={filtros.categoriaId}
              disabled={!categorias.dados}
              onChange={(e) => alterar({ categoriaId: e.target.value })}
            >
              <option value="">Todos</option>
              {categorias.dados?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span className="campo__rotulo">Coletor</span>
            <select
              className="input"
              value={filtros.coletorId}
              disabled={!membros.dados}
              onChange={(e) => alterar({ coletorId: e.target.value })}
            >
              <option value="">Todos</option>
              {coletores.map((m) => (
                <option key={m.usuario.id} value={m.usuario.id}>
                  {m.usuario.nome}
                  {m.ativo ? '' : ' (inativo)'}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span className="campo__rotulo">Enviados a partir de</span>
            <input
              type="date"
              className="input"
              value={filtros.de}
              max={filtros.ate || undefined}
              onChange={(e) => alterar({ de: e.target.value })}
            />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Enviados até</span>
            <input
              type="date"
              className="input"
              value={filtros.ate}
              min={filtros.de || undefined}
              onChange={(e) => alterar({ ate: e.target.value })}
            />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Agendados para</span>
            <input
              type="date"
              className="input"
              value={filtros.agendadoPara}
              onChange={(e) => alterar({ agendadoPara: e.target.value })}
            />
          </label>
        </div>
        <label className="caixa painel__caixa">
          <input
            type="checkbox"
            checked={filtros.atrasados}
            onChange={(e) => alterar({ atrasados: e.target.checked })}
          />
          <span>Só pedidos atrasados (sem data depois do prazo de análise, ou com a data agendada vencida)</span>
        </label>
      </section>

      {Boolean(categorias.erro || regioes.erro || membros.erro) && (
        <p className="alerta alerta--info painel__erro">
          Alguns filtros não puderam ser carregados. A lista continua funcionando.
        </p>
      )}

      {fila.erro ? (
        <ErroComTentar erro={fila.erro} titulo="Não foi possível carregar os pedidos agora." aoTentar={fila.recarregar} />
      ) : (
        <>
          <div className="resumo-filtros">
            <span aria-live="polite">
              {fila.dados
                ? `${total} ${total === 1 ? 'pedido' : 'pedidos'}${filtrando ? ' com estes filtros' : ''}`
                : 'Carregando os pedidos...'}
            </span>
            {filtrando && (
              <button type="button" className="resumo-filtros__limpar" onClick={limpar}>
                Limpar filtros
              </button>
            )}
          </div>

          {fila.dados && itens.length === 0 ? (
            <div className="card painel__vazio">
              <span className="icon-circle">
                <Inbox size={20} strokeWidth={1.75} />
              </span>
              <h2 className="card__titulo">
                {filtrando ? 'Nenhum pedido com estes filtros.' : 'Nenhum pedido por aqui ainda.'}
              </h2>
              <p className="texto-suave">
                {filtrando
                  ? 'Tente tirar algum filtro.'
                  : 'Quando alguém pedir uma retirada numa região da cooperativa, o pedido aparece aqui.'}
              </p>
            </div>
          ) : !fila.dados ? (
            <div className="card painel__vazio" aria-busy="true">
              <LoaderCircle size={22} className="girando" aria-hidden="true" />
            </div>
          ) : (
            <ul className={`painel__lista ${fila.carregando ? 'painel__lista--atualizando' : ''}`}>
              {itens.map((p) => (
                <CartaoPedidoEquipe key={p.id} pedido={p} link={`/cooperativa/pedidos/${p.id}`} />
              ))}
            </ul>
          )}

          {fila.dados && itens.length < total && !fila.carregando && (
            <div className="painel__mais">
              <button type="button" className="btn btn--contorno" onClick={carregarMais} disabled={carregandoMais}>
                {carregandoMais && <LoaderCircle size={16} className="girando" />}
                Carregar mais pedidos ({Math.min(POR_PAGINA_FILA, total - itens.length)})
              </button>
              {erroMais?.chave === chave && (
                <p className="campo__erro" role="alert">
                  {erroMais.mensagem}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
