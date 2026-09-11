import { AutoCapsule, CAPSULE_TYPE, type AutoCapsuleResult } from '@codplay/capsule-automation'

/** Resolves the scene-root fill artifact shared by the layout and its child scenes. */
function createSceneRootCapsule(): AutoCapsuleResult {
  const capsule = new AutoCapsule({
    capsule: {
      id: 'sighty-demo-scene-root',
      type: CAPSULE_TYPE.card,
      grid: { rows: 1, cols: 1 },
      sceneRoot: true,
    },
    children: [],
  }, { autoResolveOnWrite: false })
  return capsule.resolve()
}

/** Authoring artifact used to fill the real host of every Sighty scene root. */
export const SIGHTY_SCENE_ROOT_CAPSULE = createSceneRootCapsule()

/**
 * Returns the fixed scene-root class from a resolved capsule artifact.
 *
 * The layout owns its internal grid, so the generated one-cell grid class is
 * intentionally not projected onto the authored scene roots.
 */
function resolveSceneRootClassName(result: AutoCapsuleResult): string {
  const className = result.capsule.classTokens.find((token) => token === 'ac-scene-root')
  if (className === undefined) throw new Error('capsule-automation did not emit its scene-root class.')
  return className
}

/** Returns only the scene-root CSS rule from the resolved capsule artifact. */
function resolveSceneRootStyleSheet(result: AutoCapsuleResult): string {
  const styleRule = result.capsule.cssRules.find((rule) => rule.startsWith('.ac-scene-root{'))
  if (styleRule === undefined) throw new Error('capsule-automation did not emit its scene-root CSS rule.')
  return styleRule
}

/** Final class projection emitted by capsule-automation for the scene-root fill. */
export const SIGHTY_SCENE_ROOT_CLASS_NAME = resolveSceneRootClassName(SIGHTY_SCENE_ROOT_CAPSULE)

/** CSS projection emitted by capsule-automation for the scene-root fill concern. */
export const SIGHTY_SCENE_ROOT_STYLE_SHEET = resolveSceneRootStyleSheet(SIGHTY_SCENE_ROOT_CAPSULE)
