import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CircleCheck,
  CircleX,
  Info,
  Leaf,
  LoaderCircle,
  RotateCw,
  X,
} from 'lucide-react'
import { ErroApi, mensagemDeErro } from '../services/api'
import { obterMaterial, type MaterialGuia } from '../services/materiais'
import { propsCategoria } from '../utils/corCategoria'

interface Props {
  id: string
  /** Dados que a lista já tem: aparecem na hora, enquanto o back responde. */
  previa?: MaterialGuia
  aoFechar: () => void
}

type Resultado =
  | { chave: string; material: MaterialGuia; erro?: undefined }
  | { chave: string; erro: ErroApi | Error; material?: undefined }

// Detalhe "Como separar e descartar" de um material, num <dialog> modal
// (prende o foco, fecha com Esc, devolve o foco ao botão que abriu).
// Sempre pede GET /materials/:id ao abrir: é isso que conta no indicador "uso do guia".
export default function DetalheMaterial({ id, previa, aoFechar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [tentativa, setTentativa] = useState(0)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const chave = `${id}|${tentativa}`

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
  }, [])

  // Uma consulta por abertura. Sem cancelar no efeito: no modo estrito do React o efeito
  // roda duas vezes em desenvolvimento, e cancelar não impediria o back de contar a 1ª.
  const consultado = useRef('')
  useEffect(() => {
    if (consultado.current === chave) return
    consultado.current = chave
    obterMaterial(id)
      .then((material) => setResultado({ chave, material }))
      .catch((erro) => setResultado({ chave, erro }))
  }, [id, chave])

  const atual = resultado?.chave === chave ? resultado : null
  const material = atual?.material ?? (atual?.erro ? undefined : previa)
  const carregando = !atual
  const naoEncontrado = atual?.erro instanceof ErroApi && atual.erro.status === 404

  return (
    <dialog
      ref={dialogo}
      className="detalhe-material"
      aria-labelledby="detalhe-material-titulo"
      aria-busy={carregando}
      onClose={aoFechar}
      onClick={(e) => {
        // Clique no fundo escurecido (fora da caixa) fecha
        if (e.target === e.currentTarget) dialogo.current?.close()
      }}
    >
      <div className="detalhe-material__caixa">
        <div className="detalhe-material__topo">
          {material ? (
            <span {...propsCategoria(material.categoria, 'tag')}>{material.categoria.nome}</span>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="detalhe-material__fechar"
            aria-label="Fechar"
            onClick={() => dialogo.current?.close()}
          >
            <X size={18} />
          </button>
        </div>

        {atual?.erro ? (
          <>
            <h2 id="detalhe-material-titulo" className="card__titulo">
              {naoEncontrado ? 'Material não encontrado' : 'Não foi possível abrir este material'}
            </h2>
            <p className="alerta alerta--erro" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>
                {naoEncontrado
                  ? 'Ele pode ter sido retirado do guia. Procure pelo nome na lista.'
                  : mensagemDeErro(atual.erro)}
              </span>
            </p>
            {!naoEncontrado && (
              <button
                type="button"
                className="btn btn--contorno"
                onClick={() => setTentativa((n) => n + 1)}
              >
                <RotateCw size={15} /> Tentar novamente
              </button>
            )}
          </>
        ) : !material ? (
          <div className="detalhe-material__carregando">
            <h2 id="detalhe-material-titulo" className="sr-only">
              Carregando material
            </h2>
            <LoaderCircle size={22} className="girando" aria-hidden="true" />
            <p className="texto-suave">Carregando o material...</p>
          </div>
        ) : (
          <>
            <div>
              <h2 id="detalhe-material-titulo" className="detalhe-material__titulo">
                {material.nome}
              </h2>
              <p className={`guia__situacao guia__situacao--${material.reciclavel ? 'sim' : 'nao'}`}>
                {material.reciclavel ? (
                  <>
                    <CircleCheck size={14} aria-hidden="true" /> Reciclável
                  </>
                ) : (
                  <>
                    <CircleX size={14} aria-hidden="true" /> Não reciclável
                  </>
                )}
              </p>
            </div>

            <section className="detalhe-material__secao">
              <h3>Como separar e descartar</h3>
              <p>{material.preparo}</p>
            </section>

            {material.observacao && (
              <p className="guia__dica detalhe-material__nota">
                <Leaf size={14} aria-hidden="true" />
                <span>{material.observacao}</span>
              </p>
            )}

            {material.categoria.descricao && (
              <p className="alerta alerta--info">
                <Info size={18} aria-hidden="true" />
                <span>
                  <strong>{material.categoria.nome}:</strong> {material.categoria.descricao}
                </span>
              </p>
            )}

            {material.sinonimos.length > 0 && (
              <section className="detalhe-material__secao">
                <h3>Também conhecido como</h3>
                <ul className="detalhe-material__sinonimos">
                  {material.sinonimos.map((s) => (
                    <li key={s} className="tag">
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="detalhe-material__acoes">
              <Link
                to={`/pontos?material=${material.categoria.slug}`}
                className="btn btn--contorno"
              >
                Pontos que aceitam {material.categoria.nome.toLowerCase()}
              </Link>
              <Link to="/solicitacoes" className="btn btn--primario">
                Solicitar retirada <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
