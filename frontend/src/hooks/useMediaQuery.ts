import { useSyncExternalStore } from 'react'

/** Retorna true enquanto a media query CSS for verdadeira, ex.: '(max-width: 900px)' */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (avisar) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', avisar)
      return () => mql.removeEventListener('change', avisar)
    },
    () => window.matchMedia(query).matches,
  )
}
