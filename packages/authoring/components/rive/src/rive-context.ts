// Internal duck types for the Rive low-level WASM API.
// Not exported — internal to the package.

export type RiveSMIInput = {
  name: string
  type: number
  value: number | boolean | undefined
  fire(): void
  asBool(): RiveSMIInput
  asNumber(): RiveSMIInput
  asTrigger(): RiveSMIInput
}

export type RiveStateMachineInstance = {
  advance(sec: number): boolean
  inputCount(): number
  input(i: number): RiveSMIInput
  delete(): void
}

export type RiveArtboard = {
  stateMachineByName(name: string): unknown
  bounds: unknown
  advance(sec: number): boolean
  draw(renderer: RiveRenderer): void
  delete(): void
}

export type RiveRenderer = {
  clear(): void
  save(): void
  restore(): void
  align(fit: unknown, alignment: unknown, frame: unknown, bounds: unknown): void
  delete(): void
}

export type RiveFile = {
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
