/**
 * Catalogue des transitions replace simples (élément unique).
 *
 * Point d'entrée auteur : ce fichier peut être complété librement.
 * Format : intro = animation d'apparition, outro = animation de disparition.
 * Les propriétés suivent la convention anime.js (x, y, opacity, scale…).
 *
 * Source de référence : https://kawai-text-animation.pages.dev
 * Chaque transition a été validée avant d'être ajoutée au catalogue.
 */

/**
 * Configuration du rendu « machine à sous » (slot) pour les transitions split texte.
 * Quand `slot` est défini sur une transition utilisée avec `split: "letter"|"word"|"line"`,
 * le module emprunte le chemin de rendu `apply-slot-text` (rouleau vertical clippé)
 * au lieu du fondu + glissement de `apply-split-text`.
 */
export type SlotConfig = {
  /** up = le nouveau glyphe entre par le bas, l'ancien sort par le haut. */
  axis: 'up' | 'down'
  /**
   * Amplitude du wobble déterministe par caractère (0..1). Défaut 0 = timing régulier
   * (durée uniforme, stagger linéaire, faces synchronisées). > 0 réintroduit la
   * variation de durée/délai par glyphe à la slot-text.
   */
  bounce?: number
  /** Flash chromatique : chaque glyphe entrant est teinté puis revient à la couleur de repos. */
  chroma?: boolean
}

export type ReplaceTransitionDef = {
  durationMs: number
  intro: Record<string, { from?: number | string; to: number | string }>
  outro: Record<string, { from?: number | string; to: number | string }>
  ease?: string
  slot?: SlotConfig
}

export const REPLACE_TRANSITIONS: Record<string, ReplaceTransitionDef> = {
  fade: {
    durationMs: 300,
    intro: { opacity: { from: 0, to: 1 } },
    outro: { opacity: { to: 0 } },
  },
  'swipe-left': {
    durationMs: 300,
    intro: { opacity: { from: 0, to: 1 }, x: { from: -40, to: 0 } },
    outro: { opacity: { to: 0 }, x: { to: -40 } },
  },
  'swipe-right': {
    durationMs: 300,
    intro: { opacity: { from: 0, to: 1 }, x: { from: 40, to: 0 } },
    outro: { opacity: { to: 0 }, x: { to: 40 } },
  },
  'swipe-up': {
    durationMs: 300,
    intro: { opacity: { from: 0, to: 1 }, y: { from: -40, to: 0 } },
    outro: { opacity: { to: 0 }, y: { to: -40 } },
  },
  'swipe-down': {
    durationMs: 300,
    intro: { opacity: { from: 0, to: 1 }, y: { from: 40, to: 0 } },
    outro: { opacity: { to: 0 }, y: { to: 40 } },
  },
  zoom: {
    durationMs: 300,
    intro: { opacity: { from: 0, to: 1 }, scale: { from: 0.8, to: 1 } },
    outro: { opacity: { to: 0 }, scale: { to: 1.2 } },
  },
  'zoom-out': {
    durationMs: 300,
    intro: { opacity: { from: 0, to: 1 }, scale: { from: 1.2, to: 1 } },
    outro: { opacity: { to: 0 }, scale: { to: 0.8 } },
  },
  // ── Rouleau vertical « machine à sous » (avec split: "letter"|"word"|"line") ──
  // Adaptation de https://github.com/Danilaa1/slot-text
  // intro/outro = repli gracieux (fondu vertical) si utilisé sans split.
  'slot-up': {
    durationMs: 500,
    ease: 'outBack',
    slot: { axis: 'up', bounce: 0, chroma: true },
    intro: { opacity: { from: 0, to: 1 }, y: { from: 40, to: 0 } },
    outro: { opacity: { to: 0 }, y: { to: -40 } },
  },
  'slot-down': {
    durationMs: 500,
    ease: 'outBack',
    slot: { axis: 'down', bounce: 0, chroma: true },
    intro: { opacity: { from: 0, to: 1 }, y: { from: -40, to: 0 } },
    outro: { opacity: { to: 0 }, y: { to: 40 } },
  },
}
