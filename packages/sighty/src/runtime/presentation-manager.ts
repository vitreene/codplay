import {
  resolveSlotManifestEntry,
  slotManifest,
  type CodPlayInstanceHostTarget,
  type CodPlayInstanceMountHandle,
} from 'codplay'
import type { ActiveSelection } from '../navigation/types'
import { sameSelection } from '../navigation/transition'
import { occurrenceKeyForSelection, sameMountHost } from './helpers'
import type { SightyRuntimeState } from './state'
import type { PresentationRelation, ResolvedMount } from './types'

type MountedPresentation<SceneKey extends string, SlotName extends string> = Readonly<{
  selection: ActiveSelection<SceneKey, SlotName>
  mount: ResolvedMount
  handle: CodPlayInstanceMountHandle
}>

/** Owns physical CodPlay relations independently from logical composition. */
export class RuntimePresentationManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly mounts = new Map<string, MountedPresentation<SceneKey, SlotName>>()

  /** Creates a presentation registry for one Sighty runtime. */
  constructor(state: SightyRuntimeState<SceneKey, SlotName>) {
    this.state = state
  }

  /** Resolves one logical selection into a CodPlay mount request. */
  resolveMount(selection: ActiveSelection<SceneKey, SlotName>): ResolvedMount {
    const slot = this.state.viewIndex.slotsByAddress.get(selection.slotAddress)
    if (slot === undefined) throw new Error(`Le slot Sighty ${selection.slotName} est absent de l’index.`)
    const layoutOccurrenceKey = this.state.layoutEntry?.path ?? 'layout'
    const layoutInstance = this.state.instances.get(layoutOccurrenceKey)
    if (layoutInstance === undefined) throw new Error('L’instance layout Sighty est absente.')
    const layoutScene = this.state.sceneDocuments.get(this.state.layout.sceneKey)
    if (layoutScene === undefined) throw new Error('La ressource layout Sighty est absente.')

    const resolution = resolveSlotManifestEntry(
      slotManifest(layoutScene, { storyId: this.state.layout.storyId }),
      slot.slotName,
      {
        sceneId: layoutScene.id,
        storyId: this.state.layout.storyId,
        referencePath: `views.${slot.ownerPath}.view.slots.${slot.slotName}`,
      },
    )
    if (!resolution.ok) throw new Error(resolution.diagnostic.message)

    const child = this.state.instances.get(occurrenceKeyForSelection(selection))
    if (child === undefined) throw new Error(`L’instance enfant ${selection.sceneKey} est absente.`)
    return {
      host: {
        instanceId: layoutInstance.instanceId,
        storyId: resolution.entry.storyId,
        persoId: resolution.entry.persoId,
      },
      childInstanceId: child.instanceId,
      ...(resolution.entry.replace === undefined ? {} : { replace: resolution.entry.replace }),
    }
  }

  /** Returns whether an incoming selection already owns the requested relation. */
  canReuseSelection(
    selection: ActiveSelection<SceneKey, SlotName>,
    mount: ResolvedMount,
  ): boolean {
    const current = this.mounts.get(selection.slotAddress)
    return current !== undefined
      && current.mount.childInstanceId === mount.childInstanceId
      && sameMountHost(current.mount.host, mount.host)
  }

  /** Returns whether a host is occupied by an active outgoing relation of this transition. */
  canReplaceHost(
    host: CodPlayInstanceHostTarget,
    previousSelections: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    exited: readonly ActiveSelection<SceneKey, SlotName>[],
  ): boolean {
    const relation = [...this.mounts.values()]
      .find((candidate) => sameMountHost(candidate.mount.host, host))
    if (relation === undefined) return false

    const activeSelection = previousSelections.get(relation.selection.slotAddress)
    if (activeSelection === undefined || !sameSelection(activeSelection, relation.selection)) {
      return false
    }
    return exited.some((selection) => sameSelection(selection, relation.selection))
  }

  /** Mounts or reuses one physical relation for a logical selection. */
  mountSelection(
    selection: ActiveSelection<SceneKey, SlotName>,
    mount: ResolvedMount = this.resolveMount(selection),
  ): void {
    const current = this.mounts.get(selection.slotAddress)
    if (
      current !== undefined
      && current.mount.childInstanceId === mount.childInstanceId
      && sameMountHost(current.mount.host, mount.host)
    ) {
      this.mounts.set(selection.slotAddress, { ...current, selection, mount })
      return
    }

    if (current !== undefined && !sameMountHost(current.mount.host, mount.host)) {
      current.handle.detach()
      this.mounts.delete(selection.slotAddress)
    }

    const handle = this.state.owner.instances.mount(mount)
    for (const [slotAddress, relation] of this.mounts) {
      if (!sameMountHost(relation.mount.host, mount.host)) continue
      relation.handle.detach()
      this.mounts.delete(slotAddress)
    }
    this.mounts.set(selection.slotAddress, {
      selection,
      mount,
      handle,
    })
  }

  /** Captures physical relations so a failed operation can restore them. */
  capture(): readonly PresentationRelation<SceneKey, SlotName>[] {
    return [...this.mounts.values()].map(({ selection, mount }) => ({
      selection,
      mount: {
        host: mount.host,
        childInstanceId: mount.childInstanceId,
      },
    }))
  }

  /** Restores captured physical relations after a failed operation. */
  restore(relations: readonly PresentationRelation<SceneKey, SlotName>[]): void {
    this.detachAll()
    for (const relation of relations) this.mountSelection(relation.selection, relation.mount)
  }

  /** Detaches every relation occupying one physical host. */
  detachForHost(host: CodPlayInstanceHostTarget): void {
    for (const [slotAddress, relation] of this.mounts) {
      if (!sameMountHost(relation.mount.host, host)) continue
      relation.handle.detach()
      this.mounts.delete(slotAddress)
    }
  }

  /** Rebuilds the physical presentation without destroying occurrences. */
  detachAll(): void {
    for (const relation of this.mounts.values()) relation.handle.detach()
    this.mounts.clear()
  }

  /** Detaches retained relations whose child occurrence was removed. */
  detachUnavailable(): void {
    const availableInstanceIds = new Set(
      [...this.state.instances.values()].map((instance) => instance.instanceId),
    )
    for (const [slotAddress, relation] of this.mounts) {
      if (availableInstanceIds.has(relation.mount.childInstanceId)) continue
      relation.handle.detach()
      this.mounts.delete(slotAddress)
    }
  }

}
