import type { DecorPatch } from '../../../decor-editor/types'
import { createId } from '../../commands/ids'
import type { Content, Decor, EditorScene, OffsetData } from '../../commands/types'
import type { Command } from '../../controller/types'
import { mergePatch } from '../../../decor-editor/merge'
import { hasExplicitPlacementGeometry, missingZoneFillStyle } from '../../commands/offset-placement'
import type { Target } from './decor-target'

/** Document commands that write one Decor edit; the copy-on-write rule belongs to `setItemDecor`. */

/** Écarts routés vers `setDecor` (`style`/`classes`/`offset`/`custom`/`zoneId`) — présents seulement si modifiés. */
export function patchToDecorArgs(patch: DecorPatch): Partial<Omit<Decor, 'id'>> | null {
  const args: Partial<Omit<Decor, 'id'>> = {}
  let touched = false
  if (patch.style !== undefined) { args.style = patch.style; touched = true }
  if (patch.classes !== undefined) { args.classes = patch.classes as unknown as Decor['classes']; touched = true }
  if (patch.offset !== undefined) { args.offset = patch.offset as unknown as OffsetData; touched = true }
  if (patch.custom !== undefined) { args.custom = patch.custom; touched = true }
  if (patch.path !== undefined) { args.path = patch.path; touched = true }
  if (patch.zoneId !== undefined) { args.zoneId = patch.zoneId; touched = true }
  const knownProperties = new Set(['style', 'classes', 'offset', 'custom', 'path', 'orientToPath', 'zoneId'])
  const argsRecord = args as Record<string, unknown>
  for (const [property, value] of Object.entries(patch)) {
    if (knownProperties.has(property)) continue
    argsRecord[property] = value
    touched = true
  }
  return touched ? args : null
}

/** Écart routé vers `assignContent` (`text`/`textAutoSize`) — fusionné sur le `Content` existant, jamais un remplacement partiel (`assignContent` remplace tout l'objet) ni une clé absente écrite à `undefined` (la persistance JSON la refuse). */
export function patchToContentArgs(patch: DecorPatch, existing: Content | undefined, itemType: Target['itemType']): Omit<Content, 'id'> | null {
  if (patch.text === undefined && patch.textAutoSize === undefined) return null
  const { id, ...existingFields } = existing ?? {}
  return {
    ...existingFields,
    type: itemType === 'capsule' ? 'text' : itemType,
    ...(patch.text === undefined ? {} : { text: patch.text }),
    ...(patch.textAutoSize === undefined ? {} : { textAutoSize: patch.textAutoSize }),
  }
}

/**
 * Commandes d'écriture pour `patch` sur `target` — le copy-on-write appartient à `setItemDecor`. Commun à
 * `onDecorChange` (édition continue via dedit — palette, CSS libre, presets) et au commit d'une
 * `DecorLiveSession` (fin de geste CS-family — `specs/decor-style-interpolation-spec.md` — fin de geste) : un seul endroit qui sait construire ces commandes, plus deux copies qui auraient pu diverger.
 */
export function buildDecorCommands(scene: EditorScene, target: Target, patch: DecorPatch): Command[] {
  const commands: Command[] = []
  // `setItemDecor` owns the copy-on-write rule: the edit never reaches another reference.
  const decorArgs = patchToDecorArgs(patch)
  if (decorArgs) {
    commands.push({ name: 'setItemDecor', args: {
      itemId: target.itemId, keyframeId: target.keyframeId, patch: decorArgs, forkDecorId: createId('decor'),
    } })
  }

  const existingContent = target.contentId ? scene.contents[target.contentId] : undefined
  const contentArgs = patchToContentArgs(patch, existingContent, target.itemType)
  if (contentArgs) commands.push({ name: 'assignContent', args: { itemId: target.itemId, content: contentArgs } })

  return commands
}

/** Adds missing zone-fill CSS to the same Decor patch that owns the placement change. */
export function materializeZoneFillStyle(base: DecorPatch, patch: DecorPatch): DecorPatch {
  const effective = mergePatch(base, patch)
  if (effective.zoneId == null || hasExplicitPlacementGeometry(effective.offset)) return patch
  const additions = missingZoneFillStyle(effective.style, effective.custom)
  return Object.keys(additions).length === 0 ? patch : mergePatch(patch, { style: additions })
}
