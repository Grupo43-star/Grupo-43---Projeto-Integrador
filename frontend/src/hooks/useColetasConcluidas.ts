import { useEffect, useState } from 'react'
import { contarColetasConcluidas } from '../services/pedidos'

/**
 * Quantas retiradas da pessoa logada foram concluídas (GET /pickup-requests).
 * `null` enquanto carrega, sem login ou se a API falhar.
 */
export function useColetasConcluidas(usuarioId: string | null) {
  const [resultado, setResultado] = useState<{ id: string; total: number } | null>(null)

  useEffect(() => {
    if (!usuarioId) return
    const controle = new AbortController()
    contarColetasConcluidas(controle.signal)
      .then((total) => setResultado({ id: usuarioId, total }))
      .catch(() => undefined)
    return () => controle.abort()
  }, [usuarioId])

  // Ignora o número de uma conta anterior (ex.: saiu e entrou com outra)
  return resultado && resultado.id === usuarioId ? resultado.total : null
}
