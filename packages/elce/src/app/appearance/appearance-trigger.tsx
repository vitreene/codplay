import { Palette } from 'lucide-static'
import { on, type RemixNode } from 'remix/ui'

import type { AppearanceTarget } from '../../domain/commands/document-command-types'
import { renderLucideIcon } from '../remix/lucide-static-icon'

export interface AppearanceTriggerOptions {
  readonly id: string
  readonly target: AppearanceTarget
  readonly label: string
  readonly onOpen: (target: AppearanceTarget, triggerId: string) => void
  readonly className?: string
  readonly visibleLabel?: string
}

/** Renders a keyboard-accessible entry point to the selected appearance scope. */
export function renderAppearanceTrigger(options: AppearanceTriggerOptions): RemixNode {
  return <button
    id={options.id}
    className={options.className ?? 'elce-appearance-trigger'}
    type="button"
    aria-label={options.label}
    aria-controls="elce-appearance-tabpanel"
    title={options.label}
    mix={on<HTMLButtonElement, 'click'>('click', (event) => options.onOpen(options.target, event.currentTarget.id))}
  >
    {renderLucideIcon(Palette, `${options.id}-icon`)}
    {options.visibleLabel === undefined ? null : <span
      id={`${options.id}-label`}
    >
      {options.visibleLabel}
    </span>}
  </button>
}
