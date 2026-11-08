import type { RiveCanvas, File as RiveFile } from '@rive-app/canvas-advanced-single'

export type HeadMotionRivePreviewConfig = Readonly<{
  runtimeSrc: string
  src: string
  artboard: string
  stateMachine: string
  viewModel: string
  instance: string
}>

export type HeadMotionRivePreviewSession = Readonly<{
  setValues: (values: Readonly<{ headX: number; headY: number; headTilt: number }>) => void
  stop: () => void
}>

type RiveRuntime = RiveCanvas

let runtimePromise: Promise<RiveRuntime> | null = null

/** Starts a Rive target that mirrors live head-pose values during camera capture. */
export async function startHeadMotionRivePreview(
  canvas: HTMLCanvasElement,
  config: HeadMotionRivePreviewConfig,
  signal?: AbortSignal,
): Promise<HeadMotionRivePreviewSession> {
  let file: RiveFile | null = null
  let artboard: ReturnType<RiveFile['artboardByName']> | null = null
  let viewModelInstance: ReturnType<ReturnType<RiveFile['viewModelByName']>['instanceByName']> | null = null
  let stateMachineInstance: InstanceType<RiveRuntime['StateMachineInstance']> | null = null
  let renderer: ReturnType<RiveRuntime['makeRenderer']> | null = null
  let frameRequest = 0
  let stopped = false

  /** Releases the Rive target, renderer, and runtime-owned animation resources. */
  const stop = (): void => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frameRequest)
    signal?.removeEventListener('abort', stop)
    stateMachineInstance?.delete()
    stateMachineInstance = null
    viewModelInstance?.delete()
    viewModelInstance = null
    artboard?.delete()
    artboard = null
    renderer?.delete()
    renderer = null
    file?.unref()
    file = null
    canvas.width = 0
    canvas.height = 0
  }

  try {
    signal?.throwIfAborted()
    const runtimeSrc = new URL(config.runtimeSrc, document.baseURI).href
    runtimePromise ??= import(/* @vite-ignore */ runtimeSrc)
      .then(({ default: loadRiveRuntime }) => loadRiveRuntime() as Promise<RiveRuntime>)
    const runtime = await runtimePromise
    const response = await fetch(config.src, { signal })
    if (!response.ok) throw new Error('La cible Avatar n’a pas pu être chargée.')
    file = await runtime.load(new Uint8Array(await response.arrayBuffer()))
    signal?.throwIfAborted()

    artboard = file.artboardByName(config.artboard)
    const stateMachine = artboard.stateMachineByName(config.stateMachine)
    const viewModel = file.viewModelByName(config.viewModel)
    viewModelInstance = viewModel.instanceByName(config.instance)
    const availableHeadValues = new Set(viewModelInstance.getProperties()
      .filter(({ type }) => type === 'number')
      .map(({ name }) => name))
    if (!['headX', 'headY', 'headTilt'].every((name) => availableHeadValues.has(name))) {
      throw new Error('La cible Avatar ne prend pas en charge le suivi de tête.')
    }

    stateMachineInstance = new runtime.StateMachineInstance(stateMachine, artboard)
    stateMachineInstance.bindViewModelInstance(viewModelInstance)
    renderer = runtime.makeRenderer(canvas)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round((artboard.bounds.maxX - artboard.bounds.minX) * pixelRatio)
    canvas.height = Math.round((artboard.bounds.maxY - artboard.bounds.minY) * pixelRatio)
    if (canvas.width === 0 || canvas.height === 0) throw new Error('La cible Avatar n’a pas de dimensions visibles.')

    const numberValues = {
      headX: viewModelInstance.number('headX'),
      headY: viewModelInstance.number('headY'),
      headTilt: viewModelInstance.number('headTilt'),
    }
    let lastTimestamp: number | null = null

    /** Advances and draws one frame of the live Rive target. */
    const renderFrame = (timestamp: number): void => {
      if (stopped || artboard === null || stateMachineInstance === null || renderer === null) return
      const deltaSeconds = lastTimestamp === null ? 0 : Math.min((timestamp - lastTimestamp) / 1000, 0.1)
      lastTimestamp = timestamp
      stateMachineInstance.advance(deltaSeconds)
      artboard.advance(deltaSeconds)
      const frame = { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height }
      renderer.clear()
      renderer.save()
      renderer.align(runtime.Fit.contain, runtime.Alignment.center, frame, artboard.bounds)
      artboard.draw(renderer)
      renderer.restore()
      runtime.resolveAnimationFrame()
      frameRequest = requestAnimationFrame(renderFrame)
    }

    /** Applies one tracked head pose to the preview target. */
    const setValues = (values: Readonly<{ headX: number; headY: number; headTilt: number }>): void => {
      if (stopped) return
      numberValues.headX.value = values.headX
      numberValues.headY.value = values.headY
      numberValues.headTilt.value = values.headTilt
      stateMachineInstance?.advance(0)
      artboard?.advance(0)
    }

    signal?.addEventListener('abort', stop, { once: true })
    frameRequest = requestAnimationFrame(renderFrame)
    return { setValues, stop }
  } catch (error) {
    stop()
    throw error
  }
}
