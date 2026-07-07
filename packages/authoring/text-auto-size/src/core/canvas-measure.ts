import type { FontSpec, MeasureLine } from './measure'

function buildFontShorthand(font: FontSpec, fontSizePx: number): string {
  const style = font.style === 'italic' ? 'italic ' : ''
  return `${style}${font.weight} ${fontSizePx}px ${font.family}`
}

/**
 * Environnement de mesure hors-écran (§3.1) : `OffscreenCanvas`
 * (https://developer.mozilla.org/fr/docs/Web/API/OffscreenCanvas) — jamais rattaché au DOM,
 * contrairement à un `<canvas>` créé puis laissé détaché. Les dimensions n'ont pas
 * d'importance (`measureText` ne dépend pas de la taille du support). Suppose la fonte
 * déjà chargée (`document.fonts`) — précondition de l'appelant (dedit ou builder), pas de
 * cette fonction (§8).
 */
export function createCanvasMeasureLine(): MeasureLine {
  const canvas = new OffscreenCanvas(1, 1)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('text-auto-size: impossible de créer un contexte OffscreenCanvas 2D pour la mesure')
  }

  return ({ text, fontSizePx, font, fontStretch }) => {
    ctx.font = buildFontShorthand(font, fontSizePx)
    // Pilote l'axe `wdth` d'une police variable (ex. Advent Pro) — propriété distincte du
    // raccourci `font`, seuls les 9 mots-clés standard sont acceptés (vérifié directement,
    // pas de pourcentage libre). Absente silencieusement sur les navigateurs qui ne la
    // supportent pas encore (dégradation gracieuse, cf § 3.1).
    ctx.fontStretch = fontStretch
    return { widthPx: ctx.measureText(text).width }
  }
}
