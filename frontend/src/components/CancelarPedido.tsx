import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { mensagemDeErro } from '../services/api'
import { statusCancelaveis, type StatusPedido } from '../services/pedidos'

interface Props {
  status: StatusPedido
  /** Chama o back; se der erro, a mensagem aparece aqui mesmo. */
  onCancelar: (motivo: string) => Promise<void>
}

/** "Cancelar pedido" com confirmação na própria linha e motivo opcional (só até AGENDADA). */
export default function CancelarPedido({ status, onCancelar }: Props) {
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [erro, setErro] = useState('')

  if (!statusCancelaveis.includes(status)) return null

  async function cancelar() {
    setCancelando(true)
    setErro('')
    try {
      await onCancelar(motivo)
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível cancelar agora. Tente de novo.'))
      setCancelando(false)
    }
  }

  return (
    <>
      {confirmando ? (
        <div className="pedido__confirmar" role="group" aria-label="Confirmar cancelamento">
          <span>Cancelar este pedido?</span>
          <input
            className="input pedido__motivo"
            placeholder="Motivo (opcional)"
            aria-label="Motivo do cancelamento (opcional)"
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--pequeno pedido__btn-cancelar"
            disabled={cancelando}
            onClick={cancelar}
          >
            {cancelando ? <LoaderCircle size={14} className="girando" /> : null}
            Sim, cancelar
          </button>
          <button
            type="button"
            className="btn btn--pequeno btn--contorno"
            disabled={cancelando}
            onClick={() => setConfirmando(false)}
          >
            Manter
          </button>
        </div>
      ) : (
        <button type="button" className="pedido__cancelar" onClick={() => setConfirmando(true)}>
          Cancelar pedido
        </button>
      )}
      {erro && <span className="campo__erro">{erro}</span>}
    </>
  )
}
