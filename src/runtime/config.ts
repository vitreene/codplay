/**
 * Defines runtime-wide defaults shared by component implementations.
 */
export type RuntimeConfig = {
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
  list: {
    defaultTagName: 'section'
  },
  move: {
    rootToken: 'root'
  }
}
