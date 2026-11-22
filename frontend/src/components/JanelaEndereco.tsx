import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, LoaderCircle, X } from 'lucide-react'
import CamposEndereco from './CamposEndereco'
import { useAuth } from '../context/useAuth'
import { enderecoVazio, type Endereco, type EnderecoSalvo } from '../data/usuario'
import { mensagemDeErro } from '../services/api'
import { LIMITES, validarEndereco, type ErrosEndereco } from '../utils/validar'

interface Props {
  /** Endereço a editar; null = cadastrar um novo */
  editando: EnderecoSalvo | null
  aoFechar: () => void
  aoSalvar: (salvo: EnderecoSalvo) => void
}

// Cadastrar ou editar um endereço que não é o principal, num <dialog> modal.
// O principal é editado no próprio formulário do Perfil.
export default function JanelaEndereco({ editando, aoFechar, aoSalvar }: Props) {
  const { salvarOutroEndereco } = useAuth()
  const dialogo = useRef<HTMLDialogElement>(null)
  const [endereco, setEndereco] = useState<Endereco>(editando?.endereco ?? { ...enderecoVazio })
  const [nome, setNome] = useState(editando?.nome ?? '')
  const [principal, setPrincipal] = useState(false)
  const [erros, setErros] = useState<ErrosEndereco>({})
  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
  }, [])

  function alterarEndereco(parcial: Partial<Endereco>) {
    setEndereco((atual) => ({ ...atual, ...parcial }))
    setErros((atual) => {
      const novo = { ...atual }
      for (const campo of Object.keys(parcial)) delete novo[campo as keyof Endereco]
      return novo
    })
    setErroGeral('')
  }

  async function aoConfirmar(evento: FormEvent) {
    evento.preventDefault()
    const novos = validarEndereco(endereco)
    setErros(novos)
    if (Object.keys(novos).length > 0) {
      setTimeout(() => {
        dialogo.current
          ?.querySelector('.campo__erro')
          ?.closest('.campo')
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
      return
    }
    setSalvando(true)
    setErroGeral('')
    try {
      const salvo = await salvarOutroEndereco({ endereco, nome, principal }, editando?.id ?? null)
      aoSalvar(salvo)
      dialogo.current?.close()
    } catch (falha) {
      setErroGeral(mensagemDeErro(falha, 'Não foi possível salvar o endereço. Tente de novo.'))
      setSalvando(false)
    }
  }

  function fechar() {
    if (!salvando) dialogo.current?.close()
  }

  const titulo = editando ? 'Editar endereço' : 'Novo endereço'

  return (
    <dialog
      ref={dialogo}
      className="janela janela--larga janela-endereco"
      aria-labelledby="janela-endereco-titulo"
      onClose={aoFechar}
      onCancel={(e) => {
        if (salvando) e.preventDefault()
      }}
    >
      <form className="janela__caixa" onSubmit={aoConfirmar} noValidate>
        <div className="janela__topo">
          <div>
            <h2 id="janela-endereco-titulo" className="janela__titulo">
              {titulo}
            </h2>
            <p className="texto-suave">
              Outro local onde a retirada pode acontecer, como o trabalho ou a loja.
            </p>
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

        <label className="campo">
          <span className="campo__rotulo">Nome do endereço</span>
          <input
            className="input"
            maxLength={LIMITES.nomeEndereco}
            placeholder="Ex.: Trabalho, Loja, Casa da praia"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <span className="campo__ajuda">Opcional. Ajuda a escolher o endereço no pedido.</span>
        </label>

        <CamposEndereco endereco={endereco} erros={erros} onAlterar={alterarEndereco} />

        <label className="caixa janela-endereco__principal">
          <input
            type="checkbox"
            checked={principal}
            onChange={(e) => setPrincipal(e.target.checked)}
          />
          <span>
            Usar como endereço principal (aparece primeiro nos pedidos e vale para o calendário,
            os pontos perto de você e o Início)
          </span>
        </label>

        {erroGeral && (
          <p className="alerta alerta--erro" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{erroGeral}</span>
          </p>
        )}

        <div className="janela__acoes">
          <p className="legenda-obrigatorio janela-endereco__legenda">
            <span>*</span> Campos obrigatórios
          </p>
          <button type="button" className="btn btn--contorno" onClick={fechar} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn btn--primario" disabled={salvando}>
            {salvando ? (
              <>
                <LoaderCircle size={16} className="girando" /> Salvando...
              </>
            ) : (
              'Salvar endereço'
            )}
          </button>
        </div>
      </form>
    </dialog>
  )
}
