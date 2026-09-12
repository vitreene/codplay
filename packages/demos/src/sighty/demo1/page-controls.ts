import { createV2DemoTelco } from '../../v2/layout/telco'
import type { Demo1Runtime } from './sighty-composition'
import type { SightySlotName } from './sighty-file'

type Demo1LogLevel = 'info' | 'warn' | 'error'

type Demo1ControlsOptions = Readonly<{
  container: HTMLElement
  runtime: Demo1Runtime
  onLog: (message: string, level?: Demo1LogLevel) => void
}>

export type Demo1Controls = Readonly<{
  destroy: () => void
}>

/** Creates the page controls for the already-built demo 1 runtime. */
export function createDemo1Controls(options: Demo1ControlsOptions): Demo1Controls {
  const cleanups: Array<() => void> = []
  options.container.replaceChildren()
  options.container.className = 'sighty-demo__controls-grid'

  const lifecycle = document.createElement('section')
  lifecycle.className = 'sighty-control-panel sighty-control-panel--lifecycle'
  const heading = document.createElement('h3')
  heading.textContent = 'Composition'
  const description = document.createElement('p')
  description.textContent = 'Sighty conserve les handles de montage et pilote leur durée de vie.'
  const buttons = document.createElement('div')
  buttons.className = 'sighty-control-panel__buttons'
  buttons.append(createButton('Lire toutes les scènes', () => options.runtime.playAll(), options.onLog))

  for (const slotName of options.runtime.slotNames) {
    buttons.append(createMountToggleButton(slotName, options.runtime, options.onLog))
  }
  lifecycle.append(heading, description, buttons)
  options.container.append(lifecycle)

  for (const sceneKey of options.runtime.sceneKeys) {
    if (sceneKey === 'layout') continue
    const instance = options.runtime.getInstance(sceneKey)
    if (instance === undefined) continue
    const panel = document.createElement('section')
    panel.className = 'sighty-control-panel'
    const instanceHeading = document.createElement('h3')
    instanceHeading.textContent = `Instance ${instance.instanceId}`
    const remote = createV2DemoTelco(instance.telco, {
      onLog: (message, level) => options.onLog(`${sceneKey}: ${message}`, level),
    })
    panel.append(instanceHeading, remote.element)
    options.container.append(panel)
    cleanups.push(remote.destroy)
  }

  return {
    destroy: () => {
      for (const cleanup of cleanups.splice(0)) cleanup()
      options.container.replaceChildren()
      options.container.className = ''
    },
  }
}

/** Creates a page button that invokes one asynchronous or synchronous action. */
function createButton(
  label: string,
  action: () => void | Promise<void>,
  onLog: Demo1ControlsOptions['onLog'],
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'sighty-action-button'
  button.textContent = label
  button.addEventListener('click', () => {
    void Promise.resolve(action()).catch((error: unknown) => {
      onLog(error instanceof Error ? error.message : String(error), 'error')
    })
  })
  return button
}

/** Creates a page button that detaches or remounts one authored slot child. */
function createMountToggleButton(
  slotName: SightySlotName,
  runtime: Demo1Runtime,
  onLog: Demo1ControlsOptions['onLog'],
): HTMLButtonElement {
  const button = createButton('', () => {
    if (runtime.isSlotMounted(slotName)) {
      runtime.detachSlot(slotName)
      onLog(`slot ${slotName} démonté`)
    } else {
      runtime.mountSlot(slotName)
      onLog(`slot ${slotName} remonté`)
    }
    button.textContent = runtime.isSlotMounted(slotName) ? `Démonter ${slotName}` : `Remonter ${slotName}`
  }, onLog)
  button.textContent = `Démonter ${slotName}`
  return button
}
