import type { AnimeSvgMorphOperation } from '../../../animation/types'
import type { ServiceApplyContext, ServiceInstance } from './component-services'

export type AnimeSvgMorphToInput = {
  target?: unknown
  to: unknown
  property?: 'd' | 'points'
  duration: number
  delayMs?: number
  ease?: string
  easing?: string
  precision?: number
  finalValue?: string
}

export type AnimeSvgService = ServiceInstance & {
  morphTo(input: AnimeSvgMorphToInput, context?: ServiceApplyContext): void
}

/**
 * Returns true when one value looks like an SVG morphable geometry element.
 */
function isSvgMorphElement(value: unknown): value is { tagName: string; getAttribute(name: string): string | null } {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as { tagName?: unknown; getAttribute?: unknown }
  if (typeof candidate.tagName !== 'string' || typeof candidate.getAttribute !== 'function') {
    return false
  }

  return /^(path|polygon|polyline)$/i.test(candidate.tagName)
}

/**
 * Resolves the attribute animated by morphTo for one target element.
 */
function resolveMorphProperty(target: { tagName: string }, property?: 'd' | 'points'): 'd' | 'points' {
  const expectedProperty = target.tagName.toLowerCase() === 'path' ? 'd' : 'points'
  if (property !== undefined && property !== expectedProperty) {
    throw new Error(`animeSvg.morphTo expected property "${expectedProperty}" for <${target.tagName.toLowerCase()}>`)
  }

  return expectedProperty
}

/**
 * Creates the core Anime SVG service. The service only emits abstract
 * operations; the central animation adapter is the sole Anime.js caller.
 */
export function createAnimeSvgService(): AnimeSvgService {
  const morphTo = (input: AnimeSvgMorphToInput, context?: ServiceApplyContext): void => {
    if (context === undefined) {
      return
    }

    if (!isSvgMorphElement(input.target)) {
      throw new Error('animeSvg.morphTo target must be an SVG <path>, <polygon> or <polyline> element')
    }
    if (!isSvgMorphElement(input.to)) {
      throw new Error('animeSvg.morphTo destination must be an SVG <path>, <polygon> or <polyline> element')
    }
    if (!Number.isFinite(input.duration) || input.duration < 0) {
      throw new Error('animeSvg.morphTo duration must be a positive number')
    }

    const property = resolveMorphProperty(input.target, input.property)
    const operation: AnimeSvgMorphOperation = {
      kind: 'anime-svg:morphTo',
      operationId: `anime-svg:morphTo:${context.eventId}:${context.listenerId}:${context.persoId}:${context.output.animationOperations.length}`,
      eventId: context.eventId,
      eventName: context.eventName,
      listenerId: context.listenerId,
      property,
      target: input.target,
      to: input.to,
      finalValue: input.finalValue ?? input.to.getAttribute(property) ?? undefined,
      duration: input.duration,
      delayMs: input.delayMs,
      ease: input.ease,
      easing: input.easing,
      precision: input.precision,
    }

    context.output.animationOperations.push(operation)
  }

  return {
    apply(node, value, context) {
      if (typeof value !== 'object' || value === null || !('morphTo' in value)) {
        return
      }

      const input = (value as { morphTo: Omit<AnimeSvgMorphToInput, 'target'> & { target?: unknown } }).morphTo
      morphTo({ ...input, target: input.target ?? node }, context)
    },
    morphTo,
  }
}
