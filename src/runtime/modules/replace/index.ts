import { normalizeReplaceCommand, hasReplaceTarget } from './normalize-replace'
import { applySimpleBefore, applySimpleAfter, cancelSimpleSession } from './apply-simple'
import type { RuntimeModule, RuntimeModuleBinding, RuntimeModuleHost, RuntimeModuleHookPayload } from '../../components/types'

/**
 * Installs the replace module and returns its runtime binding.
 */
function install(host: RuntimeModuleHost): RuntimeModuleBinding {
  function resolvePersoId(payload: RuntimeModuleHookPayload): string | null {
    const action = payload.resolvedAction?.action as Record<string, unknown> | undefined
    if (action === undefined) return null
    const targetId = action.targetId
    if (typeof targetId === 'string') return targetId
    const listenerId = payload.resolvedAction?.listenerId
    return typeof listenerId === 'string' ? listenerId : null
  }

  function beforeUpdate(payload: RuntimeModuleHookPayload): void {
    const action = payload.resolvedAction?.action as Record<string, unknown> | undefined
    if (action === undefined) return

    const rawReplace = action.replace
    const command = normalizeReplaceCommand(rawReplace)
    if (command === null) return

    if (!hasReplaceTarget(action)) {
      host.warnOnce(
        payload.eventSeq ?? 0,
        'REPLACE_NO_TARGET_PROPERTY',
        { eventId: payload.resolvedAction?.eventId },
        resolvePersoId(payload) ?? ''
      )
      return
    }

    const persoId = resolvePersoId(payload)
    if (persoId === null) return

    const node = host.registries.node.get(persoId)
    if (!isDomHTMLElement(node)) return

    const parent = node.parentElement
    if (parent === null) return

    if (command.split === undefined) {
      cancelSimpleSession(node)
      applySimpleBefore(node, parent)
    }
  }

  function afterUpdate(payload: RuntimeModuleHookPayload): void {
    const action = payload.resolvedAction?.action as Record<string, unknown> | undefined
    if (action === undefined) return

    const rawReplace = action.replace
    const command = normalizeReplaceCommand(rawReplace)
    if (command === null) return
    if (!hasReplaceTarget(action)) return

    const persoId = resolvePersoId(payload)
    if (persoId === null) return

    const node = host.registries.node.get(persoId)
    if (!isDomHTMLElement(node)) return

    const output = payload.output
    if (output === undefined) return

    if (command.split === undefined) {
      const transitions = applySimpleAfter({
        el: node,
        command,
        eventId: payload.resolvedAction?.eventId ?? '',
        eventName: payload.resolvedAction?.eventName ?? '',
        listenerId: payload.resolvedAction?.listenerId ?? '',
      })
      output.directTransitions.push(...transitions)
    }
  }

  return {
    runtime: {
      hooks: { beforeUpdate, afterUpdate },
      match: { actionKeys: ['replace'] },
    },
  }
}

function isDomHTMLElement(node: unknown): node is HTMLElement {
  return typeof globalThis.HTMLElement !== 'undefined' && node instanceof globalThis.HTMLElement
}

export const replaceModule: RuntimeModule = { install }
