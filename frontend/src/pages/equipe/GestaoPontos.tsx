import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, LoaderCircle, MapPinned, Pencil, Plus, Power, X } from 'lucide-react'
import CamposEndereco from '../../components/CamposEndereco'
import Janela from '../../components/Janela'
import PageHeader from '../../components/PageHeader'
import { Carregando, ErroComTentar, SeloAtivo, Vazio } from '../../components/Painel'
import { useAuth } from '../../context/useAuth'
import { enderecoVazio, type Endereco } from '../../data/usuario'
import { useConsulta } from '../../hooks/useConsulta'
import { listarCooperativas } from '../../services/admin'
import { mensagemDeErro } from '../../services/api'
import {
  desativarPonto,
  LIMITES_PONTO,
  listarPontosGeridos,
  reativarPonto,
  salvarPonto,
  type DadosPonto,
  type PontoGerido,
} from '../../services/gestaoPontos'
import { listarCategorias } from '../../services/materiais'
import { enderecoDoPonto, nomeDoTipo, tiposPonto, type HorarioPonto, type TipoPonto } from '../../services/pontos'
import { agruparAgenda, diasSemana, ordemSemana } from '../../utils/agenda'
import { propsCategoria } from '../../utils/corCategoria'
import { mascaraCep, mascaraTelefone, SEM_NUMERO, telefoneValido, validarEndereco, type ErrosEndereco } from '../../utils/validar'
import './equipe.css'

