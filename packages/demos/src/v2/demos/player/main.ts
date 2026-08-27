export {
  createPreloadMediaScene as createScene,
  PRELOAD_MEDIA_RESOURCE_MANIFEST as preloadManifest,
  PRELOAD_MEDIA_SCENE_END_MS,
} from './preload-media-scene'

/** Keeps unavailable media non-blocking while preserving the real preload path. */
export const preloadMode = 'broadcast' as const
