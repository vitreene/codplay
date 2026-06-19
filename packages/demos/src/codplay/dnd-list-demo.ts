import { createS6DndListScene, s6Straps } from '../scenes'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Mounts the drag-and-drop list scene through the CodPlay public surface.
 */
export async function runDndListDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Drag & Drop listes',
    subtitle: 'Déplacer les items entre les listes A et B. Les compteurs se mettent à jour à chaque drop.',
    scene: createS6DndListScene(),
    strapCollection: s6Straps,
    activeDemo: 'dnd-list',
  })
}