// Cadastro de pontos de coleta: admin vê todos (inclusive inativos) e escolhe a cooperativa
// responsável; a gestão da cooperativa vê e cadastra os da própria cooperativa.
export default function GestaoPontos() {
  const { usuario } = useAuth()
  const admin = usuario?.papel === 'ADMIN'
  const [pagina, setPagina] = useState(1)
  const pontos = useConsulta(`pontos-geridos|${pagina}`, (s) => listarPontosGeridos(pagina, s))
  const [editando, setEditando] = useState<PontoGerido | 'novo' | null>(null)
  const [alterando, setAlterando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [erroLinha, setErroLinha] = useState<{ id: string; mensagem: string } | null>(null)

  function trocar(ponto: PontoGerido) {
    const lista = pontos.dados
    if (lista) pontos.substituir({ ...lista, items: lista.items.map((p) => (p.id === ponto.id ? ponto : p)) })
  }

  async function alternarAtivo(p: PontoGerido) {
    setAlterando(p.id)
    setAviso('')
    setErroLinha(null)
    try {
      if (p.ativo) {
        await desativarPonto(p.id)
        trocar({ ...p, ativo: false })
        setAviso(`${p.nome} foi desativado e saiu da busca pública.`)
      } else {
        trocar(await reativarPonto(p.id))
        setAviso(`${p.nome} voltou a aparecer na busca pública.`)
      }
    } catch (erro) {
      setErroLinha({ id: p.id, mensagem: mensagemDeErro(erro) })
    } finally {
      setAlterando(null)
    }
  }

  const dados = pontos.dados

  return (
    <div className="page page--larga">
      <PageHeader
        eyebrow={admin ? 'Administração' : (usuario?.cooperativa?.nome ?? 'Cooperativa')}
        titulo={admin ? 'Gestão de pontos' : 'Pontos da cooperativa'}
        descricao="Cadastre e mantenha os pontos de entrega: endereço no mapa, materiais aceitos e horários. Pontos desativados somem da busca pública."
        icon={MapPinned}
      />

      <div className="painel__barra">
        <p className="texto-suave">{dados ? `${dados.total} ${dados.total === 1 ? 'ponto' : 'pontos'}` : ''}</p>
        <button type="button" className="btn btn--primario" onClick={() => setEditando('novo')}>
          <Plus size={16} /> Novo ponto
        </button>
      </div>

      {aviso && (
        <p className="alerta alerta--sucesso painel__erro" role="status">
          <Check size={16} aria-hidden="true" /> {aviso}
        </p>
      )}

      {pontos.erro ? (
        <ErroComTentar erro={pontos.erro} titulo="Não foi possível carregar os pontos agora." aoTentar={pontos.recarregar} />
      ) : !dados ? (
        <Carregando texto="Carregando os pontos..." />
      ) : dados.items.length === 0 ? (
        <Vazio icone={MapPinned} titulo="Nenhum ponto cadastrado ainda.">
          <p className="texto-suave">Cadastre o primeiro ponto de entrega para ele aparecer no mapa de Pontos de coleta.</p>
        </Vazio>
      ) : (
        <ul className={`painel__lista painel__lista--2 ${pontos.carregando ? 'painel__lista--atualizando' : ''}`}>
          {dados.items.map((p) => (
            <li key={p.id} className={`card ponto-gerido ${p.ativo ? '' : 'ponto-gerido--inativo'}`}>
              <div className="ponto-gerido__topo">
                <span className="pontos__tipo">{nomeDoTipo(p.tipo)}</span>
                <SeloAtivo ativo={p.ativo} />
              </div>
              <h2 className="card__titulo">
                {p.ativo ? <Link to={`/pontos/${p.id}`}>{p.nome}</Link> : p.nome}
              </h2>
              <p className="texto-suave">{enderecoDoPonto(p)}</p>
              {admin && <p className="texto-suave">Responsável: {p.cooperativa ?? 'nenhuma cooperativa'}</p>}
              {p.regiao === null && <p className="texto-nota">Fora das regiões atendidas.</p>}
              <ul className="pedido__materiais" aria-label="Materiais aceitos">
                {p.categorias.length === 0 ? (
                  <li className="texto-suave">Nenhum material marcado.</li>
                ) : (
                  p.categorias.map((c) => (
                    <li key={c.id} {...propsCategoria(c, 'tag')}>
                      {c.nome}
                    </li>
                  ))
                )}
              </ul>
              <p className="ponto-gerido__horario">
                {p.horarios.length === 0
                  ? 'Sem horário cadastrado'
                  : agruparAgenda(p.horarios)
                      .map((g) => `${g.dias}: ${g.horario}`)
                      .join(' · ')}
              </p>
              <div className="ponto-gerido__acoes">
                <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setEditando(p)}>
                  <Pencil size={14} /> Editar
                </button>
                <button
                  type="button"
                  className={`btn btn--pequeno ${p.ativo ? 'btn--texto-perigo' : 'btn--contorno'}`}
                  disabled={alterando !== null}
                  onClick={() => alternarAtivo(p)}
                >
                  {alterando === p.id ? <LoaderCircle size={14} className="girando" /> : <Power size={14} />}{' '}
                  {p.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </div>
              {erroLinha?.id === p.id && (
                <p className="campo__erro" role="alert">
                  {erroLinha.mensagem}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {dados && dados.totalPages > 1 && (
        <nav className="paginacao" aria-label="Páginas">
          <button type="button" className="btn btn--contorno btn--pequeno" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>
            Anterior
          </button>
          <span>
            Página {pagina} de {dados.totalPages}
          </span>
          <button
            type="button"
            className="btn btn--contorno btn--pequeno"
            disabled={pagina >= dados.totalPages}
            onClick={() => setPagina((n) => n + 1)}
          >
            Próxima
          </button>
        </nav>
      )}

      {editando && (
        <JanelaPonto
          original={editando === 'novo' ? null : editando}
          admin={admin}
          aoFechar={() => setEditando(null)}
          aoSalvar={(ponto) => {
            const novo = editando === 'novo'
            setEditando(null)
            setAviso(novo ? `${ponto.nome} foi cadastrado.` : `${ponto.nome} foi atualizado.`)
            if (novo) pontos.recarregar()
            else trocar(ponto)
          }}
        />
      )}
    </div>
  )
}

interface LinhaHorario extends HorarioPonto {
  chave: number
}

type ErrosPonto = ErrosEndereco & { nome?: string; telefone?: string; horarios?: string }

const enderecoDe = (p: PontoGerido): Endereco => ({
  cep: p.cep ? mascaraCep(p.cep) : '',
  rua: p.rua,
  numero: p.numero && p.numero.toLowerCase() !== 's/n' ? p.numero : SEM_NUMERO,
  complemento: '',
  bairro: p.bairro,
  cidade: p.cidade,
  uf: p.uf,
  latitude: p.latitude,
  longitude: p.longitude,
})

function JanelaPonto({
  original,
  admin,
  aoFechar,
  aoSalvar,
}: {
  original: PontoGerido | null
  admin: boolean
  aoFechar: () => void
  aoSalvar: (p: PontoGerido) => void
}) {
  const categorias = useConsulta('categorias', (s) => listarCategorias(s))
  const cooperativas = useConsulta(admin ? 'cooperativas' : null, (s) => listarCooperativas(s))
  const [nome, setNome] = useState(original?.nome ?? '')
  const [tipo, setTipo] = useState<TipoPonto>(original?.tipo ?? 'ECOPONTO')
  const [endereco, setEndereco] = useState<Endereco>(original ? enderecoDe(original) : { ...enderecoVazio })
  const [orientacoes, setOrientacoes] = useState(original?.orientacoes ?? '')
  const [telefone, setTelefone] = useState(original?.telefone ? mascaraTelefone(original.telefone) : '')
  const [categoriaIds, setCategoriaIds] = useState<string[]>(original?.categorias.map((c) => c.id) ?? [])
  const [horarios, setHorarios] = useState<LinhaHorario[]>(
    () => original?.horarios.map((h, i) => ({ ...h, chave: i })) ?? [],
  )
  const [proxima, setProxima] = useState(original?.horarios.length ?? 0)
  const [cooperativaId, setCooperativaId] = useState(original?.cooperativaId ?? '')
  const [ativo, setAtivo] = useState(original?.ativo ?? true)
  const [erros, setErros] = useState<ErrosPonto>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function alterarEndereco(parcial: Partial<Endereco>) {
    setEndereco((e) => ({ ...e, ...parcial }))
    setErros((atual) => {
      const novo = { ...atual }
      for (const campo of Object.keys(parcial)) delete novo[campo as keyof Endereco]
      return novo
    })
  }

  function adicionarHorarios(dias: number[], inicio = '08:00', fim = '17:00') {
    setHorarios((atual) => [...atual, ...dias.map((dia, i) => ({ chave: proxima + i, dia, inicio, fim }))])
    setProxima((n) => n + dias.length)
    setErros((e) => ({ ...e, horarios: undefined }))
  }

  function alterarHorario(chave: number, parcial: Partial<HorarioPonto>) {
    setHorarios((atual) => atual.map((h) => (h.chave === chave ? { ...h, ...parcial } : h)))
    setErros((e) => ({ ...e, horarios: undefined }))
  }

  async function confirmar() {
    const novos: ErrosPonto = validarEndereco(endereco)
    // Ponto pode ter número com letra (ex.: "120A"); só não pode ficar vazio
    if (endereco.numero.trim()) delete novos.numero
    if (nome.trim().length < 2) novos.nome = 'Informe o nome do ponto.'
    if (telefone && !telefoneValido(telefone)) novos.telefone = 'Informe o telefone com DDD.'
    if (horarios.some((h) => !h.inicio || !h.fim || h.inicio >= h.fim))
      novos.horarios = 'Em cada horário, a abertura precisa ser antes do fechamento.'
    setErros(novos)
    if (Object.keys(novos).length > 0) {
      setTimeout(() => document.querySelector('.janela .campo__erro')?.scrollIntoView({ block: 'center' }))
      return
    }
    const dados: DadosPonto = {
      nome,
      tipo,
      cep: endereco.cep,
      rua: endereco.rua,
      numero: endereco.numero,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: endereco.uf,
      latitude: endereco.latitude as number,
      longitude: endereco.longitude as number,
      orientacoes,
      telefone,
      categoriaIds,
      horarios: [...horarios]
        .sort((a, b) => ordemSemana.indexOf(a.dia) - ordemSemana.indexOf(b.dia) || a.inicio.localeCompare(b.inicio))
        .map(({ dia, inicio, fim }) => ({ dia, inicio, fim })),
      cooperativaId,
      ativo,
    }
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await salvarPonto(dados, original, admin))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível salvar o ponto agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={original ? 'Editar ponto' : 'Novo ponto de coleta'}
      descricao="A região é calculada pelo bairro e pelo local no mapa."
      larga
      salvando={salvando}
      erro={erro}
      rotuloConfirmar={original ? 'Salvar alterações' : 'Cadastrar ponto'}
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <div className="janela__campos">
        <label className="campo campo--inteiro">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Nome do ponto</span>
          <input
            className={`input ${erros.nome ? 'input--erro' : ''}`}
            maxLength={LIMITES_PONTO.nome}
            aria-required
            value={nome}
            onChange={(e) => {
              setNome(e.target.value)
              setErros((x) => ({ ...x, nome: undefined }))
            }}
          />
          {erros.nome && <span className="campo__erro">{erros.nome}</span>}
        </label>
        <label className="campo">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Tipo</span>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPonto)}>
            {tiposPonto.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nome}
              </option>
            ))}
          </select>
          <span className="campo__ajuda">{tiposPonto.find((t) => t.valor === tipo)?.descricao}</span>
        </label>
        <label className="campo">
          <span className="campo__rotulo">Telefone</span>
          <input
            className={`input ${erros.telefone ? 'input--erro' : ''}`}
            inputMode="tel"
            placeholder="(00) 0000-0000"
            value={telefone}
            onChange={(e) => {
              setTelefone(mascaraTelefone(e.target.value))
              setErros((x) => ({ ...x, telefone: undefined }))
            }}
          />
          {erros.telefone && <span className="campo__erro">{erros.telefone}</span>}
        </label>
        {admin && (
          <label className="campo campo--inteiro">
            <span className="campo__rotulo">Cooperativa responsável</span>
            <select
              className="input"
              value={cooperativaId}
              disabled={!cooperativas.dados}
              onChange={(e) => setCooperativaId(e.target.value)}
            >
              <option value="">Nenhuma (ponto público ou parceiro)</option>
              {cooperativas.dados?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <CamposEndereco endereco={endereco} erros={erros} onAlterar={alterarEndereco} semComplemento />

      <label className="campo">
        <span className="campo__rotulo">Orientações de entrega</span>
        <textarea
          className="input janela__texto"
          maxLength={LIMITES_PONTO.orientacoes}
          placeholder="Ex.: Entregar os materiais limpos e secos. Entrada pelo portão lateral."
          value={orientacoes}
          onChange={(e) => setOrientacoes(e.target.value)}
        />
      </label>

      <fieldset className="grupo-opcoes">
        <legend className="campo__rotulo">Materiais aceitos</legend>
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
                  onChange={(e) =>
                    setCategoriaIds((atual) => (e.target.checked ? [...atual, c.id] : atual.filter((x) => x !== c.id)))
                  }
                />
                <span>{c.nome}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="grupo-opcoes">
        <legend className="campo__rotulo">Horário de funcionamento</legend>
        {horarios.length === 0 ? (
          <p className="texto-suave">Sem horário: o ponto aparece como fechado.</p>
        ) : (
          <ul className="editor-linhas">
            {horarios.map((h, n) => (
              <li key={h.chave} className="editor-linhas__linha editor-linhas__linha--horario">
                <select
                  className="input"
                  aria-label={`Dia do horário ${n + 1}`}
                  value={h.dia}
                  onChange={(e) => alterarHorario(h.chave, { dia: Number(e.target.value) })}
                >
                  {ordemSemana.map((d) => (
                    <option key={d} value={d}>
                      {diasSemana[d]}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  className={`input ${erros.horarios && h.inicio >= h.fim ? 'input--erro' : ''}`}
                  aria-label={`Abre (horário ${n + 1})`}
                  value={h.inicio}
                  onChange={(e) => alterarHorario(h.chave, { inicio: e.target.value })}
                />
                <input
                  type="time"
                  className={`input ${erros.horarios && h.inicio >= h.fim ? 'input--erro' : ''}`}
                  aria-label={`Fecha (horário ${n + 1})`}
                  value={h.fim}
                  onChange={(e) => alterarHorario(h.chave, { fim: e.target.value })}
                />
                <button
                  type="button"
                  className="editor-linhas__remover"
                  aria-label={`Tirar o horário ${n + 1}`}
                  onClick={() => setHorarios((atual) => atual.filter((x) => x.chave !== h.chave))}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {erros.horarios && <span className="campo__erro">{erros.horarios}</span>}
        {horarios.length < LIMITES_PONTO.horarios && (
          <div className="editor-linhas__botoes">
            <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => adicionarHorarios([1])}>
              <Plus size={14} /> Adicionar horário
            </button>
            {horarios.length === 0 && (
              <button type="button" className="btn btn--texto btn--pequeno" onClick={() => adicionarHorarios([1, 2, 3, 4, 5])}>
                Segunda a sexta, 8h às 17h
              </button>
            )}
          </div>
        )}
        <span className="campo__ajuda">Para dois turnos no mesmo dia, adicione duas linhas. 24 horas: 00:00 às 23:59.</span>
      </fieldset>

      <label className="caixa">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        <span>Ativo (aparece na busca pública de pontos)</span>
      </label>
    </Janela>
  )
}
