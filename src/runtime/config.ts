/**
 * Defines runtime-wide defaults shared by component implementations.
 */
export type RuntimeConfig = {
  text: {
    defaultTagName: string
  }
  image: {
    defaultFitMode: 'wallpaper' | 'sprite'
  }
  list: {
    defaultTagName: string
  }
  move: {
    rootToken: string
  }
}

/**
 * Provides the runtime default configuration for V1.
 */
export const RUNTIME_CONFIG: RuntimeConfig = {
  text: {
    defaultTagName: 'p'
  },
  image: {
    defaultFitMode: 'wallpaper'
  },
  list: {
    defaultTagName: 'section'
  },
  move: {
    rootToken: 'root'
  }
}
