import type { DiagnosticCollector } from '../../diagnostics'
import { isPlainRecord } from '../../shared'
import type { CanonicalSceneDoc } from '../types'

const allowedZoneKeys = new Set(['rootMargin', 'scrollMargin', 'threshold', 'trackVisibility'])
const allowedEventKeys = new Set(['name', 'data', 'visibility', 'mode', 'once'])
const allowedObservationKeys = new Set(['root', 'liveAction', 'zone', 'enter', 'leave'])

/** Validates authored scroll observation and capture declarations before extraction. */
export function validateAuthoredScrollDeclarations(
  scene: CanonicalSceneDoc,
  diagnostics: DiagnosticCollector,
): void {
  for (const [storyId, story] of Object.entries(scene.stories)) {
    const scrollContainerIds = new Set(story.persos
      .filter((perso) => perso.type === 'scroll-container')
      .map((perso) => perso.id))
    for (const perso of story.persos) {
      for (const [trigger, value] of Object.entries(perso.emit ?? {})) {
        if (trigger === 'observe') {
          validateObservationDeclaration(value, {
            sceneId: scene.id,
            storyId,
            persoId: perso.id,
            persoActions: perso.actions,
            path: 'emit.observe',
            scrollContainerIds,
          }, diagnostics)
          continue
        }
        for (const [ruleIndex, rule] of normalizeRules(value).entries()) {
          if (!isPlainRecord(rule)) continue
          if (Object.keys(rule).some((key) => ['root', 'zone', 'enter', 'leave'].includes(key))) {
            diagnostics.error(
              'AUTHOR_SCROLL_OBSERVATION_INVALID',
              'A scroll observation must be declared directly at emit.observe.',
              {
                refs: { sceneId: scene.id, storyId, persoId: perso.id },
                context: { path: `emit.${trigger}${Array.isArray(value) ? `[${ruleIndex}]` : ''}` },
              },
            )
          }
          if (perso.type === 'scroll-container'
            && trigger === 'scroll'
            && rule.capture !== undefined
            && isPlainRecord(rule.capture)
            && rule.capture.trackCommand === undefined) {
            diagnostics.warning(
              'AUTHOR_SCROLL_CAPTURE_TRACK_COMMAND_MISSING',
              'Scroll capture has no trackCommand; it will record no live progress action.',
              {
                refs: { sceneId: scene.id, storyId, persoId: perso.id },
                context: { path: `emit.scroll${Array.isArray(value) ? `[${ruleIndex}]` : ''}.capture.trackCommand` },
              },
            )
          }
        }
      }
    }
  }
}

