import { useEffect, useState } from 'react'

interface Resultado<T> {
  chave: string
  dados?: T
  erro?: unknown
}

export interface Consulta<T> {
  /** Dados da consulta atual; enquanto uma nova carrega, ficam os da anterior (lista esmaecida). */
  dados: T | undefined
  /** Erro da consulta atual (nunca o de uma consulta antiga). */
  erro: unknown
  carregando: boolean
  /** Repete a mesma consulta ("Tentar novamente", depois de uma ação). */
  recarregar: () => void
  /** Troca os dados pela resposta de uma ação (ex.: o pedido que o back devolveu). */
  substituir: (dados: T) => void
}

/**
 * Consulta ao back que refaz sozinha quando a `chave` muda (null = não consultar).
 * O "carregando" é derivado (chave pedida x chave do último resultado), sem setState no efeito.
 * Respostas antigas são canceladas (AbortController) para não sobrescrever as novas.
 */
export function useConsulta<T>(
  chave: string | null,
  buscar: (sinal: AbortSignal) => Promise<T>,
): Consulta<T> {
  const [tentativa, setTentativa] = useState(0)
  const [resultado, setResultado] = useState<Resultado<T> | null>(null)
  const chaveAtual = chave === null ? null : `${chave}#${tentativa}`

  useEffect(() => {
    if (chaveAtual === null) return
    const controle = new AbortController()
    buscar(controle.signal)
      .then((dados) => setResultado({ chave: chaveAtual, dados }))
      .catch((erro: unknown) => {
        if (!controle.signal.aborted) setResultado({ chave: chaveAtual, erro })
      })
    return () => controle.abort()
    // `buscar` muda a cada renderização; o que define a consulta é a chave
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveAtual])

  const atual = resultado?.chave === chaveAtual ? resultado : null
  return {
    dados: atual ? atual.dados : resultado?.dados,
    erro: atual?.erro,
    carregando: chaveAtual !== null && atual === null,
    recarregar: () => setTentativa((t) => t + 1),
    substituir: (dados) => {
      if (chaveAtual !== null) setResultado({ chave: chaveAtual, dados })
    },
  }
}
