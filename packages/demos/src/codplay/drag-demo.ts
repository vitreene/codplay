import { createS5DragScene } from '../scenes'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Mounts the drag-and-drop capture demo through the CodPlay public surface.
 */
export async function runDragDemo(): Promise<void> {
	await runCodPlaySceneDemo({
		title: 'Drag & Capture',
		subtitle: "Déplacement via capture de session pointer. Cliquer Play avant de dragger pour que le seek rejoue l'animation de substitution.",
		scene: createS5DragScene(),
		activeDemo: 'drag',
	})
}
