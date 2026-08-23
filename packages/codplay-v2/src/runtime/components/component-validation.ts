import type { ValidationContext } from '../../services'
import { isPlainRecord } from '../../shared'

/** Reports one invalid component-owned value at its precise authored path. */
export function reportInvalidComponentValue(
  context: ValidationContext,
  code: string,
  message: string,
  suffix?: string,
): void {
  context.diagnostics.error(code, message, {
    refs: context.refs,
    context: { path: suffix === undefined ? context.path : `${context.path}.${suffix}` },
  })
}

/** Reports whether a value is a record accepted as one component payload. */
export function isComponentRecord(value: unknown): value is Record<string, unknown> {
  return isPlainRecord(value)
}

/** Checks the tag-name grammar shared by the HTML tag and list components. */
export function isComponentTagName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9-]*$/.test(value)
}
