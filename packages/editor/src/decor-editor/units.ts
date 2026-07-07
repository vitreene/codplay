/** cqw = 1% de la largeur du conteneur de référence, en px. */
export function pxToCqw(px: number, containerWidthPx: number): number {
  return (px / containerWidthPx) * 100
}

export function cqwToPx(cqw: number, containerWidthPx: number): number {
  return (cqw / 100) * containerWidthPx
}
