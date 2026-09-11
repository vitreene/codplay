import type { DiagnosticCollector } from '../../diagnostics'
import type { CompiledScene, CompiledStory } from './types'

/** Validates the internal relationships of one structurally valid CompiledScene. */
export function validateCompiledSceneSemantics(
  scene: CompiledScene,
  diagnostics: DiagnosticCollector,
): void {
  validateSceneIdentity(scene, diagnostics)
  validateStoryIsolation(scene, diagnostics)

  const persoIds = new Set<string>()
  const componentTypes = new Set<string>()
  for (const [storyKey, story] of Object.entries(scene.scene.stories)) {
    validateStory(scene, storyKey, story, persoIds, componentTypes, diagnostics)
  }

  validateRootNodeIds(scene, persoIds, diagnostics)
  validateActionTargetIndex(scene, diagnostics)
  validateRequirements(scene, componentTypes, diagnostics)
  validateResources(scene, diagnostics)
}

/** Validates scene-level isolation declarations and the compiled wake index. */
function validateStoryIsolation(scene: CompiledScene, diagnostics: DiagnosticCollector): void {
  for (const rule of scene.scene.listen) {
    if (rule.active !== undefined) {
      diagnostics.error(
        'COMPILED_SCENE_LISTEN_ACTIVE_INVALID',
        'Scene-level listen rules cannot declare story isolation with active.',
        { context: { sceneId: scene.scene.id, eventName: rule.on } },
      )
    }
  }

  const expected: Record<string, Record<string, number>> = {}
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    const storyIndex: Record<string, number> = {}
    for (const [ruleIndex, rule] of story.listen.entries()) {
      if (rule.active !== true) continue
      if (storyIndex[rule.on] !== undefined) {
        diagnostics.error(
          'COMPILED_STORY_ACTIVATION_DUPLICATE',
          `Story activation is declared more than once for the event: ${rule.on}.`,
          { context: { sceneId: scene.scene.id, storyId, eventName: rule.on } },
        )
        continue
      }
      storyIndex[rule.on] = ruleIndex
    }
    expected[storyId] = storyIndex
  }

  if (Object.values(expected).some((storyIndex) => Object.keys(storyIndex).length > 0)
    && scene.storyActivationIndex === undefined) {
    diagnostics.error(
      'COMPILED_STORY_ACTIVATION_INDEX_MISSING',
      'CompiledScene storyActivationIndex is required when a story declares active: true.',
      { context: { sceneId: scene.scene.id } },
    )
    return
  }
  if (scene.storyActivationIndex === undefined) return

  const actualStoryIds = new Set(Object.keys(scene.storyActivationIndex))
  const expectedStoryIds = new Set(Object.keys(expected))
  if (!sameSet(actualStoryIds, expectedStoryIds)) {
    diagnostics.error(
      'COMPILED_STORY_ACTIVATION_INDEX_INCONSISTENT',
      'CompiledScene storyActivationIndex must contain exactly the compiled story ids.',
      { context: { sceneId: scene.scene.id } },
    )
    return
  }
  for (const storyId of expectedStoryIds) {
    const actual = scene.storyActivationIndex[storyId]
    const expectedRules = expected[storyId] ?? {}
    if (actual === undefined || !sameRecord(actual, expectedRules)) {
      diagnostics.error(
        'COMPILED_STORY_ACTIVATION_INDEX_INCONSISTENT',
        `CompiledScene storyActivationIndex does not match story.listen for: ${storyId}.`,
        { context: { sceneId: scene.scene.id, storyId } },
      )
    }
  }
}

/** Validates the identity fields that are meaningful beyond their primitive types. */
function validateSceneIdentity(scene: CompiledScene, diagnostics: DiagnosticCollector): void {
  if (scene.scene.id.trim().length === 0) {
    diagnostics.error('COMPILED_SCENE_ID_INVALID', 'CompiledScene scene.id must not be empty.')
  }

  if (Number.isNaN(Date.parse(scene.createdAt))) {
    diagnostics.error('COMPILED_SCENE_CREATED_AT_INVALID', 'CompiledScene createdAt must be a valid date string.')
  }
}

