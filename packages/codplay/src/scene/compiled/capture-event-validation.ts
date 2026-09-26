import type { DiagnosticCollector } from '../../diagnostics'
import { isPlainRecord } from '../../shared'
import type { CanonicalSceneDoc } from '../types'

const captureEventVisibilities = new Set(['story', 'scene', 'public'])

/** Rejects legacy or malformed event scopes on authored capture declarations. */
export function validateAuthoredCaptureEvents(
  scene: CanonicalSceneDoc,
  diagnostics: DiagnosticCollector,
): void {
  for (const [storyId, story] of Object.entries(scene.stories)) {
    for (const perso of story.persos) {
      for (const [trigger, value] of Object.entries(perso.emit ?? {})) {
        if (trigger === 'observe') continue
        const rules = Array.isArray(value) ? value : [value]
        rules.forEach((rule, index) => {
          if (!isPlainRecord(rule) || !isPlainRecord(rule.capture)) return
          const rulePath = `emit.${trigger}${Array.isArray(value) ? `[${index}]` : ''}`
          validateCaptureEvent(rule.event, `${rulePath}.event`, scene.id, storyId, perso.id, diagnostics)
          if (rule.capture.endEmit !== undefined) {
            validateCaptureEvent(rule.capture.endEmit, `${rulePath}.capture.endEmit`, scene.id, storyId, perso.id, diagnostics)
          }
        })
      }
    }
  }
}

/** Checks one authored capture event against the named V2 event fields. */
function validateCaptureEvent(
  value: unknown,
  path: string,
  sceneId: string,
  storyId: string,
  persoId: string,
  diagnostics: DiagnosticCollector,
): void {
  const report = (code: string, message: string, suffix = ''): void => {
    diagnostics.error(code, message, {
      refs: { sceneId, storyId, persoId },
      context: { path: `${path}${suffix}` },
    }, `${sceneId}:${storyId}:${persoId}:${path}${suffix}:${code}`)
  }

  if (!isPlainRecord(value)) {
    report('AUTHOR_CAPTURE_EVENT_INVALID', 'Capture event must be a plain object.')
    return
  }
  if (Object.hasOwn(value, 'cascade')) {
    report('AUTHOR_CAPTURE_EVENT_SCOPE_LEGACY', 'Capture events use named visibility; cascade is not supported.', '.cascade')
  }
  if (value.visibility !== undefined && !captureEventVisibilities.has(String(value.visibility))) {
    report('AUTHOR_CAPTURE_EVENT_VISIBILITY_INVALID', 'Capture event visibility must be story, scene, or public.', '.visibility')
  }
}
