import './style.css'

type SceneInstance = Readonly<{
  instanceId: string
  telco: Readonly<{
    play: () => Promise<unknown>
    pause: () => Promise<unknown>
    seek: (timeMs: number) => Promise<unknown>
    getState: () => Readonly<{ status: string }>
    getProgress: () => Readonly<{ timelineMs: number; durationMs: number }>
  }>
  diagnostic: Readonly<{
    onDiagnostic: (listener: (diagnostic: unknown) => void) => () => void
  }>
}>

type CodPlayOwner = Readonly<{
  load: (scenePath: string, options: { root: HTMLElement | string }) => Promise<SceneInstance>
  instances: Readonly<{ destroy: (instanceId: string) => void }>
  destroy: () => void
}>

/** Loads two occurrences of the exported V2 scene through one CodPlay owner. */
async function mountSceneExportDemo(): Promise<void> {
  const rootA = requireElement<HTMLElement>('#scene-root-a')
  const rootB = requireElement<HTMLElement>('#scene-root-b')
  const pageStatus = requireElement<HTMLElement>('#scene-export-status')
  const statusA = requireElement<HTMLElement>('#scene-export-instance-a-status')
  const statusB = requireElement<HTMLElement>('#scene-export-instance-b-status')
  const playButton = requireElement<HTMLButtonElement>('#scene-export-play')
  const pauseAButton = requireElement<HTMLButtonElement>('#scene-export-pause-a')
  const seekAButton = requireElement<HTMLButtonElement>('#scene-export-seek-a')
  const destroyAButton = requireElement<HTMLButtonElement>('#scene-export-destroy-a')
  const packagePath = '/exports/scene-export/'
  const libraryUrl = new URL('/codplay-player/codplay.js', globalThis.location.href).href
  const { CodPlay } = await import(/* @vite-ignore */ libraryUrl) as {
    CodPlay: new () => CodPlayOwner
  }
  const player = new CodPlay()
  let instanceA: SceneInstance | undefined
  let instanceB: SceneInstance | undefined
  let removeDiagnosticA: (() => void) | undefined
  let removeDiagnosticB: (() => void) | undefined
  let progressTimer: number | undefined

  try {
    const loadedInstances = await Promise.all([
      player.load(packagePath, { root: rootA }),
      player.load(packagePath, { root: rootB }),
    ])
    instanceA = loadedInstances[0]
    instanceB = loadedInstances[1]
    removeDiagnosticA = observeDiagnostics(instanceA, 'A')
    removeDiagnosticB = observeDiagnostics(instanceB, 'B')
    pageStatus.dataset.state = 'ready'
    pageStatus.textContent = 'Deux occurrences prêtes ; un seul owner CodPlay.'
    playButton.disabled = false
    pauseAButton.disabled = false
    seekAButton.disabled = false
    destroyAButton.disabled = false
    progressTimer = globalThis.setInterval(() => {
      refreshInstanceStatus(instanceA, statusA)
      refreshInstanceStatus(instanceB, statusB)
    }, 100)

    playButton.addEventListener('click', () => {
      if (instanceA !== undefined && instanceB !== undefined) {
        void playBoth(instanceA, instanceB, pageStatus)
      }
    })
    pauseAButton.addEventListener('click', () => {
      if (instanceA !== undefined) void runInstanceCommand(instanceA.telco.pause(), pageStatus, 'Pause A terminée.')
    })
    seekAButton.addEventListener('click', () => {
      if (instanceA !== undefined) {
        void runInstanceCommand(instanceA.telco.seek(5_000), pageStatus, 'Seek A à 5 000 ms terminé.')
      }
    })
    destroyAButton.addEventListener('click', () => {
      if (instanceA === undefined) return
      player.instances.destroy(instanceA.instanceId)
      removeDiagnosticA?.()
      removeDiagnosticA = undefined
      instanceA = undefined
      playButton.disabled = true
      pauseAButton.disabled = true
      seekAButton.disabled = true
      destroyAButton.disabled = true
      refreshInstanceStatus(instanceA, statusA)
      pageStatus.textContent = 'A détruite ; B reste chargée dans le même owner.'
    })

    globalThis.addEventListener('beforeunload', () => {
      if (progressTimer !== undefined) globalThis.clearInterval(progressTimer)
      removeDiagnosticA?.()
      removeDiagnosticB?.()
      player.destroy()
    }, { once: true })
  } catch (error) {
    player.destroy()
    pageStatus.dataset.state = 'error'
    pageStatus.textContent = error instanceof Error ? error.message : String(error)
  }
}

/** Adds a diagnostic listener for one loaded scene occurrence. */
function observeDiagnostics(instance: SceneInstance, label: string): () => void {
  return instance.diagnostic.onDiagnostic((diagnostic) => {
    console.error(`[scene-export] diagnostic CodPlay ${label}`, diagnostic)
  })
}

/** Updates one occurrence label with its own state and logical time. */
function refreshInstanceStatus(instance: SceneInstance | undefined, status: HTMLElement): void {
  if (instance === undefined) {
    status.dataset.state = 'destroyed'
    status.textContent = 'Détruite'
    return
  }

  const state = instance.telco.getState()
  const progress = instance.telco.getProgress()
  status.dataset.state = state.status
  status.textContent = `${state.status} · ${progress.timelineMs} / ${progress.durationMs} ms`
}

/** Starts both loaded occurrences through their own telco controls. */
async function playBoth(instanceA: SceneInstance, instanceB: SceneInstance, status: HTMLElement): Promise<void> {
  try {
    await Promise.all([instanceA.telco.play(), instanceB.telco.play()])
    status.dataset.state = 'playing'
    status.textContent = 'A et B lancées par leur telco, sous le même engine.'
  } catch (error) {
    reportCommandFailure(error, status)
  }
}

/** Runs one occurrence command and reports a rejected command in the page. */
async function runInstanceCommand(command: Promise<unknown>, status: HTMLElement, success: string): Promise<void> {
  try {
    await command
    status.dataset.state = 'ready'
    status.textContent = success
  } catch (error) {
    reportCommandFailure(error, status)
  }
}

/** Reports a failed CodPlay command without hiding the original error. */
function reportCommandFailure(error: unknown, status: HTMLElement): void {
  status.dataset.state = 'error'
  status.textContent = error instanceof Error ? error.message : String(error)
}

/** Resolves one required page element and fails with its selector when absent. */
function requireElement<ElementType extends HTMLElement>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector)
  if (element === null) throw new Error(`Required demo element is missing: ${selector}`)
  return element
}

void mountSceneExportDemo()
