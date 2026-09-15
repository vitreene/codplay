import type { SightyDataBinding, SightyDataValue } from '../types'
import type { ActiveSelection } from './types'
import type { ViewIndex } from './types'

/** Contains resolved view data and the keys that must be refreshed live. */
export type ResolvedViewData = Readonly<{
  values: Readonly<Record<string, unknown>>
  declaredKeys: ReadonlySet<string>
  liveKeys: ReadonlySet<string>
  events: ReadonlyMap<string, string>
}>

/** Resolves inherited view data against scenario data and the current context. */
export function resolveViewData<SceneKey extends string, SlotName extends string>(
  index: ViewIndex<SceneKey, SlotName>,
  selection: ActiveSelection<SceneKey, SlotName>,
  scenarioData: Readonly<Record<string, unknown>>,
  context: Readonly<Record<string, unknown>>,
): ResolvedViewData {
  const values: Record<string, unknown> = { ...scenarioData }
  const declaredKeys = new Set<string>()
  const liveKeys = new Set<string>()
  const events = new Map<string, string>()
  const declarations = collectDataDeclarations(selection)

  for (const declaration of declarations) {
    for (const [key, value] of Object.entries(declaration.data ?? {})) {
      declaredKeys.add(key)
      if (isDataBinding(value)) {
        values[key] = readPath(value.from, scenarioData, context)
        if (value.update === 'live') liveKeys.add(key)
        events.set(key, value.event ?? 'data:update')
      } else {
        values[key] = value
        liveKeys.delete(key)
        events.delete(key)
      }
    }
  }

  // Keep the index in the function signature explicit: data resolution is
  // tied to the same normalized selection as navigation, not to raw paths.
  void index
  return { values, declaredKeys, liveKeys, events }
}

/** Collects data declarations from the least specific scope to the local view. */
function collectDataDeclarations<SceneKey extends string, SlotName extends string>(
  selection: ActiveSelection<SceneKey, SlotName>,
): readonly Readonly<{ path: string; data?: Readonly<Record<string, SightyDataValue>> }>[] {
  const declarations = [
    ...selection.entry.graphScopes.map((graph) => ({ path: graph.path, data: graph.scope.data })),
    ...selection.entry.parentViews.map((parent) => ({ path: parent.path, data: parent.view.data })),
    { path: selection.entry.path, data: selection.entry.view.data },
  ]
  return declarations
    .map((declaration, order) => ({ ...declaration, order }))
    .sort((left, right) => {
      const depthDifference = pathDepth(left.path) - pathDepth(right.path)
      return depthDifference === 0 ? left.order - right.order : depthDifference
    })
}

/** Tests the structural shape used by one data binding. */
function isDataBinding(value: SightyDataValue): value is SightyDataBinding {
  return typeof value === 'object'
    && value !== null
    && 'from' in value
    && typeof (value as { from?: unknown }).from === 'string'
    && 'update' in value
    && ((value as { update?: unknown }).update === 'entry' || (value as { update?: unknown }).update === 'live')
}

/** Resolves a dotted path from context or scenario data without evaluating code. */
function readPath(
  source: string,
  scenarioData: Readonly<Record<string, unknown>>,
  context: Readonly<Record<string, unknown>>,
): unknown {
  const normalized = source.trim()
  if (normalized.startsWith('context.')) return readNested(context, normalized.slice('context.'.length))
  if (normalized === 'context') return context
  if (normalized.startsWith('data.')) return readNested(scenarioData, normalized.slice('data.'.length))
  if (normalized === 'data') return scenarioData
  const fromContext = readNested(context, normalized)
  return fromContext === undefined ? readNested(scenarioData, normalized) : fromContext
}

/** Reads one dot-separated property path from a record. */
function readNested(source: Readonly<Record<string, unknown>>, path: string): unknown {
  if (path.length === 0) return source
  let current: unknown = source
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null || !(segment in current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** Computes a deterministic specificity depth for data declarations. */
function pathDepth(path: string): number {
  return path.length === 0 ? 0 : path.split('/').length
}
