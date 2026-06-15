import { VISEME_TO_RIVE_ID } from './viseme-map'

/**
 * Duck-type minimal d'un input Rive (SMIInput de l'API bas-niveau).
 * On n'importe pas @rive-app/canvas/rive_advanced.mjs — seule la shape
 * compte ; l'instance réelle est fournie par le demo.
 */
type RiveSMIInput = { value: number | boolean | undefined }

/**
 * Duck-type minimal d'une StateMachineInstance et d'un Artboard.
 * La méthode advance(sec) est l'unique interface dont l'adapter a besoin.
 */
type RiveAdvanceable = { advance(sec: number): boolean }

export type AvatarRiveDeps = {
  /** Canvas DOM fourni au renderer — retourné par render() comme nœud CodPlay. */
  canvas: HTMLCanvasElement
  /** Input "lips sync id" de la state machine. */
  lipsSyncInput: RiveSMIInput
  /** Input "emotion" de la state machine (optionnel). */
  emotionInput?: RiveSMIInput
  /** Instance de StateMachineInstance (API bas-niveau). */
  stateMachineInstance: RiveAdvanceable
  /** Instance d'Artboard (API bas-niveau). */
  artboard: RiveAdvanceable
  /**
   * Fonction de rendu complète : clear → align → draw → flush.
   * Fournie par le demo — encapsule renderer, fit, alignment.
   */
  drawFrame(): void
}

type UpdateInput = {
  persoId: string
  eventId: string
  eventSeq: number
  action: Record<string, unknown>
}

type ComponentModulesShape = {
  declare(capabilities: readonly string[]): void
  readonly declared: readonly string[]
}

function createModules(): ComponentModulesShape {
  return {
    declare(_: readonly string[]): void {},
    get declared() { return [] as readonly string[] },
  }
}

export type AvatarRiveComponent = {
  node: unknown
  render(): Node
  _init(): void
  update(input: UpdateInput): void
  readonly modules: ComponentModulesShape
}

export type AvatarRiveBinding = {
  componentClass: new (input: unknown) => AvatarRiveComponent
  renderAdapter: {
    tick(info: { deltaMs: number }): void
    seekStart(): void
    seek(info: unknown): void
    pause(): void
    resume(): void
    stop(): void
  }
}

function resetInputs(deps: AvatarRiveDeps): void {
  deps.lipsSyncInput.value = 0
  if (deps.emotionInput) deps.emotionInput.value = 0
}

/**
 * Crée le composant CodPlay et le render adapter Rive.
 *
 * CodPlay EST le moteur — Rive n'a PAS son propre RAF.
 * - tick()  → advance state machine + artboard + draw. CodPlay est le seul
 *             producteur de frames ; si tick() s'arrête, l'image est gelée.
 * - pause() / resume() → no-op : CodPlay arrête / reprend de lui-même d'appeler tick().
 * - seek    → replay des events (update) remet les inputs au bon état,
 *             puis seek() draw un seul frame pour matérialiser la position.
 */
export function createAvatarRiveBinding(deps: AvatarRiveDeps): AvatarRiveBinding {
  const componentClass = class implements AvatarRiveComponent {
    readonly modules = createModules()
    node: unknown = null

    constructor(_input: unknown) {}

    render(): Node {
      this.node = deps.canvas
      return deps.canvas
    }

    _init(): void {
      this.node = this.render()
    }

    update(input: UpdateInput): void {
      const { action } = input

      // broadcast STOP : remettre les inputs à zéro.
      // START/PAUSE sont no-op : le pilotage est entièrement dans le render adapter.
      const broadcast = action['broadcast'] as { type?: string } | null | undefined
      if (broadcast?.type === 'STOP') {
        resetInputs(deps)
        return
      }

      if ('viseme' in action) {
        const v = action['viseme']
        const name = typeof v === 'string' ? v : null
        deps.lipsSyncInput.value = name !== null ? (VISEME_TO_RIVE_ID[name] ?? 0) : 0
      }

      if ('emotion' in action && typeof action['emotion'] === 'number' && deps.emotionInput) {
        deps.emotionInput.value = action['emotion']
      }
    }
  }

  const renderAdapter = {
    /**
     * CodPlay appelle tick() à chaque frame RAF.
     * On avance la state machine et l'artboard du même delta, puis on draw.
     * Pause = CodPlay arrête d'appeler tick(). Resume = reprend.
     */
    tick({ deltaMs }: { deltaMs: number }): void {
      const sec = deltaMs / 1000
      deps.stateMachineInstance.advance(sec)
      deps.artboard.advance(sec)
      deps.drawFrame()
    },

    /**
     * Début de seek : remettre les inputs à zéro avant le replay des events.
     */
    seekStart(): void {
      resetInputs(deps)
    },

    /**
     * Fin de seek : les update() ont rejoué les inputs à la bonne valeur.
     * On advance(0) pour appliquer les inputs sans avancer le temps,
     * puis on draw pour matérialiser la position de seek.
     */
    seek(_info: unknown): void {
      deps.stateMachineInstance.advance(0)
      deps.artboard.advance(0)
      deps.drawFrame()
    },

    /** No-op : CodPlay arrête tick() — l'image reste gelée naturellement. */
    pause(): void {},

    /** No-op : CodPlay reprend tick() — la state machine continue depuis là où elle était. */
    resume(): void {},

    stop(): void {
      resetInputs(deps)
      deps.stateMachineInstance.advance(0)
      deps.artboard.advance(0)
      deps.drawFrame()
    },
  }

  return { componentClass, renderAdapter }
}
