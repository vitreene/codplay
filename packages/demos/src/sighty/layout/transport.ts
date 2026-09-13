import type { CodPlayTelco } from 'codplay'
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
    play: () => playRuntime(runtime, selectCommandSceneKeys()),
    pause: () => pauseRuntime(runtime, selectCommandSceneKeys()),
    relaunch: () => relaunchRuntime(runtime, selectCommandSceneKeys()),
  }
}

/** Creates the same three transport commands for one CodPlay occurrence. */
export function createSightyInstanceTransport(telco: CodPlayTelco): SightyDemoTransport {
  return {
    play: () => telco.play(),
    pause: () => telco.pause(),
    relaunch: async () => {
      await telco.rewind()
      await telco.play()
    },
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

/** Starts the selected scene occurrences in their authored runtime. */
async function playRuntime<SceneKey extends string, SlotName extends string>(
  runtime: SightyDemoRuntime<SceneKey, SlotName>,
  sceneKeys: readonly SceneKey[],
): Promise<void> {
  for (const sceneKey of sceneKeys) await runtime.play(sceneKey)
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
  await playRuntime(runtime, sceneKeys)
}
