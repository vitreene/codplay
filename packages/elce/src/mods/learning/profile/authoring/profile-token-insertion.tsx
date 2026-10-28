import { on, type RemixNode } from 'remix/ui'
import type { ProfileProperty } from '../domain/learning-profile-types'
import { PROFILE_TOKEN_INSERT_EVENT } from './profile-token-events'

/** Renders the one contextual control for inserting stable profile references. */
export function renderProfileTokenInsertion(
  id: string,
  properties: readonly ProfileProperty[],
  targetId: string,
): RemixNode {
  if (properties.length === 0) return null
  return <div id={id} className="elce-profile-token-insertion" role="group" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Variables de profil</h2>
    <p id={`${id}-description`} className="elce-muted">Insérer une variable dans le champ sélectionné.</p>
    <ul id={`${id}-list`} className="elce-profile-token-insertion__list">
      {properties.map((property) => <li id={`${id}-row-${property.id}`} key={property.id}>
        <button
          id={`${id}-${property.id}`}
          className="elce-profile-token-insertion__button"
          type="button"
          aria-label={`Insérer ${property.label}`}
          title={`Insérer ${property.label}`}
          mix={[
            on<HTMLButtonElement, 'mousedown'>('mousedown', (event) => event.preventDefault()),
            on<HTMLButtonElement, 'click'>('click', () => insertProfileToken(property.id, targetId)),
          ]}
        >
          {property.label}
        </button>
      </li>)}
    </ul>
  </div>
}

/** Inserts one stable profile reference into the selected authored text target. */
function insertProfileToken(propertyId: string, targetId: string): void {
  const target = document.getElementById(targetId)
  if (!(target instanceof HTMLElement) || target.dataset.elceProfileTokenTarget !== 'true') return
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    insertTextToken(target, propertyId)
    return
  }
  if (target.getAttribute('contenteditable') !== 'true') return
  target.dispatchEvent(new CustomEvent(PROFILE_TOKEN_INSERT_EVENT, {
    detail: { propertyId },
  }))
}

/** Replaces the current input selection with the stable profile token syntax. */
function insertTextToken(target: HTMLInputElement | HTMLTextAreaElement, propertyId: string): void {
  const start = target.selectionStart ?? target.value.length
  const end = target.selectionEnd ?? start
  const token = `{{profile:${propertyId}}}`
  target.setRangeText(token, start, end, 'end')
  target.dispatchEvent(new Event('input', { bubbles: true }))
  target.focus()
}
