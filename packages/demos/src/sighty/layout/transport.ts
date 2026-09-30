import type { SightyDemoRuntime, SightyDemoTransport } from './types'

/** Creates transport commands for the occurrences selected by the runtime. */
export function createSightyTransport<SceneKey extends string, SlotName extends string>(
  runtime: SightyDemoRuntime<SceneKey, SlotName>,
): SightyDemoTransport {
  const selectCommandSceneKeys = (): readonly SceneKey[] => {
    const activeSceneKeys = new Set(runtime.scenarioState.current.map((selection) => selection.sceneKey))

    // The layout scene owns the root and is intentionally absent from
    // scenarioState.current, which lists slot selections. The runtime's live
    // instance lookup adds that root occurrence without maintaining a demo
    // specific scene catalogue.
    for (const sceneKey of runtime.sceneKeys) {
      if (runtime.getInstance(sceneKey) !== undefined) activeSceneKeys.add(sceneKey)
    }

    return runtime.sceneKeys.filter((sceneKey) => activeSceneKeys.has(sceneKey))
  }
  return {
    play: () => runtime.playAll(selectCommandSceneKeys()),
    pause: () => pauseRuntime(runtime, selectCommandSceneKeys()),
    relaunch: () => relaunchRuntime(runtime, selectCommandSceneKeys()),
  }
}

/** Pauses every initialized scene in the authored runtime order. */
async function pauseRuntime<SceneKey extends string, SlotName extends string>(
  runtime: SightyDemoRuntime<SceneKey, SlotName>,
  sceneKeys: readonly SceneKey[],
): Promise<void> {
  for (const sceneKey of sceneKeys) {
    const instance = runtime.getInstance(sceneKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    await instance.telco.pause()
  }
}

/** Rewinds the selected scenes, then restarts those occurrences. */
async function relaunchRuntime<SceneKey extends string, SlotName extends string>(
  runtime: SightyDemoRuntime<SceneKey, SlotName>,
  sceneKeys: readonly SceneKey[],
): Promise<void> {
  for (const sceneKey of sceneKeys) {
    const instance = runtime.getInstance(sceneKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    await instance.telco.rewind()
  }
  await runtime.playAll(sceneKeys)
}
