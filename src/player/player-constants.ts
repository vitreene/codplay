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

export const PLAYER_SEQUENCE_EVENT = {
  sceneReady: 'scene:ready',
  sceneStart: 'scene:start',
  sceneEnd: 'scene:end',
  sequenceEnd: 'sequence:end'
} as const

export const PLAYER_RUNTIME_EVENT = {
  stateUpdate: 'runtime:state:update'
} as const
