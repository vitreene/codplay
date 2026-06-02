import { createPlayerPocScene, playerPocRootNodeIds } from '../scenes'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Mounts the move proof-of-concept demo through the CodPlay public surface.
 */
export async function runCodPlayPocDemo(): Promise<void> {
	await runCodPlaySceneDemo({
		title: 'CodPlay POC',
		subtitle:
			"Meme cas dur que Player POC, compile puis joue via CodPlay; tout ecart sur le move est une regression.",
		scene: createPlayerPocScene(),
		rootNodeIds: playerPocRootNodeIds,
		activeDemo: 'codplay-poc',
	})
}
