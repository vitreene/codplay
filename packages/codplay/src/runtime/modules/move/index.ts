import { createListFlipModule } from '../list-flip'
import { RUNTIME_CONFIG } from '../../config'
import type { MoveCommand, MoveFlipMode } from '../../types'
import type {
  RuntimeModule,
  RuntimeModuleBinding,
  RuntimeModuleHost,
  RuntimeModuleHookPayload
} from '../../components/types'

/**
 * Checks whether one value is a minimal move command object.
 */
function isMoveCommand(value: unknown): value is { parentId: string; mode?: unknown; flip?: unknown; flipMode?: unknown; reorder?: unknown } {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const move = value as { parentId?: unknown }
  return typeof move.parentId === 'string' && move.parentId.length > 0
}

/**
 * Resolves one strict move FLIP mode from authored payload.
 */
function normalizeMoveFlipMode(rawFlipMode: unknown): MoveFlipMode {
  return rawFlipMode === 'overlay-world' ? 'overlay-world' : 'local'
}

/**
 * Checks whether one raw move payload targets the story host alias.
 */
export function isStoryHostMove(rawMove: unknown): boolean {
  if (rawMove === RUNTIME_CONFIG.move.rootToken) {
    return true
  }

  if (typeof rawMove !== 'object' || rawMove === null) {
    return false
  }

  const move = rawMove as { parentId?: unknown }
  return move.parentId === RUNTIME_CONFIG.move.rootToken
}

/**
 * Normalizes a raw move payload into one strict move command.
 */
export function normalizeMoveCommand(rawMove: unknown, isInitialMove: boolean): MoveCommand | null {
  if (typeof rawMove === 'string') {
    return rawMove.length === 0
      ? null
      : {
          parentId: rawMove,
          mode: 'append',
          flipMode: 'local'
        }
  }

  if (!isMoveCommand(rawMove)) {
    return null
  }

  return {
    parentId: rawMove.parentId,
    mode: isInitialMove ? 'append' : (rawMove.mode as MoveCommand['mode']) ?? 'append',
    flip: rawMove.flip as MoveCommand['flip'],
    flipMode: normalizeMoveFlipMode(rawMove.flipMode),
    reorder: rawMove.reorder as MoveCommand['reorder']
  }
}

/**
 * Installs the move module and returns its runtime binding with hooks and match.
 */
