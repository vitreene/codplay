import type { SightyDemoRuntime, SightyDemoTransport } from './types'

type SightyTransportOptions<SceneKey extends string> = Readonly<{
  /** Selects the occurrences controlled by the shared play/pause transport. */
  commandSceneKeys?: () => readonly SceneKey[]
}>

/** Creates transport commands for selected runtime occurrences. */
export function createSightyTransport<SceneKey extends string, SlotName extends string>(
  runtime: SightyDemoRuntime<SceneKey, SlotName>,
  options: SightyTransportOptions<SceneKey> = {},
): SightyDemoTransport {
  const selectCommandSceneKeys = (): readonly SceneKey[] => options.commandSceneKeys?.() ?? runtime.sceneKeys
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