/** Checks the exclusive observation rule shape and its native options. */
function validateObservationDeclaration(
  declaration: unknown,
  context: Readonly<{
    sceneId: string
    storyId: string
    persoId: string
    persoActions: Readonly<Record<string, unknown>>
    path: string
    scrollContainerIds: ReadonlySet<string>
  }>,
  diagnostics: DiagnosticCollector,
): void {
  const refs = { sceneId: context.sceneId, storyId: context.storyId, persoId: context.persoId }
  const report = (code: string, message: string, suffix = ''): void => {
    diagnostics.error(code, message, {
      refs,
      context: { path: `${context.path}${suffix}` },
    })
  }

  if (!isPlainRecord(declaration)) {
    report('AUTHOR_SCROLL_OBSERVATION_INVALID', 'emit.observe must be one plain object.')
    return
  }
  for (const key of Object.keys(declaration)) {
    if (!allowedObservationKeys.has(key)) {
      report('AUTHOR_SCROLL_OBSERVATION_OPTION_INVALID', `emit.observe.${key} is not supported.`, `.${key}`)
    }
  }

  if (declaration.root !== undefined) {
    if (typeof declaration.root !== 'string' || declaration.root.trim().length === 0) {
      report('AUTHOR_SCROLL_OBSERVATION_ROOT_INVALID', 'emit.observe.root must be a non-empty scroll-container persona id.', '.root')
    } else if (!context.scrollContainerIds.has(declaration.root)) {
      report('AUTHOR_SCROLL_OBSERVATION_ROOT_INVALID', 'emit.observe.root must identify a scroll-container in the same story.', '.root')
    }
  } else if (context.scrollContainerIds.size === 0) {
    report('AUTHOR_SCROLL_OBSERVATION_SCOPE_INVALID', 'emit.observe requires a scroll-container in the same story.', '')
  }

  if (declaration.liveAction !== undefined) {
    const action = typeof declaration.liveAction === 'string'
      ? context.persoActions[declaration.liveAction]
      : undefined
    if (typeof declaration.liveAction !== 'string'
      || declaration.liveAction.trim().length === 0
      || !isAuthorLiveTweenAction(action)) {
      report(
        'AUTHOR_SCROLL_OBSERVATION_ACTION_INVALID',
        'emit.observe.liveAction must name a TweenAction with a function declared in actions on the observed perso.',
        '.liveAction',
      )
    }
  }

  if (declaration.zone !== undefined) {
    if (!isPlainRecord(declaration.zone)) {
      report('AUTHOR_SCROLL_OBSERVATION_ZONE_INVALID', 'emit.observe.zone must be a plain object.', '.zone')
    } else {
      for (const key of Object.keys(declaration.zone)) {
        if (!allowedZoneKeys.has(key)) {
          report('AUTHOR_SCROLL_OBSERVATION_ZONE_OPTION_INVALID', `emit.observe.zone.${key} is not supported.`, `.zone.${key}`)
        }
      }
      validateMargin(declaration.zone.rootMargin, 'rootMargin', report)
      validateMargin(declaration.zone.scrollMargin, 'scrollMargin', report)
      const threshold = declaration.zone.threshold
      const thresholds = threshold === undefined
        ? []
        : Array.isArray(threshold)
          ? threshold
          : [threshold]
      if (threshold !== undefined && !thresholds.every((candidate) => (
        typeof candidate === 'number'
        && Number.isFinite(candidate)
        && candidate >= 0
        && candidate <= 1
      ))) {
        report(
          'AUTHOR_SCROLL_OBSERVATION_THRESHOLD_INVALID',
          'emit.observe.zone.threshold must be a number or an array of finite numbers from 0 to 1.',
          '.zone.threshold',
        )
      }
      if (declaration.zone.trackVisibility !== undefined && typeof declaration.zone.trackVisibility !== 'boolean') {
        report('AUTHOR_SCROLL_OBSERVATION_VISIBILITY_INVALID', 'emit.observe.zone.trackVisibility must be a boolean.', '.zone.trackVisibility')
      }
    }
  }

  validateEvents(declaration.enter, 'enter', report)
  validateEvents(declaration.leave, 'leave', report)
}

/** Checks the TweenAction fields needed to evaluate a ratio-driven live action. */
function isAuthorLiveTweenAction(value: unknown): boolean {
  return isPlainRecord(value)
    && typeof value.fn === 'function'
    && typeof value.duration === 'number'
    && Number.isFinite(value.duration)
    && value.duration > 0
}

/** Validates one optional native margin as one to four CSS pixel or percent lengths. */
function validateMargin(
  value: unknown,
  name: 'rootMargin' | 'scrollMargin',
  report: (code: string, message: string, suffix?: string) => void,
): void {
  if (value === undefined) return
  const tokens = typeof value === 'string' ? value.trim().split(/\s+/) : []
  const isValid = tokens.length >= 1
    && tokens.length <= 4
    && tokens.every((token) => /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:px|%)$/.test(token))
  if (!isValid) {
    report(
      'AUTHOR_SCROLL_OBSERVATION_MARGIN_INVALID',
      `emit.observe.zone.${name} must contain one to four pixel or percent lengths.`,
      `.zone.${name}`,
    )
  }
}

/** Validates ordered enter or leave outputs using the existing event shape. */
function validateEvents(
  value: unknown,
  field: 'enter' | 'leave',
  report: (code: string, message: string, suffix?: string) => void,
): void {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    report('AUTHOR_SCROLL_OBSERVATION_EVENTS_INVALID', `emit.observe.${field} must be an array of events.`, `.${field}`)
    return
  }
  value.forEach((event, index) => {
    if (!isPlainRecord(event)
      || Object.keys(event).some((key) => !allowedEventKeys.has(key))
      || typeof event.name !== 'string'
      || (event.once !== undefined && event.once !== true)
      || event.name.trim().length === 0
      || (event.visibility !== undefined && !['story', 'scene', 'public'].includes(String(event.visibility)))
      || (event.mode !== undefined && !['apply-now', 'persist-only'].includes(String(event.mode)))) {
      report(
        'AUTHOR_SCROLL_OBSERVATION_EVENT_INVALID',
        `emit.observe.${field}[${index}] must use the existing ordinary event shape.`,
        `.${field}[${index}]`,
      )
    }
  })
}

/** Normalizes one author emit entry while preserving its source order. */
function normalizeRules(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [value]
}
