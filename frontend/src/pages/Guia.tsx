import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CircleCheck,
  CircleX,
  Info,
  Leaf,
  LoaderCircle,
  Recycle,
  RotateCw,
  Search,
  SearchX,
  X,
} from 'lucide-react'
import DetalheMaterial from '../components/DetalheMaterial'
import PageHeader from '../components/PageHeader'
import { mensagemDeErro } from '../services/api'
import {
  LIMITE_BUSCA_MATERIAL,
  listarCategorias,
  listarMateriais,
  type CategoriaGuia,
  type MaterialGuia,
} from '../services/materiais'
import './guia.css'
import { propsCategoria } from '../utils/corCategoria'

/** Espera a pessoa parar de digitar antes de consultar o back. */
const ESPERA_BUSCA_MS = 350

type Estado = 'carregando' | 'pronto' | 'erro'

interface ListaMateriais {
  itens: MaterialGuia[]
  total: number
  pagina: number
  totalPaginas: number
}

const listaVazia: ListaMateriais = { itens: [], total: 0, pagina: 1, totalPaginas: 1 }

function ehCancelamento(erro: unknown) {
  return erro instanceof DOMException && erro.name === 'AbortError'
}

/** Valores do filtro "Situação" na URL (?reciclavel=sim|nao), com o que vai para o back. */
const situacoes = {
  sim: { rotulo: 'Só recicláveis', reciclavel: true },
  nao: { rotulo: 'Só não recicláveis', reciclavel: false },
} as const
type Situacao = keyof typeof situacoes

function lerSituacao(valor: string | null): Situacao | '' {
  return valor === 'sim' || valor === 'nao' ? valor : ''
}

