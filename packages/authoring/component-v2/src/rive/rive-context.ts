export type RiveFitName =
  | 'fill'
  | 'contain'
  | 'cover'
  | 'fitWidth'
  | 'fitHeight'
  | 'none'
  | 'scaleDown'
  | 'layout'

export type RiveAlignmentName =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'center'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'

export type RiveBounds = Readonly<{
  minX: number
  minY: number
  maxX: number
  maxY: number
}>

export type RiveRenderer = {
  clear(): void
  save(): void
  restore(): void
  align(
    fit: unknown,
    alignment: unknown,
    frame: RiveBounds,
    content: RiveBounds,
  ): void
  delete(): void
}

export type RiveAnimationInstance = {
  advance(seconds: number): boolean
  apply(mix: number): void
  delete(): void
}

export type RiveStateMachineInput = {
  name: string
  value: number | boolean | undefined
}

export type RiveStateMachineInstance = {
  advance(seconds: number): boolean
  inputCount(): number
  input(index: number): RiveStateMachineInput
  bindViewModelInstance(instance: RiveViewModelInstance): void
  delete(): void
}

export type RiveViewModelProperty = Readonly<{
  name: string
  type: string
}>

export type RiveViewModelInstance = {
  getProperties(): readonly RiveViewModelProperty[]
  number(name: string): { value: number } | null
  boolean(name: string): { value: boolean } | null
  delete(): void
}

export type RiveViewModel = {
  instanceByName(name: string): RiveViewModelInstance | null
}

export type RiveArtboard = {
  readonly bounds: RiveBounds
  advance(seconds: number): boolean
  draw(renderer: RiveRenderer): void
  animationCount(): number
  animationByIndex(index: number): unknown
  animationByName(name: string): unknown
  stateMachineByName(name: string): unknown
  delete(): void
}

export type RiveFile = {
  defaultArtboard(): RiveArtboard
  artboardByName(name: string): RiveArtboard | null
  viewModelByName(name: string): RiveViewModel | null
}

export type RiveRuntime = {
  load(bytes: Uint8Array): Promise<RiveFile>
  makeRenderer(canvas: HTMLCanvasElement): RiveRenderer
  LinearAnimationInstance: new (
    animation: unknown,
    artboard: RiveArtboard,
  ) => RiveAnimationInstance
  StateMachineInstance: new (
    stateMachine: unknown,
    artboard: RiveArtboard,
  ) => RiveStateMachineInstance
  Fit: Readonly<Record<RiveFitName, unknown>>
  Alignment: Readonly<Record<RiveAlignmentName, unknown>>
  resolveAnimationFrame(): void
}

export type RiveResource = Readonly<{
  runtime: RiveRuntime
  file: RiveFile
}>

/** Stable handle exposed to components attached to one Rive document. */
export type RiveDocumentTarget = Readonly<{
  getRuntime(): RiveRuntime
  getArtboard(): RiveArtboard | undefined
  getFile(): RiveFile
  prepareArtboard(timeMs: number): void
  invalidate(): void
  onArtboardRelease(release: () => void): () => void
  getRevision(): number
}>