/** Validates that the compiled action-target index exactly reflects compiled actions. */
function validateActionTargetIndex(scene: CompiledScene, diagnostics: DiagnosticCollector): void {
  const index = scene.actionTargetIndex
  if (index === undefined) {
    diagnostics.error(
      'COMPILED_ACTION_TARGET_INDEX_MISSING',
      'CompiledScene actionTargetIndex is required.',
      { context: { sceneId: scene.scene.id } },
    )
    return
  }

  const expected: Record<string, string[]> = {}
  for (const story of Object.values(scene.scene.stories)) {
    for (const perso of story.persos) {
      for (const actionName of Object.keys(perso.actions)) {
        const targets = expected[actionName] ?? (expected[actionName] = [])
        targets.push(`${story.id}\u0000${perso.id}`)
      }
    }
  }

  const actualNames = Object.keys(index)
  if (!sameSet(new Set(actualNames), new Set(Object.keys(expected)))) {
    diagnostics.error(
      'COMPILED_ACTION_TARGET_INDEX_INCONSISTENT',
      'CompiledScene actionTargetIndex must contain exactly the action names declared by compiled persos.',
      { context: { sceneId: scene.scene.id } },
    )
    return
  }

  for (const [actionName, targets] of Object.entries(index)) {
    const actual = new Set<string>()
    for (const target of targets) {
      const story = scene.scene.stories[target.storyId]
      const perso = story?.persos.find((candidate) => candidate.id === target.persoId)
      if (story === undefined || perso === undefined || !(actionName in perso.actions)) {
        diagnostics.error(
          'COMPILED_ACTION_TARGET_INDEX_INVALID',
          `CompiledScene actionTargetIndex references a target without the action: ${actionName}.`,
          { context: { sceneId: scene.scene.id, actionName, storyId: target.storyId, persoId: target.persoId } },
        )
        continue
      }
      actual.add(`${target.storyId}\u0000${target.persoId}`)
    }

    if (!sameSet(actual, new Set(expected[actionName]))) {
      diagnostics.error(
        'COMPILED_ACTION_TARGET_INDEX_INCONSISTENT',
        `CompiledScene actionTargetIndex targets do not match the compiled action: ${actionName}.`,
        { context: { sceneId: scene.scene.id, actionName } },
      )
    }
  }
}

/** Validates one story key, its perso identities, and its canonical self-action. */
function validateStory(
  scene: CompiledScene,
  storyKey: string,
  story: CompiledStory,
  persoIds: Set<string>,
  componentTypes: Set<string>,
  diagnostics: DiagnosticCollector,
): void {
  if (storyKey.trim().length === 0 || story.id.trim().length === 0 || story.id !== storyKey) {
    diagnostics.error(
      'COMPILED_STORY_ID_INVALID',
      `CompiledScene story id must match its non-empty map key: ${storyKey}.`,
      { context: { sceneId: scene.scene.id, storyId: story.id, storyKey } },
    )
  }

  if (story.trackId !== undefined && story.trackId.trim().length === 0) {
    diagnostics.error(
      'COMPILED_STORY_TRACK_ID_INVALID',
      `CompiledScene story trackId must not be empty: ${story.id}.`,
      { context: { sceneId: scene.scene.id, storyId: story.id } },
    )
  }

  const slotNames = new Map<string, string>()
  for (const perso of story.persos) {
    if (perso.id.trim().length === 0) {
      diagnostics.error(
        'COMPILED_PERSO_ID_INVALID',
        'CompiledScene perso.id must not be empty.',
        { context: { sceneId: scene.scene.id, storyId: story.id } },
      )
    }
    if (persoIds.has(perso.id)) {
      diagnostics.error(
        'COMPILED_PERSO_ID_DUPLICATE',
        `CompiledScene perso.id is not unique in the scene: ${perso.id}.`,
        { context: { sceneId: scene.scene.id, storyId: story.id, persoId: perso.id } },
      )
    }
    persoIds.add(perso.id)

    if (perso.type.trim().length === 0) {
      diagnostics.error(
        'COMPILED_PERSO_TYPE_INVALID',
        `CompiledScene perso.type must not be empty: ${perso.id}.`,
        { context: { sceneId: scene.scene.id, storyId: story.id, persoId: perso.id } },
      )
    }
    componentTypes.add(perso.type)

    if (perso.type === 'slot') {
      if (perso.name === undefined || perso.name.trim().length === 0) {
        diagnostics.error(
          'COMPILED_SLOT_NAME_INVALID',
          `CompiledScene slot perso must declare a non-empty root name: ${perso.id}.`,
          { context: { sceneId: scene.scene.id, storyId: story.id, persoId: perso.id } },
        )
      } else {
        const previousPersoId = slotNames.get(perso.name)
        if (previousPersoId !== undefined) {
          diagnostics.error(
            'COMPILED_SLOT_NAME_DUPLICATE',
            `CompiledScene slot name is duplicated in story ${story.id}: ${perso.name}.`,
            { context: { sceneId: scene.scene.id, storyId: story.id, persoId: perso.id, previousPersoId } },
          )
        } else {
          slotNames.set(perso.name, perso.id)
        }
      }
    }

    if (!(perso.id in perso.actions) || perso.actions[perso.id] !== null) {
      diagnostics.error(
        'COMPILED_PERSO_SELF_ACTION_INVALID',
        `CompiledScene perso.actions[${perso.id}] must be the canonical null self-action.`,
        { context: { sceneId: scene.scene.id, storyId: story.id, persoId: perso.id } },
      )
    }
  }
}

