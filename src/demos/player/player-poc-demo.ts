import { createPlayerPocScene, playerPocRootNodeIds } from '../scenes'
import { runPlayerSceneDemo } from './run-player-scene-demo'

/**
 * Mounts the runtime player proof-of-concept demo in the root app node.
 */
export async function runPlayerPocDemo(): Promise<void> {
	await runPlayerSceneDemo({
		title: 'Player POC',
		subtitle: "Cas dur: inserts, puis retour de tous les items vers l'origine; la list cible derive et tourne.",
		scene: createPlayerPocScene(),
		rootNodeIds: playerPocRootNodeIds,
		demoLinks: [
			{ label: 'Player POC', href: '?demo=poc', active: true },
			{ label: 'CodPlay POC', href: '?demo=codplay-poc' },
			{ label: 'Quiz Reference', href: '?demo=quiz' },
			{ label: 'Drag & Capture', href: '?demo=drag' },
		],
	})
}
