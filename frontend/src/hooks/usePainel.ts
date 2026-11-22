import { useEffect, useRef, useState } from 'react'

/**
 * Painel que abre por um botão (menu de bairros, notificações).
 * Fecha ao clicar fora ou com Esc (aí o foco volta para o botão).
 */
export function usePainel() {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    function aoClicar(e: PointerEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setAberto(false)
      botao.current?.focus()
    }
    document.addEventListener('pointerdown', aoClicar)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('pointerdown', aoClicar)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  return {
    aberto,
    raiz,
    botao,
    alternar: () => setAberto((a) => !a),
    fechar: () => setAberto(false),
  }
}
