import type { EditorScene } from '../commands/types'

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
  }
}
