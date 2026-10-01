import type {
  SightyAuthoringDiagnostic,
  SightyGraphView,
  SightyScenarioDefinition,
  SightyShowMode,
  SightyTelcoCommand,
} from './types'
import {
  findGraphViewByPath,
  getGraphEntries,
  getDirectGraphEntries,
} from './view-graph'
import { isAuthoredViewMap } from './navigation/graph-entries'

/** Checks the namespace required for one registered scenario action key. */
function isActionKey(value: string): boolean {
  return isReadableRegistryKey(value, 'action')
}

/** Checks the namespace required for one registered scenario guard key. */
function isGuardKey(value: string): boolean {
  return isReadableRegistryKey(value, 'guard')
}

/** Requires a visible namespace, domain and semantic name in one registry key. */
function isReadableRegistryKey(value: string, namespace: 'action' | 'guard'): boolean {
  const [prefix, domain, name, ...extra] = value.split(':')
  return prefix === namespace
    && extra.length === 0
    && domain !== undefined
    && domain.trim().length > 0
    && name !== undefined
    && name.trim().length > 0
}

/** Validates authored scenario scenes and view references without executing them. */
export function validateAuthoringResources<
  SceneKey extends string = string,
  SlotName extends string = string,
>(scenario: SightyScenarioDefinition<SceneKey, SlotName>): readonly SightyAuthoringDiagnostic[] {
  const diagnostics: SightyAuthoringDiagnostic[] = []
  /** Checks whether a scene is declared and available in the authoring catalog. */
  const hasAvailableScene = (sceneKey: string): boolean =>
    scenario.scenes?.[sceneKey as SceneKey] !== undefined
    || scenario.sceneSources?.[sceneKey as SceneKey] !== undefined

  const viewGraph = scenario.views
  const graphEntries = getGraphEntries(viewGraph)
  const showModes = new Set<SightyShowMode>(['reset', 'maintain', 'rewind'])
  const telcoCommands = new Set<SightyTelcoCommand>([
    'play',
    'pause',
    'togglePlay',
    'setRate',
    'seek',
    'rewind',
    'reset',
  ])

  /** Validates the namespaces of the registries kept on the scenario. */
  function validateRegistryKeys(): void {
    for (const key of Object.keys(scenario.actions ?? {})) {
      if (isActionKey(key)) continue
      diagnostics.push({
        code: 'AUTHOR_ACTION_KEY_INVALID',
        path: `actions.${key}`,
        message: `La clé d'action « ${key} » doit suivre la convention lisible « action:<domaine>:<verbe> » et rester distincte d'un identifiant de scène.`,
      })
    }
    for (const key of Object.keys(scenario.guards ?? {})) {
      if (isGuardKey(key)) continue
      diagnostics.push({
        code: 'AUTHOR_GUARD_KEY_INVALID',
        path: `guards.${key}`,
        message: `La clé de guard « ${key} » doit suivre la convention lisible « guard:<domaine>:<prédicat> » et rester distincte d'un identifiant de scène.`,
      })
    }
  }

  /** Checks one view node, its nested slots and its route declarations. */
  const validateView = (entryPath: string, view: SightyGraphView<SceneKey, SlotName>): void => {
    validateShowMode(`views.${entryPath}.showMode`, view.showMode)
    validateEntry(`views.${entryPath}.entry`, view.entry)
    const sceneKey = view.view.scene
    if (sceneKey !== undefined && !hasAvailableScene(sceneKey)) {
      const isRootView = !entryPath.includes('/')
      diagnostics.push({
        code: isRootView ? 'AUTHOR_VIEW_SCENE_UNKNOWN' : 'AUTHOR_VIEW_CHILD_SCENE_UNKNOWN',
        path: `views.${entryPath}.view.scene`,
        message: `La vue « ${entryPath} » référence la scène inconnue « ${sceneKey} ».`,
      })
    }

    validateActionReference(`views.${entryPath}.action`, view.action)
    validateActions(`de la vue « ${entryPath} »`, entryPath, view.actions)
    validateConditionReference(`views.${entryPath}.accessBy`, view.accessBy)
    validateConditionReference(`views.${entryPath}.exitBy`, view.exitBy)
    validateCoupling(entryPath, view)

    const slots = view.view.slots ?? {}
    for (const [slotName, childGraph] of Object.entries(slots) as [string, typeof viewGraph][]) {
      validateGraph(childGraph, `${entryPath}/${slotName}`)
    }
    if (view.view.views !== undefined) validateGraph(view.view.views, entryPath)
  }

  /** Validates the event or ordered event list declared for one view entry. */
  function validateEntry(path: string, entry: unknown): void {
    if (entry === undefined) return
    const events = Array.isArray(entry) ? entry : [entry]
    if (events.length === 0) {
      diagnostics.push({
        code: 'AUTHOR_ENTRY_EVENTS_EMPTY',
        path,
        message: `La déclaration entry « ${path} » doit contenir au moins un événement.`,
      })
      return
    }

    events.forEach((eventime, index) => {
      const eventName = typeof eventime === 'object' && eventime !== null
        ? (eventime as { name?: unknown }).name
        : undefined
      if (typeof eventName === 'string' && eventName.trim().length > 0) return

      diagnostics.push({
        code: 'AUTHOR_ENTRY_EVENT_NAME_MISSING',
        path: Array.isArray(entry) ? `${path}[${index}].name` : `${path}.name`,
        message: `Chaque événement entry « ${path} » doit avoir un nom non vide.`,
      })
    })
  }

  /** Validates one view-level event-to-telco relation without executing it. */
  function validateCoupling(
    entryPath: string,
    view: SightyGraphView<SceneKey, SlotName>,
  ): void {
    const coupling = view.coupling
    if (coupling === undefined) return
    const couplingPath = `views.${entryPath}.coupling`
    if (typeof coupling.couplingId !== 'string' || coupling.couplingId.length === 0) {
      diagnostics.push({
        code: 'AUTHOR_COUPLING_ID_MISSING',
        path: `${couplingPath}.couplingId`,
        message: `Le couplage de la vue « ${entryPath} » doit avoir un identifiant non vide.`,
      })
    }

    const slotNames = new Set(Object.keys(view.view.slots ?? {}))
    if (coupling.controllerSlot !== undefined && !slotNames.has(coupling.controllerSlot)) {
      diagnostics.push({
        code: 'AUTHOR_COUPLING_CONTROLLER_SLOT_UNKNOWN',
        path: `${couplingPath}.controllerSlot`,
        message: `Le slot contrôleur « ${String(coupling.controllerSlot)} » du couplage « ${String(coupling.couplingId)} » est inconnu dans la vue « ${entryPath} ».`,
      })
    }
    if (!slotNames.has(coupling.controlledSlot)) {
      diagnostics.push({
        code: 'AUTHOR_COUPLING_CONTROLLED_SLOT_UNKNOWN',
        path: `${couplingPath}.controlledSlot`,
        message: `Le slot contrôlé « ${String(coupling.controlledSlot)} » du couplage « ${String(coupling.couplingId)} » est inconnu dans la vue « ${entryPath} ».`,
      })
    }

    for (const [eventName, declaration] of Object.entries(coupling.commands ?? {})) {
      const commands = Array.isArray(declaration) ? declaration : [declaration]
      for (const command of commands) {
        if (telcoCommands.has(command as SightyTelcoCommand)) continue
        diagnostics.push({
          code: 'AUTHOR_COUPLING_COMMAND_UNKNOWN',
          path: `${couplingPath}.commands.${eventName}`,
          message: `La commande telco « ${String(command)} » du couplage « ${String(coupling.couplingId)} » est inconnue.`,
        })
      }
    }
  }

  /** Checks one graph container and validates its declared start node. */
  const validateGraph = (graph: typeof viewGraph, graphPath: string): void => {
    validateShowMode(
      graphPath.length === 0 ? 'views.showMode' : `views.${graphPath}.showMode`,
      isAuthoredViewMap(graph) ? graph.showMode : undefined,
    )
    if (isAuthoredViewMap(graph) && getDirectGraphEntries(graph, graphPath).every((entry) => entry.key !== graph.start)) {
      diagnostics.push({
        code: 'AUTHOR_VIEW_GRAPH_START_UNKNOWN',
        path: `views.${graphPath}.start`,
        message: `Le graphe « ${graphPath} » désigne un départ inconnu « ${graph.start} ».`,
      })
    }
    if (isAuthoredViewMap(graph)) {
      const graphPrefix = graphPath.length === 0 ? 'views' : `views.${graphPath}`
      validateActionReference(`${graphPrefix}.action`, graph.action)
      validateActions(`du graphe « ${graphPath || 'racine'} »`, graphPath, graph.actions)
      validateConditionReference(`${graphPrefix}.accessBy`, graph.accessBy)
      validateConditionReference(`${graphPrefix}.exitBy`, graph.exitBy)
    }

    if (!isAuthoredViewMap(graph)) {
      const ids = new Set<string>()
      graph.forEach((entry, index) => {
        const id = (entry as { id?: unknown }).id
        if (typeof id !== 'string' || id.length === 0) {
          diagnostics.push({
            code: 'AUTHOR_VIEW_LIST_ID_MISSING',
            path: `views.${graphPath}[${index}].id`,
            message: `L'entrée ${index} de la liste « ${graphPath} » doit avoir un identifiant stable.`,
          })
          return
        }
        if (ids.has(id)) {
          diagnostics.push({
            code: 'AUTHOR_VIEW_LIST_ID_DUPLICATE',
            path: `views.${graphPath}[${index}].id`,
            message: `L'identifiant « ${id} » est dupliqué dans la liste « ${graphPath} ».`,
          })
        }
        ids.add(id)
      })
    }
    for (const entry of getDirectGraphEntries(graph, graphPath)) validateView(entry.path, entry.view)
  }

  /** Validates one optional occurrence policy at its author-facing path. */
  function validateShowMode(path: string, value: unknown): void {
    if (value === undefined || showModes.has(value as SightyShowMode)) return
    diagnostics.push({
      code: 'AUTHOR_SHOW_MODE_UNKNOWN',
      path,
      message: `La politique showMode « ${String(value)} » est inconnue. Les valeurs admises sont reset, maintain et rewind.`,
    })
  }

  /** Validates one action reference while preserving inline action functions. */
  function validateActionReference(path: string, action: unknown): void {
    if (action === undefined || typeof action === 'function') return
    if (typeof action === 'string' && isActionKey(action)) return
    diagnostics.push({
      code: 'AUTHOR_ACTION_REFERENCE_INVALID',
      path,
      message: `La référence d'action « ${String(action)} » doit suivre la convention lisible « action:<domaine>:<verbe> » ou être une fonction inline.`,
    })
  }

  /** Validates a named guard reference while preserving inline guard functions. */
  function validateConditionReference(path: string, condition: unknown): void {
    if (condition === undefined || typeof condition === 'function') return
    if (typeof condition === 'string' && isGuardKey(condition)) return
    diagnostics.push({
      code: 'AUTHOR_GUARD_REFERENCE_INVALID',
      path,
      message: `La référence de guard « ${String(condition)} » doit suivre la convention lisible « guard:<domaine>:<prédicat> » ou être une fonction inline.`,
    })
  }

  /** Validates route paths in one author action scope. */
  function validateActions(
    scopeLabel: string,
    scopePath: string,
    actions: Readonly<Record<string, { action?: unknown; go?: unknown; reset?: unknown }>> | undefined,
  ): void {
    for (const [eventName, action] of Object.entries(actions ?? {})) {
      const actionReferencePath = scopePath.length === 0
        ? `views.actions.${eventName}.action`
        : `views.${scopePath}.actions.${eventName}.action`
      validateActionReference(actionReferencePath, action.action)
      const target = action.go
      const actionPath = scopePath.length === 0
        ? `views.actions.${eventName}.go.path`
        : `views.${scopePath}.actions.${eventName}.go.path`
      const resetPath = scopePath.length === 0
        ? `views.actions.${eventName}.reset`
        : `views.${scopePath}.actions.${eventName}.reset`
      validateReset(resetPath, action.reset)
      if (typeof target !== 'object' || target === null) continue

      if ('path' in target) {
        const routePath = (target as { path?: unknown }).path
        if (typeof routePath !== 'string' || findGraphViewByPath(viewGraph, routePath) !== undefined) continue
        diagnostics.push({
          code: 'AUTHOR_VIEW_ROUTE_UNKNOWN',
          path: actionPath,
          message: `L'action « ${eventName} » ${scopeLabel} référence le chemin inconnu « ${String(routePath)} ».`,
        })
        continue
      }

      if (!('label' in target)) continue
      const routeLabel = (target as { label?: unknown }).label
      if (typeof routeLabel !== 'string') continue
      const matches = graphEntries.filter((entry) => entry.key === routeLabel)
      if (matches.length === 1) continue
      if (matches.length === 0) {
        diagnostics.push({
          code: 'AUTHOR_VIEW_ROUTE_UNKNOWN',
          path: actionPath.replace(/\.path$/, '.label'),
          message: `L'action « ${eventName} » ${scopeLabel} référence le label inconnu « ${routeLabel} ».`,
        })
        continue
      }
      diagnostics.push({
        code: 'AUTHOR_VIEW_ROUTE_AMBIGUOUS',
        path: actionPath.replace(/\.path$/, '.label'),
        message: `L'action « ${eventName} » ${scopeLabel} référence le label ambigu « ${routeLabel} ».`,
      })
    }
  }

  /** Validates one explicit list of replay reset keys. */
  function validateReset(path: string, reset: unknown): void {
    if (reset === undefined) return
    if (!Array.isArray(reset)) {
      diagnostics.push({
        code: 'AUTHOR_ACTION_RESET_INVALID',
        path,
        message: `La propriété reset « ${path} » doit être une liste de clés texte.`,
      })
      return
    }
    if (reset.length === 0) {
      diagnostics.push({
        code: 'AUTHOR_ACTION_RESET_EMPTY',
        path,
        message: `La propriété reset « ${path} » doit contenir au moins une clé.`,
      })
      return
    }
    if (!Array.from(reset).every((key) => typeof key === 'string' && key.trim().length > 0)) {
      diagnostics.push({
        code: 'AUTHOR_ACTION_RESET_INVALID',
        path,
        message: `Chaque clé de reset « ${path} » doit être un texte non vide.`,
      })
      return
    }
    if (reset.includes('all') && reset.length > 1) {
      diagnostics.push({
        code: 'AUTHOR_ACTION_RESET_ALL_MIXED',
        path,
        message: `La clé reset « all » doit apparaître seule dans « ${path} ».`,
      })
    }
  }

  validateRegistryKeys()
  validateShowMode('showMode', scenario.showMode)
  validateGraph(viewGraph, '')

  return diagnostics
}
