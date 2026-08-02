import type {
  RuntimeModuleServiceDefinition,
  RuntimeModuleServiceInstance,
} from '../../engine'
import { MOUNT_TARGET_KIND_OUTLET } from '../../config/mount-target'
import type { MountTargetDeclaration } from '../../player/pipeline/mount-targets'

/** Runtime module identifier for layout outlet registration. */
export const LAYOUT_MODULE_SERVICE_ID = 'layout' as const

/** One opaque mountable part declaration owned by one component instance. */
export type MountablePartDeclaration = Readonly<{
  id: string
  ownerId: string
  storyId: string
  componentType: string
  partId: string
  kind: 'outlet'
}>

/** One component registration submitted to the generic mountable-part capability. */
export type ComponentMountRegistration = Readonly<{
  componentId: string
  storyId: string
  componentType: string
  parts: readonly MountablePartDeclaration[]
}>

/** Runtime API exposed by one player-scoped layout module instance. */
export type LayoutModuleServiceInstance = RuntimeModuleServiceInstance & Readonly<{
  registerComponent: (registration: ComponentMountRegistration) => void
  unregisterComponent: (componentId: string) => void
  resolveTarget: (targetId: string) => MountablePartDeclaration | undefined
  getComponentParts: (componentId: string) => readonly MountablePartDeclaration[]
  getAllTargets: () => readonly MountablePartDeclaration[]
  getMountTargets: () => readonly MountTargetDeclaration[]
}>

/** Pure per-player state for layout components and their outlet targets. */
export class LayoutCapabilityState {
  private readonly components = new Map<string, ComponentMountRegistration>()
  private readonly targets = new Map<string, MountablePartDeclaration>()

  /** Registers one component and its selected opaque mountable parts. */
  registerComponent(registration: ComponentMountRegistration): void {
    if (registration.componentId.length === 0) {
      throw new Error('Layout component ID must not be empty.')
    }
    if (registration.storyId.length === 0) {
      throw new Error('Layout story ID must not be empty.')
    }
    if (registration.componentType.length === 0) {
      throw new Error('Layout component type must not be empty.')
    }
    if (this.components.has(registration.componentId)) {
      throw new Error(`Layout component is already registered: ${registration.componentId}`)
    }

    const localTargets = new Set<string>()
    for (const part of registration.parts) {
      validateMountablePart(registration, part, localTargets)
      if (this.targets.has(part.id)) {
        throw new Error(`Layout mount target ID is already registered: ${part.id}`)
      }
    }

    const normalized = {
      ...registration,
      parts: registration.parts.map((part) => ({ ...part })),
    }
    this.components.set(registration.componentId, normalized)
    for (const part of normalized.parts) this.targets.set(part.id, part)
  }

  /** Removes one component and all mountable parts owned by it. */
  unregisterComponent(componentId: string): void {
    const registration = this.components.get(componentId)
    if (registration === undefined) return

    this.components.delete(componentId)
    for (const part of registration.parts) this.targets.delete(part.id)
  }

  /** Resolves one opaque mount target without interpreting its identifier. */
  resolveTarget(targetId: string): MountablePartDeclaration | undefined {
    return this.targets.get(targetId)
  }

  /** Returns the mountable parts owned by one component in declaration order. */
  getComponentParts(componentId: string): readonly MountablePartDeclaration[] {
    return [...(this.components.get(componentId)?.parts ?? [])]
  }

  /** Returns all registered mount targets in component registration order. */
  getAllTargets(): readonly MountablePartDeclaration[] {
    return [...this.targets.values()]
  }

  /** Removes all component registrations from this player-scoped state. */
  clear(): void {
    this.components.clear()
    this.targets.clear()
  }
}

/** Creates one player-scoped layout module around the pure capability state. */
export function createLayoutModuleServiceDefinition(): RuntimeModuleServiceDefinition {
  return {
    id: LAYOUT_MODULE_SERVICE_ID,
    create: () => {
      const state = new LayoutCapabilityState()
      const instance: LayoutModuleServiceInstance = {
        registerComponent: (registration) => state.registerComponent(registration),
        unregisterComponent: (componentId) => state.unregisterComponent(componentId),
        resolveTarget: (targetId) => state.resolveTarget(targetId),
        getComponentParts: (componentId) => state.getComponentParts(componentId),
        getAllTargets: () => state.getAllTargets(),
        getMountTargets: () => state.getAllTargets().map(toMountTargetDeclaration),
        destroy: () => state.clear(),
      }
      return instance
    },
  }
}

/** Converts one layout capability target into the player placement declaration. */
function toMountTargetDeclaration(part: MountablePartDeclaration): MountTargetDeclaration {
  return {
    id: part.id,
    kind: MOUNT_TARGET_KIND_OUTLET,
    storyId: part.storyId,
    ownerId: part.ownerId,
  }
}

/** Validates one mountable part against its owning component and registration. */
function validateMountablePart(
  registration: ComponentMountRegistration,
  part: MountablePartDeclaration,
  localTargets: Set<string>,
): void {
  if (part.id.length === 0) throw new Error('Layout mount target ID must not be empty.')
  if (part.partId.length === 0) throw new Error('Layout part ID must not be empty.')
  if (part.kind !== 'outlet') throw new Error(`Invalid layout mount target kind: ${part.kind}`)
  if (part.ownerId !== registration.componentId) {
    throw new Error(`Layout mount target owner does not match component: ${part.id}`)
  }
  if (part.storyId !== registration.storyId) {
    throw new Error(`Layout mount target story does not match component: ${part.id}`)
  }
  if (part.componentType !== registration.componentType) {
    throw new Error(`Layout mount target type does not match component: ${part.id}`)
  }
  if (localTargets.has(part.id)) throw new Error(`Layout mount target ID is duplicated: ${part.id}`)
  localTargets.add(part.id)
}
