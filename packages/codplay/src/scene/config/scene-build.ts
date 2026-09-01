/** Structural constants used by deterministic scene derivations. */
export const SCENE_BUILD_CONFIG = {
  rootToken: '@root',
  detachToken: '@off',
  schemaVersion: 'codplay.v2.scene.v1',
  /** Logical unit used for structured numeric geometry at the compilation boundary. */
  logicalLengthUnit: 'cqw',
  resourceTypeByExtension: {
    '.mp4': 'video',
    '.webm': 'video',
    '.ogv': 'video',
    '.mp3': 'audio',
    '.wav': 'audio',
    '.ogg': 'audio',
    '.aac': 'audio',
    '.png': 'image',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.webp': 'image',
    '.gif': 'image',
    '.svg': 'image',
    '.avif': 'image',
    '.woff': 'font',
    '.woff2': 'font',
    '.ttf': 'font',
    '.otf': 'font',
    '.css': 'css',
  },
} as const

/** Configured logical unit used by the compiled length contract. */
export type LogicalLengthUnit = typeof SCENE_BUILD_CONFIG.logicalLengthUnit