// Filtros ficam na URL (?busca=...&categoria=<slug do back>&reciclavel=sim|nao) para o
// link poder ser compartilhado e para outras telas abrirem o guia já filtrado.
export default function Guia() {
  const [parametros, setParametros] = useSearchParams()
  const busca = parametros.get('busca') ?? ''
  const categoriaParam = parametros.get('categoria') ?? ''
  // Valor inválido na URL é ignorado
  const situacao = lerSituacao(parametros.get('reciclavel'))
  const reciclavel = situacao ? situacoes[situacao].reciclavel : undefined

  // ---------- Categorias ----------
  const [categorias, setCategorias] = useState<CategoriaGuia[]>([])
  const [estadoCategorias, setEstadoCategorias] = useState<Estado>('carregando')
  const [tentativaCategorias, setTentativaCategorias] = useState(0)

  function recarregarCategorias() {
    setEstadoCategorias('carregando')
    setTentativaCategorias((n) => n + 1)
  }

  useEffect(() => {
    const controle = new AbortController()
    listarCategorias(controle.signal)
      .then((lista) => {
        setCategorias(lista)
        setEstadoCategorias('pronto')
      })
      .catch((erro) => {
        if (!ehCancelamento(erro)) setEstadoCategorias('erro')
      })
    return () => controle.abort()
  }, [tentativaCategorias])

  // Categoria inválida na URL (ou lista de categorias fora do ar) é ignorada
  const categoriaAtual = categorias.find((c) => c.slug === categoriaParam) ?? null
  const esperandoCategoria = Boolean(categoriaParam) && estadoCategorias === 'carregando'

  // ---------- Busca com espera ----------
  const [buscaConsultada, setBuscaConsultada] = useState(busca.trim())
  useEffect(() => {
    const termo = busca.trim()
    // Apagar a busca vale na hora; digitar espera a pessoa parar
    const espera = termo ? ESPERA_BUSCA_MS : 0
    const temporizador = window.setTimeout(() => setBuscaConsultada(termo), espera)
    return () => window.clearTimeout(temporizador)
  }, [busca])

  // ---------- Materiais ----------
  // Cada resultado guarda a chave da consulta que o gerou: se a chave atual for outra,
  // a lista está sendo atualizada (sem precisar marcar "carregando" dentro do efeito).
  const [tentativaMateriais, setTentativaMateriais] = useState(0)
  const categoriaId = categoriaAtual?.id
  const chave = `${tentativaMateriais}|${categoriaId ?? ''}|${situacao}|${buscaConsultada}`

  const [resultado, setResultado] = useState<{
    chave: string
    estado: 'pronto' | 'erro'
    lista: ListaMateriais
    erro: string
  } | null>(null)
  const [mais, setMais] = useState<{ chave: string; carregando: boolean; erro: string } | null>(
    null,
  )
  const controleMais = useRef<AbortController | null>(null)

  useEffect(() => {
    if (esperandoCategoria) return
    const controle = new AbortController()
    controleMais.current?.abort()
    listarMateriais({ busca: buscaConsultada, categoriaId, reciclavel }, controle.signal)
      .then((pagina) => {
        setResultado({
          chave,
          estado: 'pronto',
          erro: '',
          lista: {
            itens: pagina.items,
            total: pagina.total,
            pagina: pagina.page,
            totalPaginas: pagina.totalPages,
          },
        })
      })
      .catch((erro) => {
        if (ehCancelamento(erro)) return
        setResultado({ chave, estado: 'erro', erro: mensagemDeErro(erro), lista: listaVazia })
      })
    return () => controle.abort()
  }, [buscaConsultada, categoriaId, reciclavel, esperandoCategoria, chave])

  useEffect(() => () => controleMais.current?.abort(), [])

  const lista = resultado?.lista ?? listaVazia
  const estadoMateriais: Estado =
    esperandoCategoria || resultado?.chave !== chave ? 'carregando' : resultado.estado
  const erroMateriais = resultado?.erro ?? ''
  const carregandoMais = mais?.chave === chave && mais.carregando
  const erroMais = mais?.chave === chave ? mais.erro : ''

  const carregarMais = useCallback(() => {
    const controle = new AbortController()
    controleMais.current?.abort()
    controleMais.current = controle
    setMais({ chave, carregando: true, erro: '' })
    listarMateriais(
      { busca: buscaConsultada, categoriaId, reciclavel, pagina: lista.pagina + 1 },
      controle.signal,
    )
      .then((pagina) => {
        setResultado((atual) =>
          atual && atual.chave === chave
            ? {
                ...atual,
                lista: {
                  // Sem repetir caso a lista tenha mudado no back entre uma página e outra
                  itens: [
                    ...atual.lista.itens,
                    ...pagina.items.filter((m) => !atual.lista.itens.some((a) => a.id === m.id)),
                  ],
                  total: pagina.total,
                  pagina: pagina.page,
                  totalPaginas: pagina.totalPages,
                },
              }
            : atual,
        )
        setMais(null)
      })
      .catch((erro) => {
        if (ehCancelamento(erro)) return
        setMais({ chave, carregando: false, erro: mensagemDeErro(erro) })
      })
  }, [buscaConsultada, categoriaId, reciclavel, chave, lista.pagina])

  // ---------- Filtros ----------
  function alterarFiltro(chave: 'busca' | 'categoria' | 'reciclavel', valor: string) {
    alterarParametro(chave, valor)
  }

  function alterarParametro(
    chave: 'busca' | 'categoria' | 'reciclavel' | 'material',
    valor: string,
  ) {
    // Forma funcional: parte sempre da URL atual, mesmo com duas mudanças seguidas
    setParametros(
      (atuais) => {
        const novos = new URLSearchParams(atuais)
        if (valor) novos.set(chave, valor)
        else novos.delete(chave)
        return novos
      },
      { replace: true },
    )
  }

  function limparFiltros() {
    setParametros({}, { replace: true })
  }

  // Material aberto fica na URL (?material=<id>): o link do detalhe pode ser compartilhado
  const materialAberto = parametros.get('material') ?? ''
  function abrirMaterial(id: string) {
    alterarParametro('material', id)
  }
  function fecharMaterial() {
    alterarParametro('material', '')
  }

  const filtrando = Boolean(buscaConsultada || categoriaAtual || situacao)
  const carregando = estadoMateriais === 'carregando' || esperandoCategoria
  const restantes = lista.total - lista.itens.length

  let resumo: string
  if (carregando) resumo = 'Carregando materiais...'
  else if (estadoMateriais === 'erro') resumo = ''
  else if (filtrando && situacao && !buscaConsultada && !categoriaAtual)
    // Só o filtro de situação: o resumo diz o que está na tela
    resumo =
      situacao === 'sim'
        ? lista.total === 1
          ? '1 material reciclável'
          : `${lista.total} materiais recicláveis`
        : lista.total === 1
          ? '1 material não reciclável'
          : `${lista.total} materiais não recicláveis`
  else if (filtrando)
    resumo =
      lista.total === 1 ? '1 material encontrado' : `${lista.total} materiais encontrados`
  else
    resumo =
      categorias.length > 0
        ? `${lista.total} materiais em ${categorias.length} categorias`
        : `${lista.total} materiais`

  return (
    <div className="page guia">
      <PageHeader
        eyebrow="Guia de descarte"
        titulo="Guia de materiais"
        descricao="Orientações para separar melhor e encontrar a destinação adequada. A aceitação pode variar conforme o ponto."
        icon={Recycle}
      />

      <form className="guia__filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="campo guia__busca">
          <label htmlFor="guia-busca" className="campo__rotulo">
            Buscar
          </label>
          <span className="input-com-icone">
            <Search size={17} className="input-com-icone__icone" aria-hidden="true" />
            <input
              id="guia-busca"
              type="search"
              className="input"
              placeholder="Nome do material (ex.: garrafa, pilha, papelão)"
              value={busca}
              maxLength={LIMITE_BUSCA_MATERIAL}
              onChange={(e) => alterarFiltro('busca', e.target.value)}
            />
          </span>
        </div>
        <div className="campo guia__categoria">
          <label htmlFor="guia-categoria" className="campo__rotulo">
            Categoria
          </label>
          <select
            id="guia-categoria"
            className="input"
            value={categoriaAtual?.slug ?? ''}
            disabled={estadoCategorias !== 'pronto'}
            onChange={(e) => alterarFiltro('categoria', e.target.value)}
          >
            <option value="">
              {estadoCategorias === 'carregando' ? 'Carregando...' : 'Todas as categorias'}
            </option>
            {categorias.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo guia__situacao-filtro">
          <label htmlFor="guia-situacao" className="campo__rotulo">
            Situação
          </label>
          <select
            id="guia-situacao"
            className="input"
            value={situacao}
            onChange={(e) => alterarFiltro('reciclavel', e.target.value)}
          >
            <option value="">Recicláveis e não recicláveis</option>
            {(Object.keys(situacoes) as Situacao[]).map((s) => (
              <option key={s} value={s}>
                {situacoes[s].rotulo}
              </option>
            ))}
          </select>
        </div>
      </form>

      {estadoCategorias === 'erro' && (
        <div className="alerta alerta--erro guia__alerta" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <p>
            A lista de categorias não pôde ser carregada, então o filtro por categoria está
            indisponível. A busca continua funcionando.
          </p>
          <button
            type="button"
            className="btn btn--contorno btn--pequeno"
            onClick={recarregarCategorias}
          >
            <RotateCw size={14} /> Tentar novamente
          </button>
        </div>
      )}

      {categoriaAtual?.descricao && (
        <p className="alerta alerta--info guia__alerta">
          <Info size={18} aria-hidden="true" />
          <span>
            <strong>{categoriaAtual.nome}:</strong> {categoriaAtual.descricao}
          </span>
        </p>
      )}

      <div className="resumo-filtros guia__resumo">
        <p className="texto-suave" aria-live="polite">
          {resumo}
        </p>
        {(busca || categoriaParam || situacao) && (
          <button type="button" className="resumo-filtros__limpar" onClick={limparFiltros}>
            <X size={14} /> Limpar filtros
          </button>
        )}
      </div>

      {estadoMateriais === 'erro' && !carregando ? (
        <div className="alerta alerta--erro guia__alerta" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <p>
            Não foi possível carregar o guia de materiais agora. {erroMateriais}
          </p>
          <button
            type="button"
            className="btn btn--contorno btn--pequeno"
            onClick={() => setTentativaMateriais((n) => n + 1)}
          >
            <RotateCw size={14} /> Tentar novamente
          </button>
        </div>
      ) : carregando && lista.itens.length === 0 ? (
        <div className="card guia__vazio" aria-busy="true">
          <LoaderCircle size={22} className="girando" aria-hidden="true" />
          <p className="texto-suave">Carregando o guia de materiais...</p>
        </div>
      ) : lista.itens.length > 0 ? (
        <>
          <ul className={`guia__lista${carregando ? ' guia__lista--atualizando' : ''}`} aria-busy={carregando}>
            {lista.itens.map((m, i) => (
              <li key={m.id} className="card guia__card">
                <div className="card__topo">
                  <span {...propsCategoria(m.categoria, 'guia__num')} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span {...propsCategoria(m.categoria, 'tag')}>{m.categoria.nome}</span>
                </div>
                <div>
                  <h2 className="card__titulo">{m.nome}</h2>
                  <p
                    className={`guia__situacao guia__situacao--${m.reciclavel ? 'sim' : 'nao'}`}
                  >
                    {m.reciclavel ? (
                      <>
                        <CircleCheck size={14} aria-hidden="true" /> Reciclável
                      </>
                    ) : (
                      <>
                        <CircleX size={14} aria-hidden="true" /> Não reciclável
                      </>
                    )}
                  </p>
                  <p className="texto-suave guia__previa">{m.preparo}</p>
                </div>
                <div className="guia__card-rodape">
                  {m.observacao && (
                    <span className="guia__tem-nota">
                      <Leaf size={14} aria-hidden="true" /> Tem cuidado extra
                    </span>
                  )}
                  <button
                    type="button"
                    className="link-seta guia__abrir"
                    aria-label={`Como descartar: ${m.nome}`}
                    onClick={() => abrirMaterial(m.id)}
                  >
                    Como descartar <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {restantes > 0 && !carregando && (
            <div className="guia__mais">
              {erroMais && (
                <p className="alerta alerta--erro" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <span>Não foi possível carregar mais materiais. {erroMais}</span>
                </p>
              )}
              <button
                type="button"
                className="btn btn--contorno"
                onClick={carregarMais}
                disabled={carregandoMais}
              >
                {carregandoMais ? (
                  <>
                    <LoaderCircle size={16} className="girando" aria-hidden="true" /> Carregando...
                  </>
                ) : (
                  `Carregar mais materiais (${restantes})`
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card guia__vazio">
          <span className="icon-circle">
            <SearchX size={20} strokeWidth={1.75} />
          </span>
          <h2 className="card__titulo">Nenhum material encontrado.</h2>
          <p className="texto-suave">
            A busca procura pelo nome do material. Tente outra palavra, outra categoria ou outra
            situação. Na dúvida, consulte o ponto de coleta.
          </p>
          <button type="button" className="btn btn--contorno" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
      )}

      {materialAberto && (
        <DetalheMaterial
          key={materialAberto}
          id={materialAberto}
          previa={lista.itens.find((m) => m.id === materialAberto)}
          aoFechar={fecharMaterial}
        />
      )}

      <div className="card card--verde card--row guia__chamada">
        <div>
          <h2 className="card__titulo">Já separou seus materiais?</h2>
          <p className="texto-suave">
            Encontre um ponto que aceite o que você tem ou peça uma retirada no seu endereço.
          </p>
        </div>
        <div className="guia__chamada-acoes">
          <Link to="/pontos" className="btn btn--contorno">
            Ver pontos de coleta
          </Link>
          <Link to="/solicitacoes" className="btn btn--primario">
            Solicitar retirada <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
