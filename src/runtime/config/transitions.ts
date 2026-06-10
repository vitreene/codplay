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

export type ReplaceTransitionDef = {
  durationMs: number
  intro: Record<string, { from?: number | string; to: number | string }>
  outro: Record<string, { from?: number | string; to: number | string }>
  ease?: string
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
}
