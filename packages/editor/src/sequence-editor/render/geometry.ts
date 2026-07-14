import type { MachineViewport } from '../machine'
import type { LayoutProfile } from '../types'

/**
 * Marge fixe ajoutée à toute conversion temps→pixel, pour qu'un keyframe/playhead/marqueur à
 * `timeMs === viewport.startMs` (typiquement 0) reste entièrement visible/cliquable — sans elle,
 * un losange centré sur `x=0` (`keyframe-handle.ts`) a la moitié de sa surface en x négatif, hors
 * du SVG, invisible et non cliquable. Même famille de bug sur la tête du playhead
 * (`playhead-line.ts`) et le drapeau de marqueur (`marker-row.ts`) en bordure.
 *
 * `6` reprend la demi-largeur déjà codée en dur de la tête de playhead (`±6px`, laissée telle
 * quelle) comme borne basse — la plus grande des deux marges gagne, jamais dupliquée sous un
 * nouveau champ `LayoutProfile`.
 */
export function renderMarginPx(layoutProfile: LayoutProfile): number {
  return Math.max(layoutProfile.keyframeHandleSizePx / 2, 6)
}

export function timeToPixel(timeMs: number, viewport: MachineViewport, layoutProfile: LayoutProfile): number {
  return (timeMs - viewport.startMs) * viewport.pixelsPerMs + renderMarginPx(layoutProfile)
}

export function pixelToTime(px: number, viewport: MachineViewport, layoutProfile: LayoutProfile): number {
  return viewport.startMs + (px - renderMarginPx(layoutProfile)) / viewport.pixelsPerMs
}