/** Validates that every compiled root candidate identifies one compiled perso once. */
function validateRootNodeIds(
  scene: CompiledScene,
  persoIds: ReadonlySet<string>,
  diagnostics: DiagnosticCollector,
): void {
  const seen = new Set<string>()
  for (const id of scene.rootNodeIds) {
    if (id.trim().length === 0) {
      diagnostics.error('COMPILED_ROOT_ID_INVALID', 'CompiledScene rootNodeIds cannot contain an empty id.')
    }
    if (seen.has(id)) {
      diagnostics.error('COMPILED_ROOT_ID_DUPLICATE', `CompiledScene rootNodeIds contains a duplicate id: ${id}.`)
    }
    if (!persoIds.has(id)) {
      diagnostics.error('COMPILED_ROOT_ID_UNKNOWN', `CompiledScene rootNodeIds references an unknown perso: ${id}.`)
    }
    seen.add(id)
  }
}

/** Validates requirement uniqueness and the requirements derived from scene data. */
function validateRequirements(
  scene: CompiledScene,
  componentTypes: ReadonlySet<string>,
  diagnostics: DiagnosticCollector,
): void {
  validateUniqueNames(scene.requirements.components, 'components', scene, diagnostics)
  validateUniqueNames(scene.requirements.services, 'services', scene, diagnostics)
  validateUniqueNames(scene.requirements.modules, 'modules', scene, diagnostics)
  validateUniqueNames(scene.requirements.resources, 'resources', scene, diagnostics)

  const requiredComponents = new Set(scene.requirements.components)
  if (!sameSet(requiredComponents, componentTypes)) {
    diagnostics.error(
      'COMPILED_REQUIREMENTS_COMPONENTS_INCONSISTENT',
      'CompiledScene requirements.components must match the component types used by its persos.',
      { context: { sceneId: scene.scene.id } },
    )
  }
}

/** Validates one capability list without imposing a global ordering policy. */
function validateUniqueNames(
  values: readonly string[],
  kind: string,
  scene: CompiledScene,
  diagnostics: DiagnosticCollector,
): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (value.trim().length === 0) {
      diagnostics.error(
        'COMPILED_REQUIREMENT_NAME_INVALID',
        `CompiledScene requirements.${kind} cannot contain an empty name.`,
        { context: { sceneId: scene.scene.id, kind } },
      )
    }
    if (seen.has(value)) {
      diagnostics.error(
        'COMPILED_REQUIREMENT_DUPLICATE',
        `CompiledScene requirements.${kind} contains a duplicate name: ${value}.`,
        { context: { sceneId: scene.scene.id, kind, value } },
      )
    }
    seen.add(value)
  }
}

/** Validates resource uniqueness and the derived resource requirements. */
function validateResources(scene: CompiledScene, diagnostics: DiagnosticCollector): void {
  const resourceUrls = new Set<string>()
  for (const resource of scene.resources.entries) {
    if (resource.url.trim().length === 0 || resource.type.trim().length === 0) {
      diagnostics.error(
        'COMPILED_RESOURCE_INVALID',
        'CompiledScene resources must have non-empty url and type fields.',
        { context: { sceneId: scene.scene.id, url: resource.url } },
      )
    }
    if (resourceUrls.has(resource.url)) {
      diagnostics.error(
        'COMPILED_RESOURCE_DUPLICATE',
        `CompiledScene resources contains a duplicate url: ${resource.url}.`,
        { context: { sceneId: scene.scene.id, url: resource.url } },
      )
    }
    resourceUrls.add(resource.url)
  }

  if (!sameSet(resourceUrls, new Set(scene.requirements.resources))) {
    diagnostics.error(
      'COMPILED_REQUIREMENTS_RESOURCES_INCONSISTENT',
      'CompiledScene requirements.resources must match resources.entries.',
      { context: { sceneId: scene.scene.id } },
    )
  }
}

/** Compares two finite name sets without imposing an order on either source. */
function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

/** Compares two string-to-number index records without imposing key order. */
function sameRecord(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => left[key] === right[key])
}
