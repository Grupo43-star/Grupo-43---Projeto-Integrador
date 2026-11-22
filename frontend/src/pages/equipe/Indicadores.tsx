import { useSearchParams } from 'react-router-dom'
import { ChartColumn } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { Carregando, ErroComTentar } from '../../components/Painel'
import { useAuth } from '../../context/useAuth'
import { useConsulta } from '../../hooks/useConsulta'
import { listarRegioes } from '../../services/calendario'
import { buscarIndicadores, type EscopoIndicadores, type FiltrosIndicadores } from '../../services/indicadores'
import { rotulosStatus, type StatusPedido } from '../../services/pedidos'
import { rotuloQuantidade } from '../../utils/pedido'
import './equipe.css'

const DATA = /^\d{4}-\d{2}-\d{2}$/
const ORDEM_STATUS: StatusPedido[] = ['SOLICITADA', 'EM_ANALISE', 'AGENDADA', 'EM_ROTA', 'CONCLUIDA', 'CANCELADA', 'RECUSADA']
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** 30,5 horas -> "1 dia e 6 h"; 5,2 -> "5,2 h"; null -> "-" */
function duracao(horas: number | null) {
  if (horas === null) return '-'
  if (horas < 24) return `${numero.format(horas)} h`
  const dias = Math.floor(horas / 24)
  const resto = Math.round(horas - dias * 24)
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}${resto ? ` e ${resto} h` : ''}`
}

// Indicadores dos atendimentos: GET /cooperative/dashboard (gestão) ou GET /admin/dashboard
// (admin e educador, com o uso do guia). Filtros de período e região na URL.
export default function Indicadores({ escopo }: { escopo: EscopoIndicadores }) {
  const { usuario } = useAuth()
  const [busca, setBusca] = useSearchParams()
  const data = (chave: string) => (DATA.test(busca.get(chave) ?? '') ? (busca.get(chave) as string) : '')
  const filtros: FiltrosIndicadores = { de: data('de'), ate: data('ate'), regiaoId: busca.get('regiao') ?? '' }
  const regioes = useConsulta('regioes', () => listarRegioes())
  const indicadores = useConsulta(`${escopo}|${JSON.stringify(filtros)}`, (s) => buscarIndicadores(escopo, filtros, s))
  const filtrando = Boolean(filtros.de || filtros.ate || filtros.regiaoId)

  function alterar(parcial: Partial<FiltrosIndicadores>) {
    const novos = { ...filtros, ...parcial }
    const proxima = new URLSearchParams()
    if (novos.de) proxima.set('de', novos.de)
    if (novos.ate) proxima.set('ate', novos.ate)
    if (novos.regiaoId) proxima.set('regiao', novos.regiaoId)
    setBusca(proxima, { replace: true })
  }

  const d = indicadores.dados
  const maiorStatus = d ? Math.max(1, ...ORDEM_STATUS.map((s) => d.pedidos.porStatus[s] ?? 0)) : 1
  const maiorVisto = d?.guia ? Math.max(1, ...d.guia.maisVistos.map((m) => m.vezes)) : 1

  return (
    <div className="page page--larga">
      <PageHeader
        eyebrow={escopo === 'cooperativa' ? (usuario?.cooperativa?.nome ?? 'Cooperativa') : 'Plataforma'}
        titulo="Indicadores"
        descricao={
          escopo === 'cooperativa'
            ? 'Como andam os atendimentos da cooperativa: volume, prazos e o que foi recolhido.'
            : 'Números de toda a plataforma, sem dados pessoais: pedidos, prazos, materiais recolhidos e uso do guia.'
        }
        icon={ChartColumn}
      />

      <section className="card painel__filtros" aria-label="Filtros">
        <div className="painel__campos painel__campos--3">
          <label className="campo">
            <span className="campo__rotulo">Pedidos enviados a partir de</span>
            <input type="date" className="input" value={filtros.de} max={filtros.ate || undefined} onChange={(e) => alterar({ de: e.target.value })} />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Até</span>
            <input type="date" className="input" value={filtros.ate} min={filtros.de || undefined} onChange={(e) => alterar({ ate: e.target.value })} />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Região</span>
            <select className="input" value={filtros.regiaoId} disabled={!regioes.dados} onChange={(e) => alterar({ regiaoId: e.target.value })}>
              <option value="">Todas</option>
              {regioes.dados?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome} ({r.cidade}/{r.uf})
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="resumo-filtros">
        <span>{filtrando ? 'Período e região escolhidos.' : 'Desde o início, todas as regiões.'}</span>
        {filtrando && (
          <button type="button" className="resumo-filtros__limpar" onClick={() => setBusca(new URLSearchParams(), { replace: true })}>
            Limpar filtros
          </button>
        )}
      </div>

      {indicadores.erro ? (
        <ErroComTentar erro={indicadores.erro} titulo="Não foi possível carregar os indicadores agora." aoTentar={indicadores.recarregar} />
      ) : !d ? (
        <Carregando texto="Calculando os indicadores..." />
      ) : (
        <div className={`indicadores ${indicadores.carregando ? 'painel__lista--atualizando' : ''}`}>
          <dl className="numeros">
            <div className="numero">
              <dt>Pedidos</dt>
              <dd>{d.pedidos.total}</dd>
            </div>
            <div className="numero">
              <dt>Em aberto</dt>
              <dd>{d.pedidos.abertos}</dd>
            </div>
            <div className="numero">
              <dt>Concluídos</dt>
              <dd>{d.pedidos.concluidos}</dd>
              <span>{d.pedidos.taxaConclusao === null ? 'Sem pedidos no período' : `${numero.format(d.pedidos.taxaConclusao)}% do total`}</span>
            </div>
            <div className="numero">
              <dt>Não concluídos</dt>
              <dd>{d.pedidos.naoConcluidos}</dd>
              <span>
                {d.pedidos.cancelados} {d.pedidos.cancelados === 1 ? 'cancelado' : 'cancelados'} · {d.pedidos.recusados}{' '}
                {d.pedidos.recusados === 1 ? 'recusado' : 'recusados'}
              </span>
            </div>
            <div className={`numero ${d.pedidos.atrasadosAgora > 0 ? 'numero--alerta' : ''}`}>
              <dt>Atrasados agora</dt>
              <dd>{d.pedidos.atrasadosAgora}</dd>
              <span>Não depende do período</span>
            </div>
          </dl>

          <div className="indicadores__grade">
            <section className="card indicadores__bloco" aria-labelledby="t-status">
              <h2 id="t-status" className="detalhe__titulo">
                Pedidos por situação
              </h2>
              <ul className="barras">
                {ORDEM_STATUS.map((s) => {
                  const valor = d.pedidos.porStatus[s] ?? 0
                  return (
                    <li key={s} className="barras__item" title={`${rotulosStatus[s]}: ${valor}`}>
                      <span className="barras__rotulo">{rotulosStatus[s]}</span>
                      <span className="barras__trilho" aria-hidden="true">
                        {valor > 0 && <span className="barras__barra" style={{ width: `${(valor / maiorStatus) * 100}%` }} />}
                      </span>
                      <span className="barras__valor">{valor}</span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="card indicadores__bloco" aria-labelledby="t-tempos">
              <h2 id="t-tempos" className="detalhe__titulo">
                Tempos médios
              </h2>
              <dl className="tempos">
                <div>
                  <dt>Do pedido até a confirmação</dt>
                  <dd>{duracao(d.horasMedias.ateConfirmar)}</dd>
                </div>
                <div>
                  <dt>Da confirmação até a coleta</dt>
                  <dd>{duracao(d.horasMedias.confirmacaoAteConcluir)}</dd>
                </div>
                <div>
                  <dt>Do pedido até a coleta</dt>
                  <dd>{duracao(d.horasMedias.ateConcluir)}</dd>
                </div>
              </dl>
              <p className="texto-nota">"-" quando ainda não há pedidos confirmados ou concluídos no período.</p>
            </section>
          </div>

          <section className="card indicadores__bloco" aria-labelledby="t-regioes">
            <h2 id="t-regioes" className="detalhe__titulo">
              Por região
            </h2>
            {d.porRegiao.length === 0 ? (
              <p className="texto-suave">Nenhum pedido no período.</p>
            ) : (
              <div className="tabela__rolagem">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th scope="col">Região</th>
                      <th scope="col" className="tabela__num">Pedidos</th>
                      <th scope="col" className="tabela__num">Em aberto</th>
                      <th scope="col" className="tabela__num">Concluídos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.porRegiao.map((r) => (
                      <tr key={r.regiaoId}>
                        <th scope="row">{r.nome}</th>
                        <td className="tabela__num">{r.total}</td>
                        <td className="tabela__num">{r.abertos}</td>
                        <td className="tabela__num">{r.concluidos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card indicadores__bloco" aria-labelledby="t-materiais">
            <h2 id="t-materiais" className="detalhe__titulo">
              Materiais recolhidos
            </h2>
            {d.materiaisRecolhidos.length === 0 ? (
              <p className="texto-suave">Nenhuma coleta concluída no período.</p>
            ) : (
              <div className="tabela__rolagem">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th scope="col">Material</th>
                      <th scope="col" className="tabela__num">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.materiaisRecolhidos.map((m) => (
                      <tr key={`${m.categoriaId}-${m.unidade}`}>
                        <th scope="row">{m.nome}</th>
                        <td className="tabela__num">{rotuloQuantidade(m.quantidade, m.unidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="texto-nota">Cada unidade (sacos, kg, caixas, unidades) aparece separada: elas não são somadas entre si.</p>
          </section>

          {d.guia && (
            <section className="card indicadores__bloco" aria-labelledby="t-guia">
              <h2 id="t-guia" className="detalhe__titulo">
                Uso do guia de materiais
              </h2>
              <p>
                <strong className="indicadores__destaque">{d.guia.visualizacoes}</strong>{' '}
                {d.guia.visualizacoes === 1 ? 'consulta' : 'consultas'} a materiais no período.
              </p>
              {d.guia.maisVistos.length > 0 && (
                <>
                  <h3 className="detalhe__subtitulo">Mais consultados</h3>
                  <ul className="barras">
                    {d.guia.maisVistos.map((m) => (
                      <li key={m.materialId} className="barras__item" title={`${m.nome}: ${m.vezes}`}>
                        <span className="barras__rotulo">{m.nome}</span>
                        <span className="barras__trilho" aria-hidden="true">
                          <span className="barras__barra" style={{ width: `${(m.vezes / maiorVisto) * 100}%` }} />
                        </span>
                        <span className="barras__valor">{m.vezes}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
