import type {
  SightyAuthoringDiagnostic,
  SightyGraphView,
  SightyScenarioResources,
} from './types'
import {
  findGraphViewByPath,
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
  const declaredSceneKeys = new Set(Object.keys(embeddedSceneResources ?? resources.scenes))

  /** Checks whether a scene is declared and available in the authoring catalog. */
  const hasAvailableScene = (sceneKey: string): boolean =>
    declaredSceneKeys.has(sceneKey) && resources.scenes[sceneKey as SceneKey] !== undefined

  if (embeddedSceneResources !== undefined) {
    for (const sceneKey of declaredSceneKeys) {
      if (resources.scenes[sceneKey as SceneKey] === undefined) {
        diagnostics.push({
          code: 'AUTHOR_SCENE_RESOURCE_MISSING',
          path: `resources.scenes.${sceneKey}`,
          message: `La scène auteur « ${sceneKey} » est déclarée dans le fichier mais absente du catalogue.`,
        })
      }
    }

    for (const sceneKey of Object.keys(resources.scenes)) {
      if (!declaredSceneKeys.has(sceneKey)) {
        diagnostics.push({
          code: 'AUTHOR_SCENE_RESOURCE_UNDECLARED',
          path: `scenes.${sceneKey}`,
          message: `La scène auteur « ${sceneKey} » est présente dans le catalogue mais absente du fichier.`,
        })
      }
    }
  }

  const viewGraph = normalizeSightyViewGraph<SceneKey, SlotName>(resources.file.views, resources.file.version)

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

    const actions = view.actions ?? {}
    for (const [eventName, action] of Object.entries(actions)) {
      const target = action.go
      if (target === undefined || !('path' in target)) continue
      if (findGraphViewByPath(viewGraph, target.path) === undefined) {
        diagnostics.push({
          code: 'AUTHOR_VIEW_ROUTE_UNKNOWN',
          path: `views.${entryPath}.actions.${eventName}.go.path`,
          message: `L'action « ${eventName} » de la vue « ${entryPath} » référence le chemin inconnu « ${target.path} ».`,
        })
      }
    }

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

  validateGraph(viewGraph, '')

  return diagnostics
}
