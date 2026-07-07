import type { FontSpec, MeasureLine } from './measure'

/** Retour à la ligne standard (glouton, mot par mot) à l'intérieur d'un paragraphe. */
function wrapParagraph(
  paragraph: string,
  fontSizePx: number,
  font: FontSpec,
  maxWidthPx: number,
  measure: MeasureLine,
): string[] {
  const words = paragraph.split(/\s+/).filter(word => word.length > 0)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let currentLine = words[0]!

  for (let i = 1; i < words.length; i++) {
    const candidate = `${currentLine} ${words[i]}`
    const width = measure({ text: candidate, fontSizePx, font, fontStretch: 'normal' }).widthPx
    if (width <= maxWidthPx) {
      currentLine = candidate
    } else {
      lines.push(currentLine)
      currentLine = words[i]!
    }
  }
  lines.push(currentLine)

  return lines
}

/**
 * Lignes occupées par `text` à `fontSizePx`, dans une largeur `maxWidthPx` — toujours au
 * palier `font-stretch: normal` (le retour à la ligne est décidé une fois pour toutes à ce
 * palier ; l'élargissement ultérieur de l'axe width, § 2.3, réutilise ces mêmes lignes sans
 * les re-découper). Les retours à la ligne explicites (`\n`, saisis par l'utilisateur)
 * délimitent des paragraphes indépendants, chacun retour-à-la-ligné séparément (§8).
 */
export function wrapLines(
  text: string,
  fontSizePx: number,
  font: FontSpec,
  maxWidthPx: number,
  measure: MeasureLine,
): string[] {
  return text
    .split('\n')
    .flatMap(paragraph => wrapParagraph(paragraph, fontSizePx, font, maxWidthPx, measure))
}

/** Nombre de lignes — cf `wrapLines`. */
export function wrapLineCount(
  text: string,
  fontSizePx: number,
  font: FontSpec,
  maxWidthPx: number,
  measure: MeasureLine,
): number {
  return wrapLines(text, fontSizePx, font, maxWidthPx, measure).length
}