function install(host: RuntimeModuleHost): RuntimeModuleBinding {
  const listFlipModule = createListFlipModule({
    warnOnce: (eventSeq, code, details, persoId) => {
      host.warnOnce(eventSeq, code, details ?? {}, persoId ?? '')
    },
    getNodeById: (id) => host.registries.node.get(id),
    getListById: (id) => host.registries.container.get(id),
    getParentListId: (id) => host.registries.container.getParentId(id),
    isMounted: (id) => host.registries.mounted.get(id)
  })

  function applyMove(request: {
    persoId: string
    move: MoveCommand
    eventId: string
    eventSeq: number
  }): void {
    const childNode = host.registries.node.get(request.persoId)
    const storyId = host.helpers.getStoryId(request.persoId)
    const sourceListId = host.registries.container.getParentId(request.persoId)
    const sourceList = sourceListId ? host.registries.container.get(sourceListId) : null
    const targetList = host.registries.container.get(request.move.parentId)
    const targetNode = targetList === null
      ? host.helpers.resolveTargetNode(request.move.parentId, storyId, childNode ?? undefined)
      : null

    if (targetList === null && targetNode === null) {
      if (sourceList !== null) {
        sourceList.detachChild({
          childId: request.persoId,
          mode: request.move.mode,
          reorder: request.move.reorder,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        })
      }

      host.registries.container.setParentId(request.persoId, null)
      host.registries.mounted.set(request.persoId, false)
      host.warnOnce(request.eventSeq, 'AUTHOR_LAYOUT_OUTLET_NOT_FOUND', {
        persoId: request.persoId,
        parentId: request.move.parentId,
        eventId: request.eventId,
        eventSeq: request.eventSeq
      }, request.persoId)
      return
    }

    if (targetList !== null && sourceList !== null && sourceList.getPersoId() === targetList.getPersoId()) {
      targetList.repositionChild({
        childId: request.persoId,
        mode: request.move.mode,
        reorder: request.move.reorder,
        eventId: request.eventId,
        eventSeq: request.eventSeq
      })
      host.registries.container.setParentId(request.persoId, targetList.getPersoId())
      host.registries.mounted.set(request.persoId, true)
      return
    }

    if (targetNode !== null) {
      const movedChildNode = sourceList !== null
        ? sourceList.detachChild({
            childId: request.persoId,
            mode: request.move.mode,
            reorder: request.move.reorder,
            eventId: request.eventId,
            eventSeq: request.eventSeq
          }) ?? childNode
        : childNode

      if (movedChildNode === null || movedChildNode === undefined) {
        host.registries.container.setParentId(request.persoId, null)
        host.registries.mounted.set(request.persoId, false)
        host.warnOnce(request.eventSeq, 'RUNTIME_COMPONENT_NODE_NOT_FOUND', {
          persoId: request.persoId,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        }, request.persoId)
        return
      }

      if (!host.helpers.canAttachChildToNode(targetNode, movedChildNode)) {
        host.warnOnce(request.eventSeq, 'AUTHOR_LAYOUT_OUTLET_CHILD_INCOMPATIBLE', {
          persoId: request.persoId,
          parentId: request.move.parentId,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        }, request.persoId)
        return
      }

      host.helpers.detachNode(movedChildNode)
      host.helpers.appendNode(targetNode, movedChildNode)
      host.registries.container.setParentId(request.persoId, null)
      host.registries.mounted.set(request.persoId, true)
      return
    }

    if (targetList !== null) {
      let movedChildNode: unknown | null = null
      if (sourceList !== null) {
        movedChildNode = sourceList.detachChild({
          childId: request.persoId,
          mode: request.move.mode,
          reorder: request.move.reorder,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        }) ?? null
      }

      if (movedChildNode === null) {
        movedChildNode = childNode ?? null
      }

      if (movedChildNode === null) {
        host.registries.container.setParentId(request.persoId, null)
        host.registries.mounted.set(request.persoId, false)
        host.warnOnce(request.eventSeq, 'RUNTIME_COMPONENT_NODE_NOT_FOUND', {
          persoId: request.persoId,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        }, request.persoId)
        return
      }

      targetList.attachChild({
        childId: request.persoId,
        childNode: movedChildNode,
        mode: request.move.mode,
        reorder: request.move.reorder,
        eventId: request.eventId,
        eventSeq: request.eventSeq
      })

      host.registries.container.setParentId(request.persoId, targetList.getPersoId())
      host.registries.mounted.set(request.persoId, true)
    }
  }

  function onInitialPerso(payload: RuntimeModuleHookPayload): void {
    const { perso, moveCommand } = payload
    if (perso === undefined || moveCommand === undefined || moveCommand === null) {
      return
    }

    applyMove({
      persoId: perso.id,
      move: moveCommand,
      eventId: 'init',
      eventSeq: 0
    })
  }

  function beforeUpdate(payload: RuntimeModuleHookPayload): void {
    const { resolvedAction, eventSeq, moveCommand, output } = payload
    if (resolvedAction === undefined || eventSeq === undefined || moveCommand === undefined || moveCommand === null) {
      return
    }

    const persoId = (resolvedAction.action.targetId as string | undefined) ?? resolvedAction.listenerId

    const flipSession = listFlipModule.prepareMove({
      persoId,
      move: moveCommand,
      eventId: resolvedAction.eventId,
      eventName: resolvedAction.eventName,
      eventSeq
    })

    applyMove({
      persoId,
      move: moveCommand,
      eventId: resolvedAction.eventId,
      eventSeq
    })

    if (flipSession !== null && output !== undefined) {
      output.directTransitions.push(...flipSession.commit())
    }
  }

  return {
    runtime: {
      hooks: { onInitialPerso, beforeUpdate },
      match: { actionKeys: ['move'] }
    }
  }
}

/**
 * The move module — handles perso-level move operations and FLIP animations.
 */
export const moveModule: RuntimeModule = { install }
