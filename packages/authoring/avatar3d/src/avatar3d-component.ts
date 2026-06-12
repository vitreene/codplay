const ALL_VISEMES = [
  'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U',
] as const

/**
 * Minimal duck-typed interface for TalkingHead's morph target API.
 * Avoids a hard dependency on the TalkingHead library in this package.
 */
export interface AvatarHeadApi {
  setFixedValue(morphTarget: string, value: number | null): void
  setMood(mood: string): void
}

function applyViseme(head: AvatarHeadApi, viseme: string | null, weight: number): void {
  for (const v of ALL_VISEMES) {
    head.setFixedValue('viseme_' + v, v === viseme ? weight : 0)
  }
}

function releaseVisemes(head: AvatarHeadApi): void {
  for (const v of ALL_VISEMES) {
    head.setFixedValue('viseme_' + v, null)
  }
}

export type Avatar3DDeps = {
  canvas: HTMLCanvasElement
  head: AvatarHeadApi
  /** Amplitude max des morphes visème (0–1). Défaut : 0.75 */
  visemeWeight?: number
}

// Minimal ComponentModules-compatible shape — no codplay import needed
type ComponentModulesShape = {
  declare(capabilities: readonly string[]): void
  readonly declared: readonly string[]
}

function createModules(): ComponentModulesShape {
  const declared: readonly string[] = []
  return {
    declare(_: readonly string[]): void {},
    get declared() { return declared },
  }
}

// Minimal update input shape matching codplay's RuntimeComponentUpdateInput
type UpdateInput = {
  persoId: string
  eventId: string
  eventSeq: number
  action: Record<string, unknown>
}

/**
 * Avatar3DComponent contract — satisfies codplay's RuntimeComponent duck type.
 * Wraps a pre-initialized TalkingHead instance (avatarOnly mode).
 * The canvas and head are provided via factory closure: no TH import here.
 */
export type Avatar3DComponent = {
  node: unknown
  render(): Node
  _init(): void
  update(input: UpdateInput): void
  readonly modules: ComponentModulesShape
}

/**
 * Returns a RuntimeComponentClass for the avatar3d perso type.
 * deps.canvas  — WebGLRenderer.domElement created by the demo
 * deps.head    — TalkingHead instance in avatarOnly mode, showAvatar() already called
 */
export function createAvatar3DComponentClass(deps: Avatar3DDeps): new (input: unknown) => Avatar3DComponent {
  return class implements Avatar3DComponent {
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
      const action = input.action
      if ('viseme' in action) {
        const v = action['viseme']
        applyViseme(deps.head, typeof v === 'string' ? v : null, deps.visemeWeight ?? 0.75)
      }
      if ('mood' in action && typeof action['mood'] === 'string') {
        deps.head.setMood(action['mood'])
      }
      if (action['release'] === true) {
        releaseVisemes(deps.head)
      }
    }
  }
}
