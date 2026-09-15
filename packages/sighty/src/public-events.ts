import type { CodPlayPublicEvent } from 'codplay'

/** Describes one event that Sighty makes visible to its host application. */
export type SightyPublicEvent<SceneKey extends string = string> = Readonly<{
  name: string
  sourceSceneKey?: SceneKey
  data?: CodPlayPublicEvent['data']
}>

/** Receives one event published by the Sighty runtime. */
export type SightyPublicEventListener<SceneKey extends string = string> = (
  event: SightyPublicEvent<SceneKey>,
) => void

/** Exposes the host-facing event observation surface. */
export type SightyPublicEvents<SceneKey extends string = string> = Readonly<{
  onEvent: (listener: SightyPublicEventListener<SceneKey>) => () => void
}>

/** Creates one event channel with a public subscription surface and private publication. */
export function createSightyPublicEventChannel<SceneKey extends string = string>(): {
  readonly api: SightyPublicEvents<SceneKey>
  publish: (event: SightyPublicEvent<SceneKey>) => readonly unknown[]
  clear: () => void
} {
  const listeners = new Set<SightyPublicEventListener<SceneKey>>()
  const api: SightyPublicEvents<SceneKey> = {
    onEvent: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  return {
    api,
    publish: (event) => {
      const errors: unknown[] = []
      for (const listener of [...listeners]) {
        try {
          listener(event)
        } catch (error: unknown) {
          errors.push(error)
        }
      }
      return errors
    },
    clear: () => listeners.clear(),
  }
}
