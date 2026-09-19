import type { RuntimePreloadStrategy } from 'codplay'
import { preloadAvatar3DModel } from '@codplay/avatar-engine'

/** Preloads one GLB into the Avatar model cache used by each component instance. */
export const preloadAvatarModel: RuntimePreloadStrategy = async (url, signal) => {
  if (signal.aborted) throw new Error('Avatar resource preload aborted.')
  await preloadAvatar3DModel(url)
}

/** Strategy table consumed by the shared V2 preload service. */
export const AVATAR_PRELOAD_STRATEGIES: Readonly<Record<string, RuntimePreloadStrategy>> = {
  'avatar-glb': preloadAvatarModel,
}

