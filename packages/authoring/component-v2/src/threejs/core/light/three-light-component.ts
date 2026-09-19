import type { ComponentUpdateInput } from 'codplay'
import type { Light, Scene } from 'three'
import { BaseThreeComponent } from '../threejs-component'
import type { ThreeRuntime } from '../threejs-core-types'
import type { ThreeSceneTarget } from '../threejs-core-types'
import type { ThreeLightInitial } from './three-light-types'

/** Controls one light attached to a related Three.js scene target. */
export class ThreeLightComponent extends BaseThreeComponent<ThreeLightInitial> {
  static readonly declaredServices = [] as const

  private light: Light | undefined
  private lightKind: ThreeLightInitial['kind'] | undefined
  private attachedScene: Scene | undefined

  /** Applies the authored light state to the related scene target. */
  update(input: ComponentUpdateInput<ThreeLightInitial>): void {
    const target = input.target as ThreeSceneTarget

    if (this.attachedScene !== undefined && this.attachedScene !== target.scene) this.detach()
    const state = input.state
    const kind = state.kind
    if (this.light === undefined || this.lightKind !== kind) {
      this.detach()
      this.light = createLight(this.runtime, state)
      this.lightKind = kind
    }
    this.attachedScene = target.scene
    if (this.light.parent !== target.scene) target.scene.add(this.light)
    applyLightState(this.light, state)
  }

  /** Removes the light from its current scene. */
  destroy(): void {
    this.detach()
    this.light = undefined
    this.lightKind = undefined
  }

  /** Detaches the component-owned light without disposing the host scene. */
  private detach(): void {
    if (this.light !== undefined && this.attachedScene !== undefined) this.attachedScene.remove(this.light)
    this.attachedScene = undefined
  }
}

/** Creates one native Three.js light from the serializable kind. */
function createLight(runtime: ThreeRuntime, initial: ThreeLightInitial): Light {
  const color = initial.color ?? 0xffffff
  if (initial.kind === 'directional') return new runtime.DirectionalLight(color, initial.intensity ?? 1)
  if (initial.kind === 'point') {
    return new runtime.PointLight(color, initial.intensity ?? 1, initial.distance ?? 0, initial.decay ?? 2)
  }
  return new runtime.AmbientLight(color, initial.intensity ?? 1)
}

/** Applies the mutable authored light fields without replacing the light. */
function applyLightState(light: Light, state: ThreeLightInitial): void {
  if (state.color !== undefined) light.color.set(state.color)
  if (state.intensity !== undefined) light.intensity = state.intensity
  if (state.position !== undefined) light.position.set(...state.position)
  if (state.castShadow !== undefined && 'castShadow' in light) {
    ;(light as Light & { castShadow: boolean }).castShadow = state.castShadow
  }
  if ('distance' in light && state.distance !== undefined) {
    ;(light as Light & { distance: number }).distance = state.distance
  }
  if ('decay' in light && state.decay !== undefined) {
    ;(light as Light & { decay: number }).decay = state.decay
  }
}
