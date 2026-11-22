import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, LoaderCircle, X } from 'lucide-react'

interface Props {
  titulo: string
  descricao?: ReactNode
  /** Larga (720px) para formulários grandes */
  larga?: boolean
  /** Enquanto salva, a janela não fecha */
  salvando?: boolean
  erro?: string
  /** Texto do botão principal; sem ele, a janela só tem "Fechar" */
  rotuloConfirmar?: string
  rotuloSalvando?: string
  /** Botão principal vermelho (ações que não têm volta) */
  perigo?: boolean
  /** Mostra a legenda "* Campos obrigatórios" */
  obrigatorios?: boolean
  aoConfirmar?: () => void
  aoFechar: () => void
  children: ReactNode
}

// <dialog> modal com formulário, usado nos painéis da equipe. Esc, X e "Cancelar" fecham;
// clicar fora não fecha (para não perder o que foi digitado). O foco volta ao botão que abriu.
export default function Janela({
  titulo,
  descricao,
  larga = false,
  salvando = false,
  erro,
  rotuloConfirmar,
  rotuloSalvando = 'Salvando...',
  perigo = false,
  obrigatorios = false,
  aoConfirmar,
  aoFechar,
  children,
}: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
  }, [])

  // Erro novo do back: leva a tela até ele
  useEffect(() => {
    if (erro) dialogo.current?.querySelector('.janela__erro')?.scrollIntoView({ block: 'nearest' })
  }, [erro])

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!salvando) aoConfirmar?.()
  }

  function fechar() {
    if (!salvando) dialogo.current?.close()
  }

  return (
    <dialog
      ref={dialogo}
      className={`janela ${larga ? 'janela--larga' : ''}`}
      aria-labelledby={idTitulo}
      onClose={aoFechar}
      onCancel={(e) => {
        if (salvando) e.preventDefault()
      }}
    >
      <form className="janela__caixa" onSubmit={enviar} noValidate>
        <div className="janela__topo">
          <div>
            <h2 id={idTitulo} className="janela__titulo">
              {titulo}
            </h2>
            {descricao && <p className="texto-suave">{descricao}</p>}
          </div>
          <button
            type="button"
            className="janela__fechar"
            aria-label="Fechar"
            onClick={fechar}
            disabled={salvando}
          >
            <X size={18} />
          </button>
        </div>

        {children}

        {erro && (
          <p className="alerta alerta--erro janela__erro" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{erro}</span>
          </p>
        )}

        <div className="janela__acoes">
          {obrigatorios && (
            <p className="legenda-obrigatorio janela__legenda">
              <span>*</span> Campos obrigatórios
            </p>
          )}
          <button type="button" className="btn btn--contorno" onClick={fechar} disabled={salvando}>
            {rotuloConfirmar ? 'Cancelar' : 'Fechar'}
          </button>
          {rotuloConfirmar && (
            <button className={`btn ${perigo ? 'btn--perigo' : 'btn--primario'}`} disabled={salvando}>
              {salvando ? (
                <>
                  <LoaderCircle size={16} className="girando" /> {rotuloSalvando}
                </>
              ) : (
                rotuloConfirmar
              )}
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
