/** Réglages typo pris en compte par la mesure (§8 de la spec) — affectent les métriques de glyphe. */
export interface FontSpec {
  family: string
  weight: string | number
  style?: 'normal' | 'italic'
}

/**
 * Mots-clés `font-stretch` — seuls paliers mesurables de façon fiable (§2.3) : la propriété
 * canvas `fontStretch` n'accepte que ces 9 valeurs standard, jamais un pourcentage libre,
 * vérifié directement (pas une supposition). Correspondance : ultra-condensed 50%,
 * extra-condensed 62.5%, condensed 75%, semi-condensed 87.5%, normal 100%,
 * semi-expanded 112.5%, expanded 125%, extra-expanded 150%, ultra-expanded 200%.
 */
export type FontStretchKeyword =
  | 'ultra-condensed' | 'extra-condensed' | 'condensed' | 'semi-condensed'
  | 'normal'
  | 'semi-expanded' | 'expanded' | 'extra-expanded' | 'ultra-expanded'

export interface MeasureLineInput {
  text: string
  fontSizePx: number
  font: FontSpec
  fontStretch: FontStretchKeyword
}

export interface MeasuredLine {
  widthPx: number
}

/**
 * Contrat de mesure d'une ligne de texte à une taille de police donnée. L'implémentation
 * réelle (canvas hors-écran, cf `canvas-measure.ts`) est un détail interne : les fonctions
 * de `core/` ne connaissent que ce contrat, jamais le DOM — testables avec une mesure factice.
 */
export type MeasureLine = (input: MeasureLineInput) => MeasuredLine
