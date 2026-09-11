import type { CompiledScene } from '../compiled'
import type { SceneDoc } from '../types'

/** One declared slot host discovered in an authoring scene. */
export type SlotManifestEntry = Readonly<{
  slot: string
  storyId: string
  persoId: string
  sourcePath: string
}>

/** Restricts manifest discovery to one story when a scene has several scopes. */
export type SlotManifestOptions = Readonly<{
  storyId?: string
}>

/** Scope and source path used to enrich one slot lookup diagnostic. */
export type SlotManifestResolveOptions = Readonly<{
  sceneId?: string
  storyId?: string
  referencePath?: string
}>

/** Structured authoring diagnostic returned when one slot reference cannot resolve. */
export type SlotManifestDiagnostic = Readonly<{
  code: 'AUTHOR_SLOT_NAME_UNKNOWN' | 'AUTHOR_SLOT_NAME_AMBIGUOUS'
  message: string
  slot: string
  sceneId?: string
  storyId?: string
  referencePath?: string
  available: readonly string[]
  candidates: readonly SlotManifestEntry[]
}>

/** Result of resolving one explicit slot name against a discovered manifest. */
export type SlotManifestResolution =
  | Readonly<{ ok: true; entry: SlotManifestEntry }>
  | Readonly<{ ok: false; diagnostic: SlotManifestDiagnostic }>

/** Authoring input accepted by the slot discovery helper. */
export type SlotManifestScene = SceneDoc<string> | CompiledScene

/** Lists the explicit root names of every slot perso without starting a player. */
export function slotManifest(
  scene: SlotManifestScene,
  options: SlotManifestOptions = {},
): readonly SlotManifestEntry[] {
  const stories: Readonly<Record<string, SlotManifestStory>> = isCompiledScene(scene)
    ? scene.scene.stories
    : scene.stories
  const entries: SlotManifestEntry[] = []

  for (const [storyKey, story] of Object.entries(stories)) {
    const storyId = story.id
    if (options.storyId !== undefined && options.storyId !== storyKey && options.storyId !== storyId) continue
    story.persos.forEach((perso, index) => {
      if (perso.type !== 'slot') return
      entries.push({
        slot: perso.name ?? '',
        storyId,
        persoId: perso.id,
        sourcePath: `stories.${storyKey}.persos[${index}].name`,
      })
    })
  }

  return entries
}

/** Resolves one exact slot name and returns an actionable authoring diagnostic on failure. */
export function resolveSlotManifestEntry(
  manifest: readonly SlotManifestEntry[],
  slot: string,
  options: SlotManifestResolveOptions = {},
): SlotManifestResolution {
  const scoped = options.storyId === undefined
    ? manifest
    : manifest.filter((entry) => entry.storyId === options.storyId)
  const candidates = scoped.filter((entry) => entry.slot === slot)
  if (candidates.length === 1) return { ok: true, entry: candidates[0] as SlotManifestEntry }

  const available = [...new Set(scoped.map((entry) => entry.slot).filter((name) => name.length > 0))]
    .sort((left, right) => left.localeCompare(right))
  const sceneLabel = options.sceneId === undefined ? 'the requested scene' : `scene "${options.sceneId}"`
  const storyLabel = options.storyId === undefined ? sceneLabel : `${sceneLabel}, story "${options.storyId}"`
  if (candidates.length === 0) {
    return {
      ok: false,
      diagnostic: {
        code: 'AUTHOR_SLOT_NAME_UNKNOWN',
        message: `Slot "${slot}" was not found in ${storyLabel}. Available slots: ${formatNames(available)}.`,
        slot,
        ...(options.sceneId === undefined ? {} : { sceneId: options.sceneId }),
        ...(options.storyId === undefined ? {} : { storyId: options.storyId }),
        ...(options.referencePath === undefined ? {} : { referencePath: options.referencePath }),
        available,
        candidates,
      },
    }
  }

  return {
    ok: false,
    diagnostic: {
      code: 'AUTHOR_SLOT_NAME_AMBIGUOUS',
      message: `Slot "${slot}" is declared more than once in ${storyLabel}: ${candidates.map((entry) => entry.sourcePath).join(', ')}.`,
      slot,
      ...(options.sceneId === undefined ? {} : { sceneId: options.sceneId }),
      ...(options.storyId === undefined ? {} : { storyId: options.storyId }),
      ...(options.referencePath === undefined ? {} : { referencePath: options.referencePath }),
      available,
      candidates,
    },
  }
}

/** Distinguishes the compiled envelope from an authoring SceneDoc. */
function isCompiledScene(scene: SlotManifestScene): scene is CompiledScene {
  return 'scene' in scene && typeof scene.scene === 'object' && scene.scene !== null
}

/** Formats names consistently in author-facing diagnostics. */
function formatNames(names: readonly string[]): string {
  return names.length === 0 ? '(none)' : names.map((name) => `"${name}"`).join(', ')
}

/** Common story shape needed by manifest discovery on author and compiled data. */
type SlotManifestStory = Readonly<{
  id: string
  persos: readonly Readonly<{ id: string; name?: string; type: string }>[]
}>
