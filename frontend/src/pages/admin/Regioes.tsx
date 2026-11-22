import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCog, Check, LoaderCircle, Map as IconeMapa, Pencil, Plus, Power } from 'lucide-react'
import Janela from '../../components/Janela'
import PageHeader from '../../components/PageHeader'
import { Carregando, ErroComTentar, SeloAtivo, Vazio } from '../../components/Painel'
import { ufs } from '../../data/usuario'
import { useConsulta } from '../../hooks/useConsulta'
import {
  desativarRegiao,
  LIMITES_REGIAO,
  listarRegioesAdmin,
  salvarRegiao,
  type DadosRegiao,
  type RegiaoAdmin,
} from '../../services/admin'
import { mensagemDeErro } from '../../services/api'
import { limparCacheRegioes } from '../../services/calendario'
import '../equipe/equipe.css'

const BAIRROS_VISIVEIS = 8

// Regiões atendidas (GET/POST/PATCH/DELETE /admin/regions): só admin. Os bairros ligam os
// endereços à região; o centro + raio acham a região pelas coordenadas quando o bairro não bate.
export default function Regioes() {
  const regioes = useConsulta('regioes-admin', (s) => listarRegioesAdmin(s))
  const [editando, setEditando] = useState<RegiaoAdmin | 'nova' | null>(null)
  const [alterando, setAlterando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [erroLinha, setErroLinha] = useState<{ id: string; mensagem: string } | null>(null)

  function trocar(regiao: RegiaoAdmin) {
    const lista = regioes.dados ?? []
    const existe = lista.some((r) => r.id === regiao.id)
    regioes.substituir(existe ? lista.map((r) => (r.id === regiao.id ? regiao : r)) : [...lista, regiao])
    limparCacheRegioes()
  }

  async function alternarAtiva(r: RegiaoAdmin) {
    setAlterando(r.id)
    setAviso('')
    setErroLinha(null)
    try {
      if (r.ativa) {
        trocar(await desativarRegiao(r.id))
        setAviso(`Região ${r.nome} desativada. Endereços dela deixam de ser atendidos.`)
      } else {
        trocar(await salvarRegiao({ ...r, ativa: true }, r.id))
        setAviso(`Região ${r.nome} reativada.`)
      }
    } catch (erro) {
      setErroLinha({ id: r.id, mensagem: mensagemDeErro(erro) })
    } finally {
      setAlterando(null)
    }
  }

  return (
    <div className="page page--larga">
      <PageHeader
        eyebrow="Administração"
        titulo="Regiões"
        descricao="Onde a coleta seletiva e as retiradas funcionam. Endereços e pontos entram na região pelo bairro ou pela distância até o centro."
        icon={IconeMapa}
      />

      <div className="painel__barra">
        <p className="texto-suave">{regioes.dados ? `${regioes.dados.length} regiões` : ''}</p>
        <button type="button" className="btn btn--primario" onClick={() => setEditando('nova')}>
          <Plus size={16} /> Nova região
        </button>
      </div>

      {aviso && (
        <p className="alerta alerta--sucesso painel__erro" role="status">
          <Check size={16} aria-hidden="true" /> {aviso}
        </p>
      )}

      {regioes.erro ? (
        <ErroComTentar erro={regioes.erro} titulo="Não foi possível carregar as regiões agora." aoTentar={regioes.recarregar} />
      ) : !regioes.dados ? (
        <Carregando />
      ) : regioes.dados.length === 0 ? (
        <Vazio icone={IconeMapa} titulo="Nenhuma região cadastrada." />
      ) : (
        <ul className="painel__lista painel__lista--2">
          {regioes.dados.map((r) => (
            <li key={r.id} className={`card ponto-gerido ${r.ativa ? '' : 'ponto-gerido--inativo'}`}>
              <div className="ponto-gerido__topo">
                <span className="pontos__tipo">
                  {r.cidade}/{r.uf}
                </span>
                <SeloAtivo ativo={r.ativa} feminino />
              </div>
              <h2 className="card__titulo">{r.nome}</h2>
              {r.bairros.length === 0 ? (
                <p className="texto-suave">Nenhum bairro cadastrado.</p>
              ) : (
                <ul className="regiao-admin__bairros" aria-label="Bairros">
                  {r.bairros.slice(0, BAIRROS_VISIVEIS).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                  {r.bairros.length > BAIRROS_VISIVEIS && <li>+{r.bairros.length - BAIRROS_VISIVEIS}</li>}
                </ul>
              )}
              <p className="texto-nota">
                {r.centroLatitude !== null && r.raioKm !== null
                  ? `Centro em ${r.centroLatitude}, ${r.centroLongitude} · raio de ${r.raioKm} km`
                  : 'Sem centro e raio: só entra quem tem um dos bairros.'}
              </p>
              <div className="ponto-gerido__acoes">
                <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setEditando(r)}>
                  <Pencil size={14} /> Editar
                </button>
                <Link to={`/admin/calendario?regiao=${r.id}`} className="btn btn--contorno btn--pequeno">
                  <CalendarCog size={14} /> Calendário
                </Link>
                <button
                  type="button"
                  className={`btn btn--pequeno ${r.ativa ? 'btn--texto-perigo' : 'btn--contorno'}`}
                  disabled={alterando !== null}
                  onClick={() => alternarAtiva(r)}
                >
                  {alterando === r.id ? <LoaderCircle size={14} className="girando" /> : <Power size={14} />}{' '}
                  {r.ativa ? 'Desativar' : 'Reativar'}
                </button>
              </div>
              {erroLinha?.id === r.id && (
                <p className="campo__erro" role="alert">
                  {erroLinha.mensagem}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <JanelaRegiao
          original={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(r) => {
            setAviso(editando === 'nova' ? `Região ${r.nome} criada.` : `Região ${r.nome} atualizada.`)
            setEditando(null)
            trocar(r)
          }}
        />
      )}
    </div>
  )
}

type Erros = Partial<Record<'nome' | 'cidade' | 'uf' | 'bairros' | 'centro', string>>

const textoNumero = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))
const lerNumero = (texto: string) => (texto.trim() === '' ? null : Number(texto.trim().replace(',', '.')))

function JanelaRegiao({
  original,
  aoFechar,
  aoSalvar,
}: {
  original: RegiaoAdmin | null
  aoFechar: () => void
  aoSalvar: (r: RegiaoAdmin) => void
}) {
  const [nome, setNome] = useState(original?.nome ?? '')
  const [cidade, setCidade] = useState(original?.cidade ?? '')
  const [uf, setUf] = useState(original?.uf ?? '')
  const [bairros, setBairros] = useState(original?.bairros.join('\n') ?? '')
  const [latitude, setLatitude] = useState(textoNumero(original?.centroLatitude ?? null))
  const [longitude, setLongitude] = useState(textoNumero(original?.centroLongitude ?? null))
  const [raio, setRaio] = useState(textoNumero(original?.raioKm ?? null))
  const [ativa, setAtiva] = useState(original?.ativa ?? true)
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    const lista = [...new Set(bairros.split('\n').map((b) => b.trim()).filter(Boolean))]
    const lat = lerNumero(latitude)
    const lng = lerNumero(longitude)
    const km = lerNumero(raio)
    const novos: Erros = {}
    if (nome.trim().length < 2) novos.nome = 'Informe o nome da região.'
    if (cidade.trim().length < 2) novos.cidade = 'Informe a cidade.'
    if (!uf) novos.uf = 'Selecione.'
    if (lista.length > LIMITES_REGIAO.bairros) novos.bairros = `Até ${LIMITES_REGIAO.bairros} bairros.`
    const preenchidos = [lat, lng, km].filter((v) => v !== null).length
    if (preenchidos > 0 && preenchidos < 3) novos.centro = 'Preencha latitude, longitude e raio juntos, ou deixe os três vazios.'
    else if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) novos.centro = 'Latitude entre -90 e 90.'
    else if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) novos.centro = 'Longitude entre -180 e 180.'
    else if (km !== null && (!Number.isFinite(km) || km < 0.1)) novos.centro = 'O raio precisa ser de 0,1 km ou mais.'
    setErros(novos)
    if (Object.keys(novos).length > 0) return
    const dados: DadosRegiao = {
      nome,
      cidade,
      uf,
      bairros: lista,
      centroLatitude: lat,
      centroLongitude: lng,
      raioKm: km,
      ativa,
    }
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await salvarRegiao(dados, original?.id ?? null))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível salvar agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={original ? 'Editar região' : 'Nova região'}
      larga
      salvando={salvando}
      erro={erro}
      rotuloConfirmar={original ? 'Salvar' : 'Criar região'}
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <div className="janela__campos janela__campos--regiao">
        <label className="campo campo--inteiro">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Nome</span>
          <input
            className={`input ${erros.nome ? 'input--erro' : ''}`}
            maxLength={LIMITES_REGIAO.nome}
            aria-required
            placeholder="Ex.: Vila Mariana"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          {erros.nome && <span className="campo__erro">{erros.nome}</span>}
        </label>
        <label className="campo">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Cidade</span>
          <input
            className={`input ${erros.cidade ? 'input--erro' : ''}`}
            maxLength={LIMITES_REGIAO.cidade}
            aria-required
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
          />
          {erros.cidade && <span className="campo__erro">{erros.cidade}</span>}
        </label>
        <label className="campo">
          <span className="campo__rotulo campo__rotulo--obrigatorio">UF</span>
          <select className={`input ${erros.uf ? 'input--erro' : ''}`} aria-required value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="">--</option>
            {ufs.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {erros.uf && <span className="campo__erro">{erros.uf}</span>}
        </label>
        <label className="campo campo--inteiro">
          <span className="campo__rotulo">Bairros atendidos</span>
          <textarea
            className={`input janela__texto janela__texto--alto ${erros.bairros ? 'input--erro' : ''}`}
            placeholder={'Um por linha. Ex.:\nVila Mariana\nParaíso'}
            value={bairros}
            onChange={(e) => setBairros(e.target.value)}
          />
          {erros.bairros ? (
            <span className="campo__erro">{erros.bairros}</span>
          ) : (
            <span className="campo__ajuda">Um bairro por linha, com o nome como aparece no CEP (acentos não importam).</span>
          )}
        </label>
      </div>

      <fieldset className="grupo-opcoes">
        <legend className="campo__rotulo">Centro e raio (opcional)</legend>
        <div className="janela__campos janela__campos--3">
          <label className="campo">
            <span className="campo__rotulo">Latitude</span>
            <input className="input" inputMode="decimal" placeholder="-23,5880" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Longitude</span>
            <input className="input" inputMode="decimal" placeholder="-46,6350" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Raio (km)</span>
            <input className="input" inputMode="decimal" placeholder="3" value={raio} onChange={(e) => setRaio(e.target.value)} />
          </label>
        </div>
        {erros.centro ? (
          <span className="campo__erro">{erros.centro}</span>
        ) : (
          <span className="campo__ajuda">
            Quando o bairro do endereço não está na lista, o back usa a região cujo centro está mais perto, dentro do raio.
          </span>
        )}
      </fieldset>

      <label className="caixa">
        <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
        <span>Ativa (a coleta e as retiradas funcionam nesta região)</span>
      </label>
    </Janela>
  )
}
