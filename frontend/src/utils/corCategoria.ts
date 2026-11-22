// Cor das categorias de material.
// As 8 categorias do back têm classe própria em global.css (tag--<slug>, cores da coleta
// seletiva, CONAMA 275, já ajustadas para contraste). Como o admin pode criar categorias
// novas, uma slug sem classe usa a `color` do back (hex): fundo claro + borda média +
// texto escurecido até ter contraste AA (4,5:1) com o fundo. Sem cor válida: cinza neutro.

import type { CSSProperties } from 'react'

/** Slugs com classe tag--<slug> em global.css. */
const SLUGS_COM_CLASSE = new Set([
  'papel-e-papelao',
  'plastico',
  'vidro',
  'metal',
  'pilhas-e-baterias',
  'oleo-de-cozinha',
  'eletronicos',
  'nao-reciclavel',
])

type Rgb = [number, number, number]

const BRANCO: Rgb = [255, 255, 255]
const PRETO: Rgb = [0, 0, 0]
const CONTRASTE_MINIMO = 4.5

/** Aceita #rgb ou #rrggbb (o back guarda texto livre de até 20 caracteres). */
export function lerHex(cor: string | null | undefined): Rgb | null {
  const texto = cor?.trim() ?? ''
  const curto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(texto)
  if (curto) return [curto[1], curto[2], curto[3]].map((c) => parseInt(c + c, 16)) as Rgb
  const longo = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(texto)
  if (longo) return [longo[1], longo[2], longo[3]].map((c) => parseInt(c, 16)) as Rgb
  return null
}

/** Mistura `quanto` (0 a 1) de `a` com o resto de `b`. */
function misturar(a: Rgb, b: Rgb, quanto: number): Rgb {
  return a.map((c, i) => Math.round(c * quanto + b[i] * (1 - quanto))) as Rgb
}

function luminancia([r, g, b]: Rgb): number {
  const canal = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

export function contraste(a: Rgb, b: Rgb): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

function paraHex(cor: Rgb): string {
  return `#${cor.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** Fundo, borda e texto a partir da cor do back (texto sempre com contraste AA). */
export function paletaDaCor(cor: Rgb): { fundo: string; borda: string; texto: string } {
  const fundo = misturar(cor, BRANCO, 0.14)
  let texto = cor
  for (let escurecer = 0.1; contraste(texto, fundo) < CONTRASTE_MINIMO && escurecer <= 1; escurecer += 0.1) {
    texto = misturar(PRETO, cor, escurecer)
  }
  let borda = misturar(cor, BRANCO, 0.5)
  // Cor muito clara (ex.: branco): escurece a borda para ela continuar visível.
  if (contraste(borda, BRANCO) < 1.4) borda = misturar(PRETO, borda, 0.25)
  return { fundo: paraHex(fundo), borda: paraHex(borda), texto: paraHex(texto) }
}

interface CategoriaComCor {
  slug: string
  cor: string | null
}

/**
 * Props (className + style) para pintar um elemento com a cor da categoria.
 * `classes` são as classes do elemento (ex.: 'tag', 'escolha__cor').
 * Ex.: <span {...propsCategoria(c, 'tag')}>{c.nome}</span>
 */
export function propsCategoria(
  categoria: CategoriaComCor,
  classes: string,
): { className: string; style?: CSSProperties } {
  if (SLUGS_COM_CLASSE.has(categoria.slug)) {
    return { className: `${classes} tag--${categoria.slug}` }
  }
  const rgb = lerHex(categoria.cor)
  if (!rgb) return { className: `${classes} tag--neutra` }
  const { fundo, borda, texto } = paletaDaCor(rgb)
  return { className: classes, style: { background: fundo, borderColor: borda, color: texto } }
}
