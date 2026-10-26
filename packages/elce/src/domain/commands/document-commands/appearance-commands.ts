import type { AppearanceSettings } from '../../../config/appearance/appearance-types'
import { ElceDocument } from '../../../domain/document/document-model'
import type { AppearanceProperty, AppearanceTarget } from '../document-command-types'
import { fail, findBdc } from './command-helpers'
import { resolveAppearance } from '../../appearance/appearance-resolver'

/** Sets one local appearance value without replacing other explicit settings. */
export function setAppearanceProperty(
  document: ElceDocument,
  target: AppearanceTarget,
  property: AppearanceProperty,
  value: NonNullable<AppearanceSettings[AppearanceProperty]>,
): ElceDocument {
  const current = appearanceForTarget(document, target)
  return replaceAppearanceForTarget(document, target, { ...current, [property]: value })
}

/** Sets a surface color and restores the Normal density when leaving Transparent. */
export function setAppearanceBackground(
  document: ElceDocument,
  target: AppearanceTarget,
  background: NonNullable<AppearanceSettings['background']>,
): ElceDocument {
  const current = appearanceForTarget(document, target)
  const density = resolveAppearance(document, target).density.value
  return replaceAppearanceForTarget(document, target, {
    ...current,
    background,
    ...(density === 'none' ? { density: 'normal' } : {}),
  })
}

/** Replaces title and body font choices as one undoable author action. */
export function setAppearanceTypography(
  document: ElceDocument,
  target: AppearanceTarget,
  headingFontId: string,
  bodyFontId: string,
): ElceDocument {
  const current = appearanceForTarget(document, target)
  return replaceAppearanceForTarget(document, target, { ...current, headingFontId, bodyFontId })
}

/** Removes only the named local appearance value so the next context applies. */
export function resetAppearanceProperty(
  document: ElceDocument,
  target: AppearanceTarget,
  property: AppearanceProperty,
): ElceDocument {
  const current = appearanceForTarget(document, target)
  if (current === undefined || !(property in current)) return document

  const updated = { ...current } as Record<string, unknown>
  delete updated[property]
  return replaceAppearanceForTarget(
    document,
    target,
    Object.keys(updated).length === 0 ? undefined : updated as AppearanceSettings,
  )
}

/** Reads one target's sparse local appearance settings. */
function appearanceForTarget(document: ElceDocument, target: AppearanceTarget): AppearanceSettings | undefined {
  switch (target.kind) {
    case 'document':
      return document.data.appearance
    case 'page': {
      const page = document.pages.find((candidate) => candidate.id === target.pageId)
      if (page === undefined) fail(`Page inconnue pour le style : ${target.pageId}`)
      return page.appearance
    }
    case 'bdc':
      return findBdc(document, target.bdcId).appearance
  }
}

/** Replaces one target's sparse settings while preserving all unrelated document data. */
function replaceAppearanceForTarget(
  document: ElceDocument,
  target: AppearanceTarget,
  appearance: AppearanceSettings | undefined,
): ElceDocument {
  switch (target.kind) {
    case 'document':
      return new ElceDocument(withAppearance(document.data, appearance))
    case 'page':
      if (!document.pages.some((page) => page.id === target.pageId)) {
        fail(`Page inconnue pour le style : ${target.pageId}`)
      }
      return new ElceDocument({
        ...document.data,
        pages: document.pages.map((page) => page.id === target.pageId ? withAppearance(page, appearance) : page),
      })
    case 'bdc':
      findBdc(document, target.bdcId)
      return new ElceDocument({
        ...document.data,
        bdcs: document.bdcs.map((bdc) => bdc.id === target.bdcId ? withAppearance(bdc, appearance) : bdc),
      })
  }
}

/** Adds or omits the optional settings field without emitting an undefined value. */
function withAppearance<T extends Readonly<{ appearance?: AppearanceSettings }>>(
  entity: T,
  appearance: AppearanceSettings | undefined,
): T {
  const { appearance: _previous, ...rest } = entity
  return appearance === undefined ? rest as T : { ...rest, appearance } as T
}
