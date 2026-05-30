import { createS5DragScene, s5DragStraps } from '../scenes'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Mounts the drag-and-drop capture demo through the CodPlay public surface.
 */
export async function runDragDemo(): Promise<void> {
	await runCodPlaySceneDemo({
		title: 'Drag & Capture',
		subtitle: 'Déplacement via capture de session pointer. Cliquer Play avant de dragger pour que le seek rejoue l\'animation de substitution.',
		scene: createS5DragScene(),
		strapCollection: s5DragStraps,
		rootNodeIds: ['draggable'],
		demoLinks: [
			{ label: 'Player POC', href: '?demo=poc' },
			{ label: 'CodPlay POC', href: '?demo=codplay-poc' },
			{ label: 'Quiz Reference', href: '?demo=quiz' },
			{ label: 'Drag & Capture', href: '?demo=drag', active: true },
		],
	})
}
