import { utils } from 'animejs'

import { RUNTIME_OBJECT_EVENT_HANDLERS } from '../../create-element'
import type { CreateElementOptions } from '../../create-element'
import type { EmitRule, EmitRuleAction, ItemDoc, RuntimeEmitSelf } from '../../types'
import type { RuntimeComponentClassInput, RuntimeComponentWarningReporter } from '../types'
import {
  appendDomChild,
  applyAttrPatch,
  applyClassNamePatch,
  applyImageAlt,
  applyImageSource,
  applyNodeId,
  applyObjectFit,
  createRuntimeNode,
  isDomElement,
  resetRuntimeNodeState,
  resolveFinalValue
} from './dom-component-adapter'
import { resolveContainerQueryValue } from './container-query-units'

export type ClassNameProps = string | { add?: string; remove?: string }
export type AttrProps = Record<string, unknown>
export type StyleProps = Record<string, unknown>
export type StylePropsOptions = {
  skipTransitionValues?: boolean
}
export type ImageFitMode = 'wallpaper' | 'sprite'

type RuntimeObjectEventNode = Record<string, unknown> & {
  [RUNTIME_OBJECT_EVENT_HANDLERS]?: Record<string, () => void>
}

/**
 * Checks whether one style entry uses one transition-like payload.
 */
function isTransitionStyleValue(rawValue: unknown): rawValue is { to: unknown } {
  return typeof rawValue === 'object' && rawValue !== null && 'to' in rawValue
}

const IDENTITY_TRANSLATE = /translate\(\s*([^,)]+)\s*,\s*([^,)]+)\s*\)\s*/i
const IDENTITY_ROTATE = /rotate\(\s*([^)]+)\s*\)\s*/i
const IDENTITY_SCALE = /scale\(\s*([^,)]+)\s*,\s*([^,)]+)\s*\)\s*/i

/**
 * Strips `translate(0, 0)` / `rotate(0deg)` / `scale(1, 1)` segments from a composed
 * `transform` string — anime.js (`buildTransformString`) always emits every cached
 * transform sub-property unconditionally, identity value or not (confirmed:
 * `node_modules/animejs/dist/modules/core/transforms.js`). Only these 3 two-argument
 * forms are ever produced by this runtime's own transform usage (translate/rotate/scale,
 * never translate3d/matrix) — not a general-purpose transform parser.
 */
function stripIdentityTransforms(transform: string): string {
  if (transform === '' || transform === 'none') {
    return transform
  }
  let result = transform
  result = result.replace(IDENTITY_TRANSLATE, (segment, x: string, y: string) =>
    Number.parseFloat(x) === 0 && Number.parseFloat(y) === 0 ? '' : segment
  )
  result = result.replace(IDENTITY_ROTATE, (segment, deg: string) => (Number.parseFloat(deg) === 0 ? '' : segment))
  result = result.replace(IDENTITY_SCALE, (segment, x: string, y: string) =>
    Number.parseFloat(x) === 1 && Number.parseFloat(y) === 1 ? '' : segment
  )
  return result.trim()
}

/**
 * Resolves one image fit mode into the corresponding object-fit value.
 */
function resolveImageObjectFit(fitMode: ImageFitMode): 'cover' | 'contain' {
  return fitMode === 'sprite' ? 'contain' : 'cover'
}

/**
 * Normalizes one authored emit declaration into one action list.
 */
function normalizeEmitRuleActions(rule: EmitRule): EmitRuleAction[] {
  return Array.isArray(rule) ? rule : [rule]
}

/**
 * Creates one runtime self payload exposed during perso emit.
 */
function createRuntimeEmitSelf(item: ItemDoc): RuntimeEmitSelf {
  return {
    id: item.id,
    name: item.name,
    storyId: item.storyId
  }
}

/**
 * Creates one component root using the shared runtime node factory.
 */
export function createComponentRoot(
  perso: RuntimeComponentClassInput['perso'],
  tagName: string,
  createElementOptions: RuntimeComponentClassInput['createElementOptions']
): unknown {
  return createRuntimeNode(perso, tagName, createElementOptions)
}

/**
 * Resets one component root before reapplying authored state.
 */
export function resetComponentRoot(nodeRef: unknown): void {
  resetRuntimeNodeState(nodeRef)
}

/**
 * Applies one stable runtime id on the component root.
 */
export function setComponentRootId(nodeRef: unknown, itemId: string, authoredId: unknown): void {
  applyNodeId(nodeRef, typeof authoredId === 'string' ? authoredId : itemId)
}

/**
 * Applies one className payload on one node-like target.
 */
export function applyClassNameProps(
  nodeRef: unknown | null | undefined,
  className: ClassNameProps | undefined
): void {
  if (nodeRef === null || nodeRef === undefined) {
    return
  }

  applyClassNamePatch(nodeRef, className)
}

/**
 * Applies one attribute prop map on one node-like target.
 */
