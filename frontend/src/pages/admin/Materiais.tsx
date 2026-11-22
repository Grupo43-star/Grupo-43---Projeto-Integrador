import { useEffect, useState } from 'react'
import { BookOpen, Check, LoaderCircle, Pencil, Plus, Power, Search } from 'lucide-react'
import Janela from '../../components/Janela'
import PageHeader from '../../components/PageHeader'
import { Carregando, ErroComTentar, SeloAtivo, Vazio } from '../../components/Painel'
import { useConsulta } from '../../hooks/useConsulta'
import {
  alterarAtivoMaterial,
  LIMITES_MATERIAL,
  listarMateriaisAdmin,
  salvarMaterial,
  type DadosMaterial,
  type MaterialAdmin,
} from '../../services/admin'
import { mensagemDeErro } from '../../services/api'
import { listarCategorias, type CategoriaGuia } from '../../services/materiais'
import { propsCategoria } from '../../utils/corCategoria'
import '../equipe/equipe.css'

type Situacao = '' | 'sim' | 'nao'

// Materiais do guia (GET /admin/materials inclui os inativos; POST/PATCH): admin e educador.
// Material não é apagado: desativar tira do guia público.
export default function Materiais() {
  const categorias = useConsulta('categorias', (s) => listarCategorias(s))
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('')
  const [pagina, setPagina] = useState(1)
  const filtros = {
    busca: buscaAplicada,
    categoriaId,
    reciclavel: situacao === '' ? null : situacao === 'sim',
  }
  const materiais = useConsulta(`materiais-admin|${JSON.stringify(filtros)}|${pagina}`, (s) =>
    listarMateriaisAdmin(filtros, pagina, s),
  )
  const [editando, setEditando] = useState<MaterialAdmin | 'novo' | null>(null)
  const [alterando, setAlterando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [erroLinha, setErroLinha] = useState<{ id: string; mensagem: string } | null>(null)

  // Busca: espera parar de digitar
  useEffect(() => {
    if (busca.trim() === buscaAplicada) return
    const espera = setTimeout(() => {
      setBuscaAplicada(busca.trim())
      setPagina(1)
    }, 350)
    return () => clearTimeout(espera)
  }, [busca, buscaAplicada])

  const categoriaDe = (m: MaterialAdmin): CategoriaGuia | null =>
    m.categoria ?? categorias.dados?.find((c) => c.id === m.categoriaId) ?? null

  async function alternarAtivo(m: MaterialAdmin) {
    setAlterando(m.id)
    setAviso('')
    setErroLinha(null)
    try {
      const atualizado = await alterarAtivoMaterial(m.id, !m.ativo)
      const lista = materiais.dados
      if (lista)
        materiais.substituir({
          ...lista,
          items: lista.items.map((x) => (x.id === m.id ? { ...atualizado, categoria: x.categoria } : x)),
        })
      setAviso(atualizado.ativo ? `${m.nome} voltou ao guia.` : `${m.nome} saiu do guia público.`)
    } catch (erro) {
      setErroLinha({ id: m.id, mensagem: mensagemDeErro(erro) })
    } finally {
      setAlterando(null)
    }
  }

  const dados = materiais.dados
  const filtrando = Boolean(buscaAplicada || categoriaId || situacao)

  return (
    <div className="page page--larga">
      <PageHeader
        eyebrow="Guia de materiais"
        titulo="Materiais do guia"
        descricao="O que aparece no guia: como separar, observações e sinônimos para a busca. Inclui os materiais desativados."
        icon={BookOpen}
      />

      <section className="card painel__filtros" aria-label="Filtros">
        <div className="painel__campos painel__campos--3">
          <label className="campo">
            <span className="campo__rotulo">Buscar</span>
            <span className="input-com-icone">
              <Search size={16} className="input-com-icone__icone" aria-hidden="true" />
              <input
                className="input"
                maxLength={LIMITES_MATERIAL.busca}
                placeholder="Nome ou sinônimo"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </span>
          </label>
          <label className="campo">
            <span className="campo__rotulo">Categoria</span>
            <select
              className="input"
              value={categoriaId}
              disabled={!categorias.dados}
              onChange={(e) => {
                setCategoriaId(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todas</option>
              {categorias.dados?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span className="campo__rotulo">Situação</span>
            <select
              className="input"
              value={situacao}
              onChange={(e) => {
                setSituacao(e.target.value as Situacao)
                setPagina(1)
              }}
            >
              <option value="">Recicláveis e não recicláveis</option>
              <option value="sim">Só recicláveis</option>
              <option value="nao">Só não recicláveis</option>
            </select>
          </label>
        </div>
      </section>

      <div className="painel__barra">
        <div className="resumo-filtros painel__resumo">
          <span>{dados ? `${dados.total} ${dados.total === 1 ? 'material' : 'materiais'}` : 'Carregando...'}</span>
          {filtrando && (
            <button
              type="button"
              className="resumo-filtros__limpar"
              onClick={() => {
                setBusca('')
                setBuscaAplicada('')
                setCategoriaId('')
                setSituacao('')
                setPagina(1)
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
        <button type="button" className="btn btn--primario" onClick={() => setEditando('novo')}>
          <Plus size={16} /> Novo material
        </button>
      </div>

      {aviso && (
        <p className="alerta alerta--sucesso painel__erro" role="status">
          <Check size={16} aria-hidden="true" /> {aviso}
        </p>
      )}

      {materiais.erro ? (
        <ErroComTentar erro={materiais.erro} titulo="Não foi possível carregar os materiais agora." aoTentar={materiais.recarregar} />
      ) : !dados ? (
        <Carregando />
      ) : dados.items.length === 0 ? (
        <Vazio icone={BookOpen} titulo={filtrando ? 'Nenhum material com estes filtros.' : 'Nenhum material cadastrado.'} />
      ) : (
        <ul className={`painel__lista painel__lista--2 ${materiais.carregando ? 'painel__lista--atualizando' : ''}`}>
          {dados.items.map((m) => {
            const categoria = categoriaDe(m)
            return (
              <li key={m.id} className={`card material-admin ${m.ativo ? '' : 'material-admin--inativo'}`}>
                <div className="material-admin__topo">
                  {categoria && <span {...propsCategoria(categoria, 'tag')}>{categoria.nome}</span>}
                  <span className={`material-admin__reciclavel ${m.reciclavel ? '' : 'material-admin__reciclavel--nao'}`}>
                    {m.reciclavel ? 'Reciclável' : 'Não reciclável'}
                  </span>
                  <SeloAtivo ativo={m.ativo} />
                </div>
                <h2 className="card__titulo">{m.nome}</h2>
                <p className="material-admin__preparo">{m.preparo}</p>
                {m.sinonimos.length > 0 && <p className="texto-nota">Também: {m.sinonimos.join(', ')}</p>}
                <div className="ponto-gerido__acoes">
                  <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setEditando(m)}>
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    type="button"
                    className={`btn btn--pequeno ${m.ativo ? 'btn--texto-perigo' : 'btn--contorno'}`}
                    disabled={alterando !== null}
                    onClick={() => alternarAtivo(m)}
                  >
                    {alterando === m.id ? <LoaderCircle size={14} className="girando" /> : <Power size={14} />}{' '}
                    {m.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
                {erroLinha?.id === m.id && (
                  <p className="campo__erro" role="alert">
                    {erroLinha.mensagem}
                  </p>
                )}
              </li>
            )
          })}
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
        <JanelaMaterial
          original={editando === 'novo' ? null : editando}
          categorias={categorias.dados ?? []}
          aoFechar={() => setEditando(null)}
          aoSalvar={(nome) => {
            setAviso(editando === 'novo' ? `${nome} entrou no guia.` : `${nome} foi atualizado.`)
            setEditando(null)
            materiais.recarregar()
          }}
        />
      )}
    </div>
  )
}

type ErrosMaterial = Partial<Record<'categoriaId' | 'nome' | 'preparo' | 'sinonimos', string>>

/** "garrafa pet, pet" -> ["garrafa pet", "pet"] (sem vazios e sem repetidos) */
const lerSinonimos = (texto: string) => [
  ...new Set(
    texto
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ),
]

function JanelaMaterial({
  original,
  categorias,
  aoFechar,
  aoSalvar,
}: {
  original: MaterialAdmin | null
  categorias: CategoriaGuia[]
  aoFechar: () => void
  aoSalvar: (nome: string) => void
}) {
  const [dados, setDados] = useState<Omit<DadosMaterial, 'sinonimos'>>({
    categoriaId: original?.categoriaId ?? '',
    nome: original?.nome ?? '',
    reciclavel: original?.reciclavel ?? true,
    preparo: original?.preparo ?? '',
    observacao: original?.observacao ?? '',
    ativo: original?.ativo ?? true,
  })
  const [sinonimos, setSinonimos] = useState(original?.sinonimos.join(', ') ?? '')
  const [erros, setErros] = useState<ErrosMaterial>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function alterar<K extends keyof typeof dados>(campo: K, valor: (typeof dados)[K]) {
    setDados((d) => ({ ...d, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
  }

  async function confirmar() {
    const lista = lerSinonimos(sinonimos)
    const novos: ErrosMaterial = {}
    if (!dados.categoriaId) novos.categoriaId = 'Escolha a categoria.'
    if (dados.nome.trim().length < 2) novos.nome = 'Informe o nome (2 caracteres ou mais).'
    if (dados.preparo.trim().length < 2) novos.preparo = 'Explique como separar e descartar.'
    if (lista.length > LIMITES_MATERIAL.sinonimos) novos.sinonimos = `Até ${LIMITES_MATERIAL.sinonimos} sinônimos.`
    setErros(novos)
    if (Object.keys(novos).length > 0) return
    setSalvando(true)
    setErro('')
    try {
      const salvo = await salvarMaterial({ ...dados, sinonimos: lista }, original?.id ?? null)
      aoSalvar(salvo.nome)
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível salvar agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={original ? 'Editar material' : 'Novo material'}
      larga
      salvando={salvando}
      erro={erro}
      rotuloConfirmar={original ? 'Salvar' : 'Adicionar ao guia'}
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <div className="janela__campos">
        <label className="campo">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Nome</span>
          <input
            className={`input ${erros.nome ? 'input--erro' : ''}`}
            maxLength={LIMITES_MATERIAL.nome}
            aria-required
            value={dados.nome}
            onChange={(e) => alterar('nome', e.target.value)}
          />
          {erros.nome && <span className="campo__erro">{erros.nome}</span>}
        </label>
        <label className="campo">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Categoria</span>
          <select
            className={`input ${erros.categoriaId ? 'input--erro' : ''}`}
            aria-required
            value={dados.categoriaId}
            onChange={(e) => alterar('categoriaId', e.target.value)}
          >
            <option value="">Escolha</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {erros.categoriaId && <span className="campo__erro">{erros.categoriaId}</span>}
        </label>
        <fieldset className="grupo-opcoes campo--inteiro">
          <legend className="campo__rotulo campo__rotulo--obrigatorio">É reciclável?</legend>
          <div className="painel__dias">
            {[true, false].map((v) => (
              <label key={String(v)} className="caixa">
                <input type="radio" name="reciclavel" checked={dados.reciclavel === v} onChange={() => alterar('reciclavel', v)} />
                <span>{v ? 'Sim, reciclável' : 'Não reciclável'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="campo campo--inteiro">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Como separar e descartar</span>
          <textarea
            className={`input janela__texto ${erros.preparo ? 'input--erro' : ''}`}
            maxLength={LIMITES_MATERIAL.preparo}
            aria-required
            placeholder="Ex.: Enxágue e deixe secar. Pode amassar para ocupar menos espaço."
            value={dados.preparo}
            onChange={(e) => alterar('preparo', e.target.value)}
          />
          {erros.preparo && <span className="campo__erro">{erros.preparo}</span>}
        </label>
        <label className="campo campo--inteiro">
          <span className="campo__rotulo">Observação (cuidado extra)</span>
          <textarea
            className="input janela__texto"
            maxLength={LIMITES_MATERIAL.observacao}
            placeholder="Ex.: Tampas vão separadas."
            value={dados.observacao}
            onChange={(e) => alterar('observacao', e.target.value)}
          />
        </label>
        <label className="campo campo--inteiro">
          <span className="campo__rotulo">Sinônimos</span>
          <input
            className={`input ${erros.sinonimos ? 'input--erro' : ''}`}
            placeholder="Ex.: garrafa pet, pet, garrafinha"
            value={sinonimos}
            onChange={(e) => {
              setSinonimos(e.target.value)
              setErros((x) => ({ ...x, sinonimos: undefined }))
            }}
          />
          {erros.sinonimos ? (
            <span className="campo__erro">{erros.sinonimos}</span>
          ) : (
            <span className="campo__ajuda">Separe por vírgula. A busca do guia procura no nome e nos sinônimos.</span>
          )}
        </label>
      </div>
      <label className="caixa">
        <input type="checkbox" checked={dados.ativo} onChange={(e) => alterar('ativo', e.target.checked)} />
        <span>Ativo (aparece no guia público)</span>
      </label>
    </Janela>
  )
}
