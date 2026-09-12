import type { CodPlayTelco } from 'codplay'
import type { SightyDemoRuntime, SightyDemoTransport } from './types'

/** Creates transport commands that address every scene occurrence of a runtime. */
export function createSightyTransport<SceneKey extends string, SlotName extends string>(
  runtime: SightyDemoRuntime<SceneKey, SlotName>,
): SightyDemoTransport {
  return {
    play: () => runtime.playAll(),
    pause: () => pauseRuntime(runtime),
    relaunch: () => relaunchRuntime(runtime),
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
): Promise<void> {
  for (const sceneKey of runtime.sceneKeys) {
    const instance = runtime.getInstance(sceneKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    await instance.telco.pause()
  }
}

/** Rewinds every scene, then restarts the complete authored runtime. */
async function relaunchRuntime<SceneKey extends string, SlotName extends string>(
  runtime: SightyDemoRuntime<SceneKey, SlotName>,
): Promise<void> {
  for (const sceneKey of runtime.sceneKeys) {
    const instance = runtime.getInstance(sceneKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    await instance.telco.rewind()
  }
  await runtime.playAll()
}
