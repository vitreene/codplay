import type { CompiledScene, ListenRule } from '../builder/types'
import type { StrapCollection, StrapFn, TransformFn } from '../player/strap-types'

export type SceneExtraction = {
  /** CompiledScene sans aucune fonction JS — sérialisable en JSON pur. */
  serializable: CompiledScene
  /**
   * Fonctions extraites de la scène (transforms rewrappés en straps).
   * À merger avec les straps auteur dans DataScene.straps.
   */
  extractedStraps: StrapCollection
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_')
}

/**
 * Wrappe une TransformFn en StrapFn.
 * La transform reçoit l'événement déclencheur et retourne une liste d'événements.
 * Le strap wrapper retourne ces événements via StrapRuntimeOutput.
 */
function wrapTransform(fn: TransformFn): StrapFn {
  return ({ event }) => {
    const results = fn(event)
    return results.length > 0 ? { events: results } : undefined
  }
}

/**
 * Traite une liste de règles listen :
 * - extrait les fonctions transform vers le strapCollection
 * - les place en tête de rule.straps pour préserver l'ordre relatif transform → straps
 * - retourne la liste de règles sans fonctions (JSON-safe)
 */
function processListenRules(
  rules: ListenRule[],
  scope: string,
  extractedStraps: StrapCollection
): ListenRule[] {
  return rules.map((rule) => {
    const transforms = (rule.transform ?? []) as TransformFn[]
    if (transforms.length === 0) {
      const { transform, ...rest } = rule
      void transform
      return rest
    }

    const extractedNames: string[] = []
    const sanitizedOn = sanitize(rule.on)

    for (let index = 0; index < transforms.length; index++) {
      const fn = transforms[index]
      if (typeof fn !== 'function') continue
      const strapName = `__transform__${scope}__${sanitizedOn}__${index}`
      extractedStraps[strapName] = wrapTransform(fn)
      extractedNames.push(strapName)
    }

    return {
      on: rule.on,
      emit: rule.emit,
      // transforms extraits placés en tête — exécutés avant les straps auteur
      straps: [...extractedNames, ...(rule.straps ?? [])],
    }
  })
}

/**
 * Extrait toutes les fonctions JS d'une CompiledScene vers un StrapCollection.
 *
 * Traite :
 * - scene.listen[].transform  → straps nommés `__transform__scene__<on>__<i>`
 * - story.listen[].transform  → straps nommés `__transform__<storyId>__<on>__<i>`
 *
 * La scene résultante est JSON-safe.
 * Les fonctions extraites sont à merger avec les straps auteur dans DataScene.straps.
 *
 * @example
 * const { serializable, extractedStraps } = extractSceneFunctions(compiledScene)
 * writeFileSync('scene.json', JSON.stringify(serializable, null, 2))
 * export const straps = { ...myStraps, ...extractedStraps }
 */
export function extractSceneFunctions(compiled: CompiledScene): SceneExtraction {
  const extractedStraps: StrapCollection = {}

  const processedSceneListen = processListenRules(
    compiled.scene.listen ?? [],
    'scene',
    extractedStraps
  )

  const processedStories = Object.fromEntries(
    Object.entries(compiled.scene.stories ?? {}).map(([storyId, story]) => [
      storyId,
      {
        ...story,
        listen: processListenRules(story.listen ?? [], storyId, extractedStraps),
      },
    ])
  )

  const serializable: CompiledScene = {
    ...compiled,
    scene: {
      ...compiled.scene,
      listen: processedSceneListen,
      stories: processedStories,
    },
  }

  return { serializable, extractedStraps }
}
