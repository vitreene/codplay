import { describe, expect, it } from 'vitest'

import { resolveSceneSeekMaxMs } from '@codplay/demos/shared/resolve-scene-seek-max-ms'
import type { SceneDoc } from '../../src/player/types'

/**
 * Builds one minimal scene fixture for seek-horizon tests.
 */
function createSceneFixture(input: {
	tracks: Record<string, unknown>
	stories: SceneDoc['stories']
}): SceneDoc {
	return {
		id: 'scene-seek-max-fixture',
		initial: undefined,
		straps: undefined,
		listen: [],
		stories: input.stories,
		tracks: input.tracks
	}
}

describe('resolveSceneSeekMaxMs', () => {
	it('ignores non-master tracks when a master track exists', () => {
		const scene = createSceneFixture({
			tracks: {
				'master-track': { role: 'master' },
				'decor-track': { role: 'support' }
			},
			stories: {
				'master-story': {
					id: 'master-story',
					initial: undefined,
					persos: [],
					straps: undefined,
					listen: [],
					trackId: 'master-track',
					eventimes: [{ name: 'master:event', startAt: 1200 }]
				},
				'decor-story': {
					id: 'decor-story',
					initial: undefined,
					persos: [],
					straps: undefined,
					listen: [],
					trackId: 'decor-track',
					eventimes: [{ name: 'decor:event', startAt: 6000 }]
				}
			}
		})

		expect(resolveSceneSeekMaxMs(scene)).toBe(1200)
	})

	it('keeps all tracks when there is no master track', () => {
		const scene = createSceneFixture({
			tracks: {
				'left-track': { role: 'story' },
				'right-track': { role: 'support' }
			},
			stories: {
				'left-story': {
					id: 'left-story',
					initial: undefined,
					persos: [],
					straps: undefined,
					listen: [],
					trackId: 'left-track',
					eventimes: [{ name: 'left:event', startAt: 1500 }]
				},
				'right-story': {
					id: 'right-story',
					initial: undefined,
					persos: [],
					straps: undefined,
					listen: [],
					trackId: 'right-track',
					eventimes: [{ name: 'right:event', startAt: 4200 }]
				}
			}
		})

		expect(resolveSceneSeekMaxMs(scene)).toBe(4200)
	})
})
