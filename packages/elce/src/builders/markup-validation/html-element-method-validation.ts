import type { SightySceneSourceValue } from '@codplay/sighty'
import type { SceneDoc } from 'codplay/scene/types'

type HtmlMethodScene = Readonly<Record<string, SightySceneSourceValue | undefined>>

/** Produces author warnings for unsupported or ambiguous HTML method lists before scene compilation. */
export function validateHtmlElementMethodActions(
  scenes: HtmlMethodScene,
): readonly string[] {
  const warnings: string[] = []
  for (const source of Object.values(scenes)) {
    if (source === undefined) continue
    const scene = resolveSceneDoc(source)
    for (const story of Object.values(scene.stories ?? {})) {
      for (const perso of story.persos ?? []) {
        for (const [actionName, action] of Object.entries(perso.actions ?? {})) {
          if (!isRecord(action) || !Object.prototype.hasOwnProperty.call(action, 'htmlElementMethod')) continue
          if (isSupportedHtmlElementMethod(action.htmlElementMethod)) continue
          warnings.push(
            `La méthode HTML de l’action « ${actionName} » du perso « ${perso.id} » `
            + `dans la scène « ${scene.id} » est ambiguë ou invalide ; elle sera ignorée.`,
          )
        }
      }
    }
  }
  return warnings
}

/** Resolves one direct or stylesheet-wrapped Sighty scene source. */
function resolveSceneDoc(source: SightySceneSourceValue): SceneDoc<string> {
  return isRecord(source) && 'sceneDoc' in source
    ? source.sceneDoc as SceneDoc<string>
    : source as SceneDoc<string>
}

/** Accepts only method lists implemented by the HTML materializer. */
function isSupportedHtmlElementMethod(value: unknown): boolean {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return false
  return (value.length === 1 && (value[0] === 'focus' || value[0] === 'blur'))
    || (value.length === 2 && value[0] === 'focus' && value[1] === 'preventscroll')
}

/** Narrows plain scene and action values while excluding arrays. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
