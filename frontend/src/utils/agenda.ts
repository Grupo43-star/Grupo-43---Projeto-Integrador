/** Um horário de funcionamento (mesmo formato de HorarioPonto, em services/pontos.ts). */
interface Horario {
  dia: number // 0 = domingo
  inicio: string // HH:MM
  fim: string // HH:MM
}

/** Índice = dia da semana do JavaScript (0 = domingo) */
export const diasSemana = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

export const diasSemanaCurtos = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Ordem de exibição: segunda primeiro, domingo por último */
export const ordemSemana = [1, 2, 3, 4, 5, 6, 0]

/** "00:00 - 23:59" vira "24 horas" */
export function rotuloHorario(h: Horario) {
  return h.inicio === '00:00' && h.fim === '23:59' ? '24 horas' : `${h.inicio} - ${h.fim}`
}

/**
 * Junta os dias com o mesmo horário, de segunda a domingo.
 * Ex.: [{ dias: 'Seg a Sex', horario: '08:00 - 17:00' }, { dias: 'Sáb', horario: '08:00 - 12:00' }]
 */
export function agruparAgenda(agenda: Horario[]) {
  const grupos = new Map<string, number[]>()
  for (const dia of ordemSemana) {
    for (const h of agenda.filter((item) => item.dia === dia)) {
      const chave = rotuloHorario(h)
      grupos.set(chave, [...(grupos.get(chave) ?? []), dia])
    }
  }
  return [...grupos].map(([horario, dias]) => ({
    dias: dias.length === 7 ? 'Todos os dias' : rotuloDias(dias),
    horario,
  }))
}

/** [1,2,3,4,5] => "Seg a Sex"; [2,4] => "Ter, Qui"; [3,4] => "Qua e Qui" */
function rotuloDias(dias: number[]) {
  const sequencias: number[][] = []
  for (const p of dias.map((d) => ordemSemana.indexOf(d))) {
    const ultima = sequencias[sequencias.length - 1]
    if (ultima && p === ultima[ultima.length - 1] + 1) ultima.push(p)
    else sequencias.push([p])
  }

  const nome = (p: number) => diasSemanaCurtos[ordemSemana[p]]
  return sequencias
    .map((s) => {
      if (s.length === 1) return nome(s[0])
      if (s.length === 2) return `${nome(s[0])} e ${nome(s[1])}`
      return `${nome(s[0])} a ${nome(s[s.length - 1])}`
    })
    .join(', ')
}

/** 0.45 => "450 m"; 3.2 => "3,2 km" (a distância vem calculada pelo back) */
export function formatarDistancia(km: number) {
  if (km < 1) return `${Math.max(10, Math.round(km * 100) * 10)} m`
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}
