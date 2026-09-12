import type {
  SightyAuthoringDiagnostic,
  SightyScenarioResources,
} from './types'

/** Validates authored scene resources and view references without executing them. */
export function validateAuthoringResources<
  SceneKey extends string = string,
  SlotName extends string = string,
>(resources: SightyScenarioResources<SceneKey, SlotName>): readonly SightyAuthoringDiagnostic[] {
  const diagnostics: SightyAuthoringDiagnostic[] = []
  const declaredSceneKeys = new Set(Object.keys(resources.file.resources.scenes))

  /** Checks whether a scene is declared and available in the authoring catalog. */
  const hasAvailableScene = (sceneKey: string): boolean =>
    declaredSceneKeys.has(sceneKey) && resources.scenes[sceneKey as SceneKey] !== undefined

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

  resources.file.views.forEach((view, viewIndex) => {
    const rootScene = view.view.scene
    if (!hasAvailableScene(rootScene)) {
      diagnostics.push({
        code: 'AUTHOR_VIEW_SCENE_UNKNOWN',
        path: `views[${viewIndex}].view.scene`,
        message: `La vue ${viewIndex} référence la scène inconnue « ${rootScene} ».`,
      })
    }

    for (const slotName of Object.keys(view.view.slots) as SlotName[]) {
      const placements = view.view.slots[slotName]
      placements.forEach((placement, placementIndex) => {
        const childScene = placement.view.scene
        if (!hasAvailableScene(childScene)) {
          diagnostics.push({
            code: 'AUTHOR_VIEW_CHILD_SCENE_UNKNOWN',
            path: `views[${viewIndex}].view.slots.${slotName}[${placementIndex}].view.scene`,
            message: `Le slot « ${slotName} » référence la scène inconnue « ${childScene} ».`,
          })
        }
      })
    }
  })

  return diagnostics
}
