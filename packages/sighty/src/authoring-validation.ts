import type {
  SightyAuthoringDiagnostic,
  SightyGraphView,
  SightyScenarioResources,
} from './types'
import {
  findGraphViewByPath,
  getGraphEntries,
  getDirectGraphEntries,
  isSightyViewMap,
  normalizeSightyViewGraph,
} from './view-graph'

/** Validates authored scene resources and view references without executing them. */
export function validateAuthoringResources<
  SceneKey extends string = string,
  SlotName extends string = string,
>(resources: SightyScenarioResources<SceneKey, SlotName>): readonly SightyAuthoringDiagnostic[] {
  const diagnostics: SightyAuthoringDiagnostic[] = []
  const embeddedSceneResources = resources.file.resources?.scenes
  const declaredSceneKeys = new Set(
    embeddedSceneResources === undefined
      ? [
          ...Object.keys(resources.scenes ?? {}),
          ...Object.keys(resources.sceneSources ?? {}),
        ]
      : Object.keys(embeddedSceneResources),
  )

  /** Checks whether a scene is declared and available in the authoring catalog. */
  const hasAvailableScene = (sceneKey: string): boolean =>
    declaredSceneKeys.has(sceneKey) && (
      resources.scenes?.[sceneKey as SceneKey] !== undefined
      || resources.sceneSources?.[sceneKey as SceneKey] !== undefined
    )

  if (embeddedSceneResources !== undefined) {
    for (const sceneKey of Object.keys(embeddedSceneResources)) {
      if (
        resources.scenes?.[sceneKey as SceneKey] === undefined
        && resources.sceneSources?.[sceneKey as SceneKey] === undefined
      ) {
        diagnostics.push({
          code: 'AUTHOR_SCENE_RESOURCE_MISSING',
          path: `resources.scenes.${sceneKey}`,
          message: `La scène auteur « ${sceneKey} » est déclarée dans le fichier mais absente du catalogue.`,
        })
      }
    }

    for (const sceneKey of Object.keys(resources.scenes ?? {})) {
      if (!declaredSceneKeys.has(sceneKey)) {
        diagnostics.push({
          code: 'AUTHOR_SCENE_RESOURCE_UNDECLARED',
          path: `scenes.${sceneKey}`,
          message: `La scène auteur « ${sceneKey} » est présente dans le catalogue mais absente du fichier.`,
        })
      }
    }

    for (const sceneKey of Object.keys(resources.sceneSources ?? {})) {
      if (!declaredSceneKeys.has(sceneKey)) {
        diagnostics.push({
          code: 'AUTHOR_SCENE_RESOURCE_UNDECLARED',
          path: `sceneSources.${sceneKey}`,
          message: `La source de scène auteur « ${sceneKey} » est présente dans le catalogue mais absente du fichier.`,
        })
      }
    }
  }

  const viewGraph = normalizeSightyViewGraph<SceneKey, SlotName>(resources.file.views, resources.file.version)
  const graphEntries = getGraphEntries(viewGraph)

  /** Checks one view node, its nested slots and its route declarations. */
  const validateView = (entryPath: string, view: SightyGraphView<SceneKey, SlotName>): void => {
    const sceneKey = view.view.scene
    if (sceneKey !== undefined && !hasAvailableScene(sceneKey)) {
      const isRootView = !entryPath.includes('/')
      diagnostics.push({
        code: isRootView ? 'AUTHOR_VIEW_SCENE_UNKNOWN' : 'AUTHOR_VIEW_CHILD_SCENE_UNKNOWN',
        path: `views.${entryPath}.view.scene`,
        message: `La vue « ${entryPath} » référence la scène inconnue « ${sceneKey} ».`,
      })
    }

    validateActions(`de la vue « ${entryPath} »`, entryPath, view.actions)

    const slots = view.view.slots ?? {}
    for (const [slotName, childGraph] of Object.entries(slots) as [string, typeof viewGraph][]) {
      validateGraph(childGraph, `${entryPath}/${slotName}`)
    }
    if (view.view.views !== undefined) validateGraph(view.view.views, entryPath)
    if (view.view.graph !== undefined) validateGraph(view.view.graph, `${entryPath}/graph`)
  }

  /** Checks one graph container and validates its declared start node. */
  const validateGraph = (graph: typeof viewGraph, graphPath: string): void => {
    if (isSightyViewMap(graph) && getDirectGraphEntries(graph, graphPath).every((entry) => entry.key !== graph.start)) {
      diagnostics.push({
        code: 'AUTHOR_VIEW_GRAPH_START_UNKNOWN',
        path: `views.${graphPath}.start`,
        message: `Le graphe « ${graphPath} » désigne un départ inconnu « ${graph.start} ».`,
      })
    }
    if (isSightyViewMap(graph)) {
      validateActions(`du graphe « ${graphPath || 'racine'} »`, graphPath, graph.actions)
    }

    if (!isSightyViewMap(graph)) {
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

  /** Validates route paths in one author action scope. */
  function validateActions(
    scopeLabel: string,
    scopePath: string,
    actions: Readonly<Record<string, { go?: unknown }>> | undefined,
  ): void {
    for (const [eventName, action] of Object.entries(actions ?? {})) {
      const target = action.go
      const actionPath = scopePath.length === 0
        ? `views.actions.${eventName}.go.path`
        : `views.${scopePath}.actions.${eventName}.go.path`
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

  validateGraph(viewGraph, '')

  return diagnostics
}
