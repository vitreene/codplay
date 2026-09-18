/** Runtime namespace loaded by the engine-scoped Three.js library definition. */
export type ThreeRuntime = typeof import('three')

/** Owns one integration-local reference to the prepared Three.js namespace. */
export type ThreeRuntimeAccess = Readonly<{
  load: () => Promise<void>
  release: () => void
  require: () => ThreeRuntime
}>

/** Creates a private Three.js namespace holder for one engine integration. */
export function createThreeRuntimeAccess(): ThreeRuntimeAccess {
  let runtime: ThreeRuntime | undefined

  return {
    load: async () => {
      runtime ??= await import('three')
    },
    release: () => {
      runtime = undefined
    },
    require: () => {
      if (runtime === undefined) {
        throw new Error('Three.js has not been prepared by the CodPlay engine.')
      }
      return runtime
    },
  }
}
