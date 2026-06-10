import { normalizeReplaceCommand, hasReplaceTarget } from './normalize-replace'
import { applySimpleBefore, applySimpleAfter, applyCloneBDimensions, cancelSimpleSession } from './apply-simple'
import type { ReplaceSimpleEmitter } from './apply-simple'
import { applySplitTextBefore, applySplitTextAfter, cancelSplitTextSession } from './apply-split-text'
import { applySplitCellsBefore, applySplitCellsAfter, applyCellsBRect, cancelSplitCellsSession } from './apply-split-cells'
import type { CellsEmitter } from './apply-split-cells'
import type {
  RuntimeModule,
  RuntimeModuleBinding,
  RuntimeModuleHost,
  RuntimeModuleHookPayload,
  RuntimeModuleEventPayload,
} from '../../components/types'

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

    host.emit({
      name: 'replace:initial-size',
      payload: { persoId, width: node.offsetWidth, height: node.offsetHeight },
      insertMode: 'persist-only',
      ms: host.timeline.currentMs,
    })

    if (command.split === undefined) {
      cancelSimpleSession(node)
      applySimpleBefore(node, parent)
    } else if (command.split === 'cells') {
      cancelSplitCellsSession(node)
      const imgChild = node.querySelector<HTMLImageElement>('img')
      const currentSrc = imgChild?.src ?? ''
      applySplitCellsBefore(node, parent, currentSrc, command)
    } else {
      cancelSplitTextSession(node)
      applySplitTextBefore(node, parent, command.split)
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

    const eventId = payload.resolvedAction?.eventId ?? ''
    const eventName = payload.resolvedAction?.eventName ?? ''
    const listenerId = payload.resolvedAction?.listenerId ?? ''

    if (command.split === undefined) {
      const circuit = action.src !== undefined ? 'async' : 'sync'
      const emitter: ReplaceSimpleEmitter = {
        emit: (input) => host.emit({ name: input.name, payload: input.payload, insertMode: 'persist-only', ms: input.ms }),
        currentMs: () => host.timeline.currentMs,
      }
      const transitions = applySimpleAfter({
        el: node,
        command,
        eventId,
        eventName,
        listenerId,
        persoId,
        circuit,
        emitter,
      })
      output.directTransitions.push(...transitions)
    } else if (command.split === 'cells') {
      const cellsEmitter: CellsEmitter = {
        emit: (inp) => host.emit({ name: inp.name, payload: inp.payload, insertMode: 'persist-only', ms: inp.ms }),
        currentMs: () => host.timeline.currentMs,
      }
      const transitions = applySplitCellsAfter({ el: node, command, eventId, eventName, listenerId, persoId, emitter: cellsEmitter })
      output.directTransitions.push(...transitions)
    } else {
      const transitions = applySplitTextAfter({ el: node, command, eventId, eventName, listenerId, persoId })
      output.directTransitions.push(...transitions)
    }
  }

  function onDimensionsReady(eventPayload: RuntimeModuleEventPayload): void {
    const { persoId, width, height } = eventPayload.payload
    if (typeof persoId !== 'string') return
    if (typeof width !== 'number' || typeof height !== 'number') return
    const node = host.registries.node.get(persoId)
    if (!isDomHTMLElement(node)) return
    applyCloneBDimensions(node, width, height)
  }

  function onInitialSize(eventPayload: RuntimeModuleEventPayload): void {
    const { persoId, width, height } = eventPayload.payload
    if (typeof persoId !== 'string') return
    if (typeof width !== 'number' || typeof height !== 'number') return
    const node = host.registries.node.get(persoId)
    if (!isDomHTMLElement(node)) return
    const img = node.querySelector<HTMLImageElement>('img')
    if (img === null) return
    if (img.complete && img.naturalWidth > 0) return
    node.style.width = `${width}px`
    node.style.height = `${height}px`
    img.addEventListener('load', () => {
      node.style.width = ''
      node.style.height = ''
    }, { once: true })
  }

  function onCellsRectReady(eventPayload: RuntimeModuleEventPayload): void {
    const { persoId, renderedW, renderedH, offsetX, offsetY } = eventPayload.payload
    if (typeof persoId !== 'string') return
    if (typeof renderedW !== 'number' || typeof renderedH !== 'number') return
    if (typeof offsetX !== 'number' || typeof offsetY !== 'number') return
    const node = host.registries.node.get(persoId)
    if (!isDomHTMLElement(node)) return
    applyCellsBRect(node, { renderedW, renderedH, offsetX, offsetY })
  }

  return {
    runtime: {
      hooks: { beforeUpdate, afterUpdate },
      match: { actionKeys: ['replace'] },
    },
    events: {
      'replace:dimensions-ready': onDimensionsReady,
      'replace:cells-rect-ready': onCellsRectReady,
      'replace:initial-size': onInitialSize,
    },
  }
}

function isDomHTMLElement(node: unknown): node is HTMLElement {
  return typeof globalThis.HTMLElement !== 'undefined' && node instanceof globalThis.HTMLElement
}

export const replaceModule: RuntimeModule = { install }
