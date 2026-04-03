import type { ModuleCommandDoc } from '../../types'
import { ModuleBase } from '../module-base'
import type {
  ModuleActionRouteMode,
  ModuleInitInput,
  ModuleRenderInput,
  ModuleTechnicalEvent
} from '../types'

export type AvatarModuleConfig = {
  preset?: string
  modelUrl?: string
  idleClip?: string
  voicePack?: string
  interactionMode?: string
}

/**
 * Provides one example custom module for an animated avatar item type.
 */
export class AvatarModuleExample extends ModuleBase<AvatarModuleConfig, unknown> {
  private animationState: 'idle' | 'speaking' | 'gesturing'
  private currentMood: string
  private viewportWidth: number
  private viewportHeight: number

  /**
   * Creates one avatar module example with default runtime values.
   */
  constructor(input: {
    runtimeItemId: string
    itemType: string
    initialRootNode?: unknown
    moduleConfig?: AvatarModuleConfig
    emit: (event: { name: string; data?: Record<string, unknown> }) => void
  }) {
    super(input)
    this.animationState = 'idle'
    this.currentMood = 'neutral'
    this.viewportWidth = 0
    this.viewportHeight = 0
  }

  /**
   * Initializes avatar module resources from item module config.
   */
  override init(input: ModuleInitInput = {}): void {
    super.init(input)

    if (this.getRootNode() === undefined && typeof globalThis.document !== 'undefined') {
      const canvas = globalThis.document.createElement('canvas')
      canvas.dataset.runtimeItemId = this.runtimeItemId
      this.setRootNode(canvas)
    }
  }

  /**
   * Starts avatar idle behavior when runtime scene starts.
   */
  override start(): void {
    super.start()
    this.animationState = 'idle'
  }

  /**
   * Applies one targeted technical event such as viewport updates.
   */
  override onTechnicalEvent(event: ModuleTechnicalEvent): void {
    super.onTechnicalEvent(event)

    if (event.name === 'viewport:resize') {
      const width = typeof event.data?.width === 'number' ? event.data.width : this.viewportWidth
      const height = typeof event.data?.height === 'number' ? event.data.height : this.viewportHeight
      this.viewportWidth = width
      this.viewportHeight = height
    }
  }

  /**
   * Keeps player action routing at root node level for avatar.
   */
  override getActionRouteMode(): ModuleActionRouteMode {
    return 'root-only'
  }

  /**
   * Renders one frame-level avatar update when required.
   */
  override render(input: ModuleRenderInput = {}): unknown {
    super.render(input)
    const avatarSnapshot = {
      animationState: this.animationState,
      currentMood: this.currentMood,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight
    }
    void avatarSnapshot
    return this.getRootNode()
  }

  /**
   * Releases avatar resources when runtime destroys the item instance.
   */
  override destroy(): void {
    super.destroy()
  }

  /**
   * Handles one module command routed from item actions.
   */
  protected override onCommand(cmd: ModuleCommandDoc): void {
    switch (cmd.name) {
      case 'play-idle':
        this.animationState = 'idle'
        return
      case 'speak':
        this.animationState = 'speaking'
        this.emit('module:avatar:speech:start', {
          runtimeItemId: this.runtimeItemId
        })
        return
      case 'set-mood':
        if (typeof cmd.mood === 'string') {
          this.currentMood = cmd.mood
        }
        return
      default:
        this.emit('module:avatar:command:ignored', {
          runtimeItemId: this.runtimeItemId,
          commandName: cmd.name
        })
    }
  }
}