export function applyAttrProps(nodeRef: unknown | null | undefined, attr: AttrProps | undefined): void {
  if (nodeRef === null || nodeRef === undefined) {
    return
  }

  applyAttrPatch(nodeRef, attr)
}

/**
 * Applies one style prop map with hot-path oriented loops.
 */
export function applyStyleProps(
  nodeRef: unknown | null | undefined,
  styleProps: StyleProps | undefined,
  options: StylePropsOptions = {}
): void {
  if (nodeRef === null || nodeRef === undefined || styleProps === undefined) {
    return
  }

  if (isDomElement(nodeRef)) {
    const style = (nodeRef as unknown as { style?: Record<string, unknown> }).style
    if (style === undefined || style === null) {
      return
    }

    const styleWithSetProperty = style as Record<string, unknown> & {
      setProperty?: (propertyName: string, value: string) => void
      removeProperty?: (propertyName: string) => void
    }

    const definedPatch: Record<string, unknown> = {}

    for (const key in styleProps) {
      const rawValue = styleProps[key]
      if (options.skipTransitionValues && isTransitionStyleValue(rawValue)) {
        continue
      }

      const finalValue = resolveFinalValue(rawValue)
      if (finalValue === undefined || finalValue === null) {
        if (key.includes('-')) {
          styleWithSetProperty.removeProperty?.(key)
        } else {
          style[key] = ''
        }
        continue
      }

      definedPatch[key] = resolveContainerQueryValue(nodeRef, finalValue)
    }

    if (Object.keys(definedPatch).length > 0) {
      utils.set(nodeRef, definedPatch as Parameters<typeof utils.set>[1])
      const composedTransform = style.transform
      if (typeof composedTransform === 'string' && composedTransform !== '') {
        const cleaned = stripIdentityTransforms(composedTransform)
        if (cleaned !== composedTransform) {
          style.transform = cleaned === '' ? '' : cleaned
        }
      }
    }
    return
  }

  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return
  }

  const mutableNode = nodeRef as Record<string, unknown>
  const currentStyle =
    typeof mutableNode.style === 'object' && mutableNode.style !== null
      ? (mutableNode.style as Record<string, unknown>)
      : {}

  for (const key in styleProps) {
    const rawValue = styleProps[key]
    if (options.skipTransitionValues && isTransitionStyleValue(rawValue)) {
      continue
    }

    currentStyle[key] = resolveFinalValue(rawValue)
  }

  mutableNode.style = currentStyle
}

export type NodePose = {
  x: number
  y: number
  rotate: number
  scaleX: number
  scaleY: number
  width: number
  height: number
}

/**
 * Reads back the pose anime.js currently holds for one node — the same
 * engine `applyStyleProps` hands x/y/rotate/scaleX/scaleY/width/height to via
 * `utils.set`, and the only one guaranteed to know which DOM representation
 * it chose (discrete properties or a composed `transform`) for a given
 * target. Authoring code must never re-derive this from `getComputedStyle`
 * itself — that reconstruction silently drifts from whatever anime actually
 * wrote (confirmed: a rotation applied via `utils.set` composes into
 * `transform`, never into the discrete `rotate` CSS property, so re-deriving
 * from computed style loses it across a node replacement).
 */
export function readNodePose(nodeRef: unknown): NodePose | null {
  if (!isDomElement(nodeRef)) {
    return null
  }

  const read = (prop: string, fallback: number): number => {
    const value = Number(utils.get(nodeRef, prop, false))
    return Number.isFinite(value) ? value : fallback
  }

  return {
    x: read('x', 0),
    y: read('y', 0),
    rotate: read('rotate', 0),
    scaleX: read('scaleX', 1),
    scaleY: read('scaleY', 1),
    width: read('width', 0),
    height: read('height', 0)
  }
}

/**
 * Generalization of `readNodePose` to an arbitrary, caller-supplied property list — same accessor
 * (`utils.get`, never `getComputedStyle`), same reasoning (anime.js is the only module that knows
 * which DOM representation it chose for a given target). Unlike `readNodePose`, this calls the
 * 2-argument form of `utils.get` (no `unit` argument) rather than `utils.get(nodeRef, prop, false)`
 * — confirmed empirically: the 3-argument `false` form (bare-number coercion) only works for
 * anime's own fixed pose vocabulary (`x`/`y`/`rotate`/`scaleX`/`scaleY`/`width`/`height`) and
 * silently returns `undefined` for anything else (e.g. `background-color`), even right after a
 * `utils.set` on that exact property. The 2-argument form works universally — always a string,
 * unit-suffixed for lengths (`"8px"`), verbatim for colors (`"oklch(...)"`), and `null` for a
 * property anime can't resolve at all (never a default/zero value standing in for "unknown").
 *
 * Not gesture-safe: while `LibreAdapter` (`packages/authoring/selection-frame`) is actively
 * mutating a node during a CS gesture, it writes `translate`/`rotate`/`scale`/`width`/`height`
 * directly on the node, bypassing `utils.set` — anime's cache (what this function reads) is stale
 * until the next rebuild reconciles it. Callers must gate on gesture-active state themselves, same
 * as `offset-editor-bridge.ts::readLiveGestureNodePose` already does for pose.
 */
