import { isHtmlElementNode } from '../../../services/html-materializer-service-types'
import type { MaterializedAction, SolvedScene } from '../../player/pipeline'

type HtmlElementMethodInstruction =
  | Readonly<{ name: 'focus'; preventScroll: boolean }>
  | Readonly<{ name: 'blur' }>

/** Applies newly activated HTML method actions to their currently mounted perso roots. */
export function applyActivatedHtmlElementMethods(
  scene: SolvedScene,
  previousScene: SolvedScene | undefined,
  nodes: ReadonlyMap<string, unknown>,
): void {
  const previousOccurrences = collectMethodOccurrenceKeys(previousScene)

  for (const perso of Object.values(scene.persos)) {
    if (!perso.placement.mounted) continue
    const node = nodes.get(perso.key)
    if (!isHtmlElementNode(node)) continue

    for (const occurrence of perso.actions ?? []) {
      if (previousOccurrences.has(methodOccurrenceKey(perso.key, occurrence))) continue
      const instruction = parseHtmlElementMethod(occurrence.action.htmlElementMethod)
      if (instruction === undefined) continue
      applyHtmlElementMethod(node, instruction)
    }
  }
}

/** Returns the stable identities of method occurrences already present in a scene. */
function collectMethodOccurrenceKeys(scene: SolvedScene | undefined): ReadonlySet<string> {
  const keys = new Set<string>()
  if (scene === undefined) return keys
  for (const perso of Object.values(scene.persos)) {
    for (const occurrence of perso.actions ?? []) {
      if (occurrence.action.htmlElementMethod === undefined) continue
      keys.add(methodOccurrenceKey(perso.key, occurrence))
    }
  }
  return keys
}

/** Identifies one action occurrence independently of its elapsed presentation time. */
function methodOccurrenceKey(persoKey: string, occurrence: MaterializedAction): string {
  return JSON.stringify([
    persoKey,
    occurrence.name,
    occurrence.trackId,
    occurrence.trackOrder,
    occurrence.startAt,
    occurrence.eventId,
    occurrence.eventSeq,
    occurrence.declarationPath,
  ])
}

/** Accepts only the closed method forms agreed for the HTML projection. */
function parseHtmlElementMethod(value: unknown): HtmlElementMethodInstruction | undefined {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return undefined
  if (value.length === 1 && value[0] === 'focus') return { name: 'focus', preventScroll: false }
  if (value.length === 2 && value[0] === 'focus' && value[1] === 'preventscroll') {
    return { name: 'focus', preventScroll: true }
  }
  if (value.length === 1 && value[0] === 'blur') return { name: 'blur' }
  return undefined
}

/** Calls the one selected DOM method without observing its return value. */
function applyHtmlElementMethod(
  node: object,
  instruction: HtmlElementMethodInstruction,
): void {
  const element = node as object & {
    focus?: (options?: FocusOptions) => void
    blur?: () => void
  }
  if (instruction.name === 'focus') {
    if (typeof element.focus !== 'function') return
    if (instruction.preventScroll) element.focus({ preventScroll: true })
    else element.focus()
    return
  }
  if (typeof element.blur === 'function') element.blur()
}
