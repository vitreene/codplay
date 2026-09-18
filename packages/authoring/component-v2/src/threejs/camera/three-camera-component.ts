import {
  BaseComponent,
  type ComponentInput,
  type ComponentUpdateInput,
} from 'codplay'
import type { Camera, Scene } from 'three'
import type { ThreeRuntimeAccess } from '../threejs-runtime'
import { isThreeSceneTarget } from '../threejs-target'
import type { ThreeCameraInitial, ThreeSceneTarget } from '../threejs-types'

/** Creates a camera component class bound to one Three.js runtime holder. */
export function createThreeCameraComponent(
  runtimeAccess: ThreeRuntimeAccess,
): {
  new (input: ComponentInput<Record<string, unknown>>): ThreeCameraComponentInstance
  readonly declaredServices: readonly []
} {
  return class ThreeCameraComponentImpl extends BaseComponent<Record<string, unknown>> {
    static readonly declaredServices = [] as const

    private camera: Camera | undefined
    private cameraKind: ThreeCameraInitial['kind']
    private target: ThreeSceneTarget | undefined
    private attachedScene: Scene | undefined

    /** Applies the authored camera state to the related scene target. */
    update(input: ComponentUpdateInput<Record<string, unknown>>): void {
      const target = isThreeSceneTarget(input.target) ? input.target : undefined
      if (target === undefined) {
        this.detach()
        return
      }
      if (this.attachedScene !== undefined && this.attachedScene !== target.scene) this.detach()

      const state = input.state as ThreeCameraInitial
      if (this.camera === undefined || this.cameraKind !== (state.kind ?? 'perspective')) {
        this.detach()
        this.camera = createCamera(runtimeAccess, state)
        this.cameraKind = state.kind ?? 'perspective'
      }
      this.target = target
      this.attachedScene = target.scene
      applyCameraState(this.camera, state, runtimeAccess)
      target.setCamera(this.camera)
    }

    /** Removes the camera from the scene it currently contributes to. */
    destroy(): void {
      this.detach()
      this.camera = undefined
    }

    /** Detaches the current camera without disposing shared scene state. */
    private detach(): void {
      if (this.camera !== undefined && this.attachedScene !== undefined) {
        this.attachedScene.remove(this.camera)
      }
      if (this.target !== undefined && this.target.scene === this.attachedScene) {
        this.target.setCamera(null)
      }
      this.target = undefined
      this.attachedScene = undefined
    }
  }
}

/** Public instance shape used by the integration's runtime type declarations. */
export type ThreeCameraComponentInstance = BaseComponent<Record<string, unknown>>

/** Creates one camera from serializable author data. */
function createCamera(runtimeAccess: ThreeRuntimeAccess, initial: ThreeCameraInitial): Camera {
  const runtime = runtimeAccess.require()
  if (initial.kind === 'orthographic') {
    return new runtime.OrthographicCamera(
      initial.left ?? -1,
      initial.right ?? 1,
      initial.top ?? 1,
      initial.bottom ?? -1,
      initial.near ?? 0.1,
      initial.far ?? 100,
    )
  }
  return new runtime.PerspectiveCamera(
    initial.fov ?? 50,
    1,
    initial.near ?? 0.1,
    initial.far ?? 100,
  )
}

/** Applies position and optional look-at data to one camera. */
function applyCameraState(
  camera: Camera,
  state: ThreeCameraInitial,
  runtimeAccess: ThreeRuntimeAccess,
): void {
  if (state.position !== undefined) camera.position.set(...state.position)
  if (state.lookAt !== undefined) {
    const runtime = runtimeAccess.require()
    camera.lookAt(new runtime.Vector3(...state.lookAt))
  }
  const perspective = camera as Camera & {
    fov?: number
    near?: number
    far?: number
    updateProjectionMatrix?: () => void
  }
  if (typeof perspective.fov === 'number' && state.fov !== undefined) perspective.fov = state.fov
  if (typeof perspective.near === 'number' && state.near !== undefined) perspective.near = state.near
  if (typeof perspective.far === 'number' && state.far !== undefined) perspective.far = state.far
  perspective.updateProjectionMatrix?.()
}
