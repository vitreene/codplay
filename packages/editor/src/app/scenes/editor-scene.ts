import type { EditorScene } from '../commands/types'
import { ROOT_PLACEMENT_GRID } from '../commands/root-placement-commands'

/** Creates an empty document using the current EditorScene model. */
export function createEmptyEditorScene(title = 'Nouvelle scène'): EditorScene {
  return {
    id: `editor-scene-${crypto.randomUUID()}`,
    meta: {
      title,
      durationMs: 5000,
      durationSource: 'arbitrary',
      timeUnit: 's',
      capsuleOrder: 'forward',
    },
    items: [],
    contents: {},
    decors: {},
    zones: {},
    markerTracks: {},
    rootCapsule: {
      kind: 'card',
      distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
      grid: { ...ROOT_PLACEMENT_GRID['fine-grid'] },
    },
  }
}
