// Internal duck types for the Rive low-level WASM API.
// Not exported — internal to the package.

export type RiveSMIInput = {
  name: string
  value: number | boolean | undefined
  asNumber(): RiveSMIInput
}

type RiveStateMachineInstance = {
  advance(sec: number): void
  inputCount(): number
  input(i: number): RiveSMIInput
}

type RiveArtboard = {
  stateMachineByName(name: string): unknown
  bounds: unknown
  advance(sec: number): void
  draw(renderer: RiveRenderer): void
}

type RiveRenderer = {
  clear(): void
  save(): void
  restore(): void
  align(fit: unknown, alignment: unknown, frame: unknown, bounds: unknown): void
}

type RiveFile = {
  artboardByName(name: string): RiveArtboard | null
  defaultArtboard(): RiveArtboard
}

export type RiveRuntime = {
  makeRenderer(canvas: HTMLCanvasElement): RiveRenderer
  load(bytes: Uint8Array): Promise<RiveFile>
  StateMachineInstance: new (smRef: unknown, artboard: RiveArtboard) => RiveStateMachineInstance
  Fit: { contain: unknown }
  Alignment: { center: unknown }
  resolveAnimationFrame(): void
}

export type RiveContext = {
  runtime: RiveRuntime
  artboard: RiveArtboard
  renderer: RiveRenderer
}

export type RiveResourceEntry = {
  status: 'loading' | 'ready' | 'error'
  runtime?: RiveRuntime
  file?: RiveFile
  error?: string
}
