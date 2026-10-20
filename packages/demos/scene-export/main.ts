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

type EngineConfigBundle = Readonly<{
  engineCapabilities: Readonly<Record<string, unknown>>
  preloadStrategies: Readonly<Record<string, (src: string, signal: AbortSignal) => Promise<void>>>
}>

type SceneDiagnostic = Readonly<{
  severity: string
  code: string
  message: string
}>

/** Loads the simultaneous Rive and Three.js scene through the exported package. */
async function mountSceneExportDemo(): Promise<void> {
  const root = requireElement<HTMLElement>('#scene-export-root')
  const pageStatus = requireElement<HTMLElement>('#scene-export-status')
  const instanceStatus = requireElement<HTMLElement>('#scene-export-instance-status')
  const playButton = requireElement<HTMLButtonElement>('#scene-export-play')
  const seekButton = requireElement<HTMLButtonElement>('#scene-export-seek')
  const pauseButton = requireElement<HTMLButtonElement>('#scene-export-pause')
  const destroyButton = requireElement<HTMLButtonElement>('#scene-export-destroy')
  const packagePath = '/exports/scene-export/'
  const libraryUrl = new URL('/codplay-player/codplay.js', globalThis.location.href).href
  const integrationUrl = new URL('/codplay-engine/engine.js', globalThis.location.href).href
  const [{ CodPlay }, { engineCapabilities, preloadStrategies }] = await Promise.all([
    import(/* @vite-ignore */ libraryUrl) as Promise<{
      CodPlay: new (options: {
        engine: Readonly<Record<string, unknown>>
        preload: { strategies: EngineConfigBundle['preloadStrategies'] }
      }) => CodPlayOwner
    }>,
    import(/* @vite-ignore */ integrationUrl) as Promise<EngineConfigBundle>,
  ])
  const player = new CodPlay({ engine: engineCapabilities, preload: { strategies: preloadStrategies } })
  let instance: SceneInstance | undefined
  let removeDiagnostic: (() => void) | undefined
  let progressTimer: number | undefined
  const commandDiagnostics: SceneDiagnostic[] = []

  try {
    instance = await player.load(packagePath, { root })
    removeDiagnostic = instance.diagnostic.onDiagnostic((diagnostic) => {
      console.error('[scene-export] diagnostic CodPlay', diagnostic)
      if (isErrorDiagnostic(diagnostic)) commandDiagnostics.push(diagnostic)
    })
    pageStatus.dataset.state = 'ready'
    pageStatus.textContent = 'Rive et Three.js sont préchargés dans la même scène exportée.'
    playButton.disabled = false
    seekButton.disabled = false
    pauseButton.disabled = false
    destroyButton.disabled = false
    refreshInstanceStatus(instance, instanceStatus)
    progressTimer = globalThis.setInterval(() => {
      if (instance !== undefined) refreshInstanceStatus(instance, instanceStatus)
    }, 100)

    playButton.addEventListener('click', () => {
      if (instance === undefined) return
      const activeInstance = instance
      void runCommand(() => activeInstance.telco.play(), pageStatus, 'Scène lancée.', commandDiagnostics)
    })
    seekButton.addEventListener('click', () => {
      if (instance === undefined) return
      const activeInstance = instance
      void runCommand(() => activeInstance.telco.seek(9_000), pageStatus, 'Seek à 9 000 ms terminé.', commandDiagnostics)
    })
    pauseButton.addEventListener('click', () => {
      if (instance === undefined) return
      const activeInstance = instance
      void runCommand(() => activeInstance.telco.pause(), pageStatus, 'Scène en pause.', commandDiagnostics)
    })
    destroyButton.addEventListener('click', () => {
      if (instance === undefined) return
      player.instances.destroy(instance.instanceId)
      removeDiagnostic?.()
      removeDiagnostic = undefined
      instance = undefined
      playButton.disabled = true
      seekButton.disabled = true
      pauseButton.disabled = true
      destroyButton.disabled = true
      instanceStatus.dataset.state = 'destroyed'
      instanceStatus.textContent = 'Instance détruite.'
      pageStatus.textContent = 'Le player CodPlay reste disponible ; l’instance scène a été détruite.'
    })

    globalThis.addEventListener('beforeunload', () => {
      if (progressTimer !== undefined) globalThis.clearInterval(progressTimer)
      removeDiagnostic?.()
      player.destroy()
    }, { once: true })
  } catch (error) {
    player.destroy()
    pageStatus.dataset.state = 'error'
    pageStatus.textContent = error instanceof Error ? error.message : String(error)
  }
}

/** Displays one instance state and its logical time while it is running. */
function refreshInstanceStatus(instance: SceneInstance, status: HTMLElement): void {
  const state = instance.telco.getState()
  const progress = instance.telco.getProgress()
  status.dataset.state = state.status
  status.textContent = `${state.status} · ${progress.timelineMs} / ${progress.durationMs} ms`
}

/** Runs one existing instance command and reports its result on the page. */
async function runCommand(
  command: () => Promise<unknown>,
  status: HTMLElement,
  success: string,
  diagnostics: SceneDiagnostic[],
): Promise<void> {
  diagnostics.length = 0
  try {
    await command()
    const error = diagnostics.find((diagnostic) => diagnostic.severity === 'error')
    if (error !== undefined) {
      status.dataset.state = 'error'
      status.textContent = `${error.code}: ${error.message}`
      return
    }
    status.dataset.state = 'ready'
    status.textContent = success
  } catch (error) {
    status.dataset.state = 'error'
    status.textContent = error instanceof Error ? error.message : String(error)
  }
}

/** Narrows a diagnostic event before the demo displays command failures. */
function isErrorDiagnostic(value: unknown): value is SceneDiagnostic {
  if (typeof value !== 'object' || value === null) return false
  const diagnostic = value as Partial<SceneDiagnostic>
  return typeof diagnostic.severity === 'string'
    && typeof diagnostic.code === 'string'
    && typeof diagnostic.message === 'string'
}

/** Resolves one required page element and fails with its selector when absent. */
function requireElement<ElementType extends HTMLElement>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector)
  if (element === null) throw new Error(`Required demo element is missing: ${selector}`)
  return element
}

void mountSceneExportDemo()
