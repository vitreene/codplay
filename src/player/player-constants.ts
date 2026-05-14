export const PLAYER_STATUS = {
  idle: 'idle',
  preloading: 'preloading',
  ready: 'ready',
  playing: 'playing',
  paused: 'paused',
  seeking: 'seeking',
  rewinding: 'rewinding',
  error: 'error'
} as const

export const PLAYER_RUNTIME_DEFAULTS = {
  storyMinDurationMs: 1000
} as const
