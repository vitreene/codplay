import { DEFAULT_FIT_SAFETY_MARGIN, DEFAULT_SINGLE_LINE_MAX_CHARS, FONT_STRETCH_STEPS, FORCED_LINE_HEIGHT } from '../config'
import { wrapLineCount, wrapLines } from './wrap-lines'
import type { FontSpec, FontStretchKeyword, MeasureLine } from './measure'

export type TextAutoSizeMode = 'single-line' | 'multi-line' | 'scroll'

export interface SearchFontSizeInput {
  text: string
  font: FontSpec
  blockWidthPx: number
  blockHeightPx: number
  minSizePx: number
  measure: MeasureLine
  /** Seuil de longueur (§2) — config, 30 par défaut (`DEFAULT_SINGLE_LINE_MAX_CHARS`). */
  singleLineMaxChars?: number
  /** Marge de sécurité (§3.2) — config, 0.02 par défaut (`DEFAULT_FIT_SAFETY_MARGIN`). */
  fitSafetyMargin?: number
}

export interface SearchFontSizeResult {
  mode: TextAutoSizeMode
  fontSizePx: number
  /** `normal` sauf en mono/multi-ligne avec de la largeur inoccupée (§2.3). */
  fontStretch: FontStretchKeyword
}

const SEARCH_ITERATIONS = 20

function fitsSingleLine(
  text: string,
  fontSizePx: number,
  font: FontSpec,
  blockWidthPx: number,
  measure: MeasureLine,
): boolean {
  if (text.includes('\n')) return false
  return measure({ text, fontSizePx, font, fontStretch: 'normal' }).widthPx <= blockWidthPx
}

function fitsMultiLine(
  text: string,
  fontSizePx: number,
  font: FontSpec,
  blockWidthPx: number,
  blockHeightPx: number,
  measure: MeasureLine,
): boolean {
  const lineCount = wrapLineCount(text, fontSizePx, font, blockWidthPx, measure)
  return lineCount * fontSizePx * FORCED_LINE_HEIGHT <= blockHeightPx
}

/**
 * Élargit l'axe width (§2.3) une fois la taille figée : occupe davantage l'espace
 * disponible en largeur quand il en reste (typiquement quand c'est la HAUTEUR, pas la
 * largeur, qui a limité la taille de police). Les lignes elles-mêmes (retours à la ligne)
 * ne sont jamais recalculées à un palier plus large — seulement revérifiées.
 */
function widenFontStretch(
  lines: string[],
  fontSizePx: number,
  font: FontSpec,
  effectiveWidthPx: number,
  measure: MeasureLine,
): FontStretchKeyword {
  const fitsAtStretch = (fontStretch: FontStretchKeyword) =>
    lines.every(line => measure({ text: line, fontSizePx, font, fontStretch }).widthPx <= effectiveWidthPx)

  let widest: FontStretchKeyword = 'normal'
  for (const step of FONT_STRETCH_STEPS) {
    if (!fitsAtStretch(step)) break
    widest = step
  }
  return widest
}

/** Recherche binaire de la plus grande taille satisfaisant `fits`, entre `minSizePx` et `maxSizePx`. */
function binarySearchMaxSize(minSizePx: number, maxSizePx: number, fits: (sizePx: number) => boolean): number | null {
  if (maxSizePx < minSizePx || !fits(minSizePx)) return null

  let low = minSizePx
  let high = maxSizePx
  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    const mid = (low + high) / 2
    if (fits(mid)) {
      low = mid
    } else {
      high = mid
    }
  }
  return low
}

/**
 * Recherche (§2) : essaie mono-ligne (texte court, sous le seuil de longueur), puis
 * multi-ligne, puis se rabat sur le scroll si même la taille minimale de lisibilité ne
 * tient pas dans le bloc.
 */
export function searchFontSizePx(input: SearchFontSizeInput): SearchFontSizeResult {
  const {
    text, font, blockWidthPx, blockHeightPx, minSizePx, measure,
    singleLineMaxChars = DEFAULT_SINGLE_LINE_MAX_CHARS,
    fitSafetyMargin = DEFAULT_FIT_SAFETY_MARGIN,
  } = input

  // Marge de sécurité (§3.2) : la mesure hors-écran et le rendu réel du DOM ne produisent
  // jamais une largeur/hauteur rigoureusement identique pour un même texte — chercher la
  // frontière EXACTE mesurée risquerait de déborder de quelques px une fois réellement
  // rendu. On cherche donc le clamp contre un bloc légèrement réduit.
  const effectiveWidthPx = blockWidthPx * (1 - fitSafetyMargin)
  const effectiveHeightPx = blockHeightPx * (1 - fitSafetyMargin)

  // Plus grande taille pour laquelle une seule ligne tiendrait encore dans la hauteur du
  // bloc — borne de recherche commune aux deux essais (mono-ligne et multi-ligne).
  const maxSizeByHeight = effectiveHeightPx / FORCED_LINE_HEIGHT

  // Au-delà du seuil de longueur, le mono-ligne n'est même pas tenté — quelle que soit la
  // largeur du bloc, un texte trop long sur une seule ligne n'est pas souhaitable (§2).
  if (text.length <= singleLineMaxChars) {
    const singleLineSize = binarySearchMaxSize(minSizePx, maxSizeByHeight, size =>
      fitsSingleLine(text, size, font, effectiveWidthPx, measure),
    )
    if (singleLineSize !== null) {
      const fontStretch = widenFontStretch([text], singleLineSize, font, effectiveWidthPx, measure)
      return { mode: 'single-line', fontSizePx: singleLineSize, fontStretch }
    }
  }

  const multiLineSize = binarySearchMaxSize(minSizePx, maxSizeByHeight, size =>
    fitsMultiLine(text, size, font, effectiveWidthPx, effectiveHeightPx, measure),
  )
  if (multiLineSize !== null) {
    const lines = wrapLines(text, multiLineSize, font, effectiveWidthPx, measure)
    const fontStretch = widenFontStretch(lines, multiLineSize, font, effectiveWidthPx, measure)
    return { mode: 'multi-line', fontSizePx: multiLineSize, fontStretch }
  }

  return { mode: 'scroll', fontSizePx: minSizePx, fontStretch: 'normal' }
}
