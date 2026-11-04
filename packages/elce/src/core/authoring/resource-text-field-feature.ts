import type { RemixNode } from 'remix/component'
import type { AuthoredTextValue } from '../document/rich-text-types'

export interface ResourceTextFieldOptions {
  readonly id: string
  readonly value: AuthoredTextValue
  readonly ariaLabel: string
  readonly placeholder?: string
  readonly className?: string
  readonly multiline?: boolean
  readonly deferPlainChanges?: boolean
  readonly required?: boolean
  readonly allowPageLinks?: boolean
  readonly allowBoldItalic?: boolean
  readonly maxLength?: number
  readonly onFocus?: () => void
  readonly onKeyDown?: (event: KeyboardEvent) => void
  readonly onChange: (value: AuthoredTextValue) => void
}

/** Lets a mod provide rich text editing while resources retain native fields by default. */
export interface ResourceTextFieldFeature {
  render(options: ResourceTextFieldOptions): RemixNode
}
