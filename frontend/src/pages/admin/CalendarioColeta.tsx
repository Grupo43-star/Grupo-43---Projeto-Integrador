import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCog, CalendarX, Check, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import Janela from '../../components/Janela'
import PageHeader from '../../components/PageHeader'
import { Carregando, ErroComTentar } from '../../components/Painel'
import { useConsulta } from '../../hooks/useConsulta'
import {
  buscarCalendarioDaRegiao,
  criarExcecao,
  excluirColetaSemanal,
  excluirExcecao,
  LIMITES_CALENDARIO,
  listarRegioesAdmin,
  salvarColetaSemanal,
  type ColetaSemanalAdmin,
} from '../../services/admin'
import { mensagemDeErro } from '../../services/api'
import { listarCategorias } from '../../services/materiais'
import { rotulosPeriodo, type PeriodoRetirada } from '../../services/pedidos'
import { diasSemana, ordemSemana } from '../../utils/agenda'
import { propsCategoria } from '../../utils/corCategoria'
import { dataDeIso, dataPorExtenso, isoDeData } from '../../utils/formatar'
import '../equipe/equipe.css'

const ordemPeriodo: Record<PeriodoRetirada, number> = { MANHA: 0, TARDE: 1, NOITE: 2 }

// Calendário de coleta seletiva de cada região (só admin):
//   GET /regions/:id/schedule, POST/PATCH/DELETE /admin/schedules, POST/DELETE /admin/schedule-exceptions
// Região escolhida na URL (?regiao=<id>).
export default function CalendarioColeta() {
  const [busca, setBusca] = useSearchParams()
  const regioes = useConsulta('regioes-admin', (s) => listarRegioesAdmin(s))
  const regiaoId = busca.get('regiao') || regioes.dados?.[0]?.id || ''
  const regiao = regioes.dados?.find((r) => r.id === regiaoId) ?? null
  const calendario = useConsulta(regiao ? `calendario|${regiaoId}` : null, (s) => buscarCalendarioDaRegiao(regiaoId, s))
  const [editando, setEditando] = useState<ColetaSemanalAdmin | 'nova' | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [erroAcao, setErroAcao] = useState('')
  const [hoje] = useState(() => isoDeData(new Date()))

  // Dia sem coleta (formulário na própria página)
  const [data, setData] = useState('')
  const [motivo, setMotivo] = useState('')
  const [errosExcecao, setErrosExcecao] = useState<{ data?: string; motivo?: string }>({})

  const semanal = [...(calendario.dados?.semanal ?? [])].sort(
    (a, b) => ordemSemana.indexOf(a.dia) - ordemSemana.indexOf(b.dia) || ordemPeriodo[a.periodo] - ordemPeriodo[b.periodo],
  )

  async function executar(chave: string, acao: () => Promise<void>, mensagem: string) {
    setOcupado(chave)
    setAviso('')
    setErroAcao('')
    try {
      await acao()
      setAviso(mensagem)
      calendario.recarregar()
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro))
    } finally {
      setOcupado(null)
      setExcluindo(null)
    }
  }

  function adicionarExcecao(evento: FormEvent) {
    evento.preventDefault()
    const novos: typeof errosExcecao = {}
    if (!data) novos.data = 'Escolha a data.'
    else if (data < hoje) novos.data = 'Escolha uma data a partir de hoje.'
    if (motivo.trim().length < 2) novos.motivo = 'Informe o motivo (ex.: Feriado).'
    setErrosExcecao(novos)
    if (Object.keys(novos).length > 0) return
    void executar(
      'excecao',
      async () => {
        await criarExcecao(regiaoId, data, motivo)
        setData('')
        setMotivo('')
      },
      'Dia sem coleta adicionado. Ele aparece no calendário público.',
    )
  }

  return (
    <div className="page page--larga">
      <PageHeader
        eyebrow="Administração"
        titulo="Calendário de coleta"
        descricao="Os dias em que a coleta seletiva passa em cada região e os dias sem coleta (feriados). É o que aparece na tela Calendário."
        icon={CalendarCog}
      />

      {regioes.erro ? (
        <ErroComTentar erro={regioes.erro} titulo="Não foi possível carregar as regiões agora." aoTentar={regioes.recarregar} />
      ) : !regioes.dados ? (
        <Carregando />
      ) : regioes.dados.length === 0 ? (
        <p className="alerta alerta--info">Cadastre uma região antes de montar o calendário.</p>
      ) : (
        <>
          <section className="card painel__filtros" aria-label="Região">
            <label className="campo painel__campo-curto">
              <span className="campo__rotulo">Região</span>
              <select
                className="input"
                value={regiaoId}
                onChange={(e) => {
                  setAviso('')
                  setErroAcao('')
                  setBusca({ regiao: e.target.value }, { replace: true })
                }}
              >
                {regioes.dados.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome} ({r.cidade}/{r.uf}){r.ativa ? '' : ' - inativa'}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {aviso && (
            <p className="alerta alerta--sucesso painel__erro" role="status">
              <Check size={16} aria-hidden="true" /> {aviso}
            </p>
          )}
          {erroAcao && (
            <p className="alerta alerta--erro painel__erro" role="alert">
              {erroAcao}
            </p>
          )}

          {!regiao ? (
            <p className="alerta alerta--info">Região não encontrada. Escolha outra na lista.</p>
          ) : calendario.erro ? (
            <ErroComTentar erro={calendario.erro} titulo="Não foi possível carregar o calendário agora." aoTentar={calendario.recarregar} />
          ) : !calendario.dados ? (
            <Carregando />
          ) : (
            <div className={calendario.carregando ? 'painel__lista--atualizando' : ''}>
              <section className="painel__grupo" aria-labelledby="t-semana">
                <div className="painel__barra">
                  <h2 id="t-semana" className="painel__grupo-titulo">
                    Toda semana
                  </h2>
                  <button type="button" className="btn btn--primario btn--pequeno" onClick={() => setEditando('nova')}>
                    <Plus size={14} /> Adicionar dia de coleta
                  </button>
                </div>
                {semanal.length === 0 ? (
                  <p className="texto-suave">Nenhum dia de coleta nesta região ainda.</p>
                ) : (
                  <ul className="painel__lista">
                    {semanal.map((c) => (
                      <li key={c.id} className="card coleta-admin">
                        <div className="coleta-admin__dia">
                          <strong>{diasSemana[c.dia]}</strong>
                          <span>{rotulosPeriodo[c.periodo]}</span>
                        </div>
                        <div className="coleta-admin__info">
                          <ul className="pedido__materiais" aria-label="Materiais recolhidos">
                            {c.categorias.map((cat) => (
                              <li key={cat.id} {...propsCategoria(cat, 'tag')}>
                                {cat.nome}
                              </li>
                            ))}
                          </ul>
                          {c.observacao && <p className="texto-suave">{c.observacao}</p>}
                        </div>
                        <div className="coleta-admin__acoes">
                          {excluindo === c.id ? (
                            <span className="pedido__confirmar">
                              <span>Excluir este dia?</span>
                              <button
                                type="button"
                                className="btn btn--perigo btn--pequeno"
                                disabled={ocupado !== null}
                                onClick={() =>
                                  executar(c.id, () => excluirColetaSemanal(c.id), `${diasSemana[c.dia]} saiu do calendário.`)
                                }
                              >
                                {ocupado === c.id && <LoaderCircle size={14} className="girando" />} Excluir
                              </button>
                              <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setExcluindo(null)}>
                                Manter
                              </button>
                            </span>
                          ) : (
                            <>
                              <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setEditando(c)}>
                                <Pencil size={14} /> Editar
                              </button>
                              <button type="button" className="btn btn--texto-perigo btn--pequeno" onClick={() => setExcluindo(c.id)}>
                                <Trash2 size={14} /> Excluir
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="painel__grupo" aria-labelledby="t-excecoes">
                <h2 id="t-excecoes" className="painel__grupo-titulo">
                  Dias sem coleta
                </h2>
                <form className="card excecao-form" onSubmit={adicionarExcecao} noValidate>
                  <label className="campo">
                    <span className="campo__rotulo campo__rotulo--obrigatorio">Data</span>
                    <input
                      type="date"
                      className={`input ${errosExcecao.data ? 'input--erro' : ''}`}
                      min={hoje}
                      value={data}
                      onChange={(e) => {
                        setData(e.target.value)
                        setErrosExcecao((x) => ({ ...x, data: undefined }))
                      }}
                    />
                    {errosExcecao.data && <span className="campo__erro">{errosExcecao.data}</span>}
                  </label>
                  <label className="campo">
                    <span className="campo__rotulo campo__rotulo--obrigatorio">Motivo</span>
                    <input
                      className={`input ${errosExcecao.motivo ? 'input--erro' : ''}`}
                      maxLength={LIMITES_CALENDARIO.motivo}
                      placeholder="Ex.: Feriado de Natal"
                      value={motivo}
                      onChange={(e) => {
                        setMotivo(e.target.value)
                        setErrosExcecao((x) => ({ ...x, motivo: undefined }))
                      }}
                    />
                    {errosExcecao.motivo && <span className="campo__erro">{errosExcecao.motivo}</span>}
                  </label>
                  <button className="btn btn--primario" disabled={ocupado !== null}>
                    {ocupado === 'excecao' ? <LoaderCircle size={16} className="girando" /> : <CalendarX size={16} />} Adicionar
                  </button>
                </form>
                {calendario.dados.excecoes.length === 0 ? (
                  <p className="texto-suave">Nenhum dia sem coleta previsto.</p>
                ) : (
                  <ul className="painel__lista">
                    {calendario.dados.excecoes.map((e) => (
                      <li key={e.id} className="card excecao">
                        <div>
                          <strong>{dataPorExtenso(dataDeIso(e.data))}</strong>
                          <p className="texto-suave">{e.motivo}</p>
                        </div>
                        {excluindo === e.id ? (
                          <span className="pedido__confirmar">
                            <span>Excluir?</span>
                            <button
                              type="button"
                              className="btn btn--perigo btn--pequeno"
                              disabled={ocupado !== null}
                              onClick={() => executar(e.id, () => excluirExcecao(e.id), 'Dia sem coleta excluído.')}
                            >
                              {ocupado === e.id && <LoaderCircle size={14} className="girando" />} Excluir
                            </button>
                            <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setExcluindo(null)}>
                              Manter
                            </button>
                          </span>
                        ) : (
                          <button type="button" className="btn btn--texto-perigo btn--pequeno" onClick={() => setExcluindo(e.id)}>
                            <Trash2 size={14} /> Excluir
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="texto-nota">Só aparecem os dias de hoje em diante.</p>
              </section>
            </div>
          )}
        </>
      )}

      {editando && regiao && (
        <JanelaColeta
          regiaoId={regiao.id}
          original={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(c) => {
            setAviso(`${diasSemana[c.dia]} (${rotulosPeriodo[c.periodo].toLowerCase()}) salvo no calendário.`)
            setEditando(null)
            calendario.recarregar()
          }}
        />
      )}
    </div>
  )
}

function JanelaColeta({
  regiaoId,
  original,
  aoFechar,
  aoSalvar,
}: {
  regiaoId: string
  original: ColetaSemanalAdmin | null
  aoFechar: () => void
  aoSalvar: (c: ColetaSemanalAdmin) => void
}) {
  const categorias = useConsulta('categorias', (s) => listarCategorias(s))
  const [dia, setDia] = useState(original?.dia ?? 1)
  const [periodo, setPeriodo] = useState<PeriodoRetirada>(original?.periodo ?? 'MANHA')
  const [categoriaIds, setCategoriaIds] = useState<string[]>(original?.categorias.map((c) => c.id) ?? [])
  const [observacao, setObservacao] = useState(original?.observacao ?? '')
  const [erroCategorias, setErroCategorias] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    if (categoriaIds.length === 0) {
      setErroCategorias('Marque ao menos um material recolhido neste dia.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await salvarColetaSemanal(regiaoId, { dia, periodo, categoriaIds, observacao }, original?.id ?? null))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível salvar agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={original ? 'Editar dia de coleta' : 'Novo dia de coleta'}
      salvando={salvando}
      erro={erro}
      rotuloConfirmar="Salvar"
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <div className="janela__campos">
        <label className="campo">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Dia da semana</span>
          <select className="input" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            {ordemSemana.map((d) => (
              <option key={d} value={d}>
                {diasSemana[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Período</span>
          <select className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoRetirada)}>
            {(Object.keys(rotulosPeriodo) as PeriodoRetirada[]).map((p) => (
              <option key={p} value={p}>
                {rotulosPeriodo[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="grupo-opcoes">
        <legend className="campo__rotulo campo__rotulo--obrigatorio">Materiais recolhidos</legend>
        {categorias.erro ? (
          <span className="campo__erro">A lista de materiais não pôde ser carregada. {mensagemDeErro(categorias.erro)}</span>
        ) : !categorias.dados ? (
          <span className="texto-suave">Carregando...</span>
        ) : (
          <div className="lista-checks">
            {categorias.dados.map((c) => (
              <label key={c.id} className="caixa">
                <input
                  type="checkbox"
                  checked={categoriaIds.includes(c.id)}
                  onChange={(e) => {
                    setErroCategorias('')
                    setCategoriaIds((atual) => (e.target.checked ? [...atual, c.id] : atual.filter((x) => x !== c.id)))
                  }}
                />
                <span>{c.nome}</span>
              </label>
            ))}
          </div>
        )}
        {erroCategorias && <span className="campo__erro">{erroCategorias}</span>}
      </fieldset>
      <label className="campo">
        <span className="campo__rotulo">Observação</span>
        <input
          className="input"
          maxLength={LIMITES_CALENDARIO.observacao}
          placeholder="Ex.: Deixe os sacos na calçada até as 7h."
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </label>
    </Janela>
  )
}
