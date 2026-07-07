import type { FontSpec, FontStretchKeyword } from './core/measure'
import type { TextAutoSizeMode } from './core/search-font-size'

export interface TextAutoSizeInput {
  text: string
  font: FontSpec
  blockWidthCqw: number
  blockHeightCqw: number
  /** Largeur du conteneur au moment de la mesure, pour conversion cqw (§3.3, §4). */
  referenceWidthPx: number
  /** Seuil de lisibilité (§4) — config, 9 par défaut (`DEFAULT_MIN_READABLE_SIZE_PX`). */
  minReadableSizePx?: number
  /** Seuil de longueur (§2) — config, 30 par défaut (`DEFAULT_SINGLE_LINE_MAX_CHARS`). */
  singleLineMaxChars?: number
  /** Marge de sécurité (§3.2) — config, 0.02 par défaut (`DEFAULT_FIT_SAFETY_MARGIN`). */
  fitSafetyMargin?: number
}

export type { TextAutoSizeMode, FontStretchKeyword }

export interface TextAutoSizeResult {
  mode: TextAutoSizeMode
  fontSizeCqw: number
  /** Toujours 1.2 — constante forcée tant que le calcul est actif (§5.1). */
  lineHeight: 1.2
  /**
   * `normal` sauf en mono/multi-ligne avec de la largeur inoccupée (§2.3) : élargit l'axe
   * `wdth` d'une police variable pour mieux occuper le bloc, une fois la taille figée.
   */
  fontStretch: FontStretchKeyword
}
