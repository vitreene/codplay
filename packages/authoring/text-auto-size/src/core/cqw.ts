/**
 * Conversion px ↔ cqw par règle de 3 simple, ancrée sur la largeur de conteneur au moment
 * du calcul (§3.3, §4 de la spec) — même mécanique que le pont position de dedit, pas de
 * nouvelle mécanique de conversion introduite ici.
 */

export function pxToCqw(px: number, referenceWidthPx: number): number {
  return (px / referenceWidthPx) * 100
}

export function cqwToPx(cqw: number, referenceWidthPx: number): number {
  return (cqw / 100) * referenceWidthPx
}