export function readNodeSnapshot(nodeRef: unknown, props: readonly string[]): Record<string, string | number> | null {
  if (!isDomElement(nodeRef)) {
    return null
  }

  const snapshot: Record<string, string | number> = {}
  for (const prop of props) {
    const value = utils.get(nodeRef, prop)
    if (value !== undefined && value !== null) snapshot[prop] = value
  }
  return snapshot
}

/**
 * Applies one text content value on one node-like target.
 */
export function setTextContent(nodeRef: unknown, content: string): void {
  if (isDomElement(nodeRef)) {
    nodeRef.textContent = content
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).textContent = content
  }
}

/**
 * Creates or reuses one image part attached to one root node.
 */
export function ensureImagePart(rootNode: unknown, currentNode: unknown | null): unknown {
  if (isDomElement(rootNode)) {
    const existingNode = currentNode ?? rootNode.querySelector('img') ?? globalThis.document.createElement('img')
    appendDomChild(rootNode, existingNode)
    return existingNode
  }

  return currentNode ?? {
    tagName: 'IMG',
    style: {},
    attributes: {}
  }
}

/**
 * Resets one image part before reapplying authored media props.
 */
export function resetImagePart(nodeRef: unknown): void {
  resetRuntimeNodeState(nodeRef)
}

/**
 * Applies one image source url on one image part.
 */
export function setImageSource(nodeRef: unknown, src: string): void {
  applyImageSource(nodeRef, src)
}

/**
 * Applies one image alternative text on one image part.
 */
export function setImageAlt(nodeRef: unknown, alt: string): void {
  applyImageAlt(nodeRef, alt)
}

/**
 * Applies one image fit mode on one image part.
 */
export function setImageFitMode(nodeRef: unknown, fitMode: ImageFitMode): void {
  applyObjectFit(nodeRef, resolveImageObjectFit(fitMode))
}

/**
 * Binds emit declarations on component refs using one handleEvent dispatcher per target.
 */
export function bindComponentEmitDeclarations(input: {
  perso: ItemDoc
  createElementOptions: CreateElementOptions | undefined
  resolveRef: (ref?: string) => unknown | null
  report: RuntimeComponentWarningReporter
}): void {
  const emitRuntimeEvent = input.createElementOptions?.emitRuntimeEvent
  if (!emitRuntimeEvent || !input.perso.emit) {
    return
  }

  const handlersByTarget = new Map<unknown, Map<string, EmitRuleAction[]>>()

  for (const [eventName, rule] of Object.entries(input.perso.emit)) {
    for (const action of normalizeEmitRuleActions(rule as EmitRule)) {
      const targetNode = input.resolveRef(action.ref)
      if (targetNode === null) {
        input.report({
          code: 'AUTHOR_COMPONENT_REF_UNKNOWN',
          message: 'Component ref is unknown',
          details: {
            persoId: input.perso.id,
            eventName,
            ref: action.ref
          }
        })
        continue
      }

      const eventRulesByName = handlersByTarget.get(targetNode) ?? new Map<string, EmitRuleAction[]>()
      const existingActions = eventRulesByName.get(eventName) ?? []
      existingActions.push(action)
      eventRulesByName.set(eventName, existingActions)
      handlersByTarget.set(targetNode, eventRulesByName)
    }
  }

  const self = createRuntimeEmitSelf(input.perso)

  for (const [targetNode, eventRulesByName] of handlersByTarget) {
    const eventHandler = {
      handleEvent(event: Event): void {
        const rules = eventRulesByName.get(event.type) ?? []
        for (const action of rules) {
          const data = action.data === undefined ? { self } : { ...action.data, self }
          emitRuntimeEvent({
            name: action.event.name,
            data,
            cascade: action.event.cascade,
            scopeStoryId: action.event.cascade === true ? undefined : input.perso.storyId
          })
        }
      }
    }

    for (const eventName of eventRulesByName.keys()) {
      if (isDomElement(targetNode)) {
        targetNode.addEventListener(eventName, eventHandler)
        continue
      }

      if (typeof targetNode === 'object' && targetNode !== null) {
        const runtimeNode = targetNode as RuntimeObjectEventNode
        runtimeNode[RUNTIME_OBJECT_EVENT_HANDLERS] = {
          ...(runtimeNode[RUNTIME_OBJECT_EVENT_HANDLERS] ?? {}),
          [eventName]: () => {
            eventHandler.handleEvent({ type: eventName } as Event)
          }
        }
      }
    }
  }
}
