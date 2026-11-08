import { on, type Handle } from 'remix/component'
import { Maximize2, Mic, Minimize2, Trash2, X } from 'lucide-static'
import { registerAudioCaptureElement } from '@codplay/audio-capture'
import type { AvatarContent } from '../domain/avatar-types'
import { mattAvatarProfile } from '../reading/avatar-profile'
import { AVATAR_POSITIONS } from '../avatar-config'
import type { AppearanceTarget } from '../../../../domain/appearance/appearance-target-types'
import { renderAppearanceTrigger } from '../../../../core/authoring/appearance-trigger'
import { renderLucideIcon } from '../../../../core/authoring/lucide-static-icon'

registerAudioCaptureElement()

interface AvatarEditorProps {
  readonly bdcId: string
  readonly content: AvatarContent
  readonly audioSource?: string
  readonly onInsert: (audio: File, timeline: File) => Promise<void>
  readonly onUpdate: (content: AvatarContent) => void
  readonly onDelete: () => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
}

const avatarWidthSteps = [10, 20, 30, 45, 60] as const
const avatarWidthLabels = ['Très petit', 'Petit', 'Moyen', 'Grand', 'Très grand'] as const

/** Renders Avatar placement and take details in the shared BDC editor style. */
export function RemixAvatarEditor(handle: Handle<AvatarEditorProps>) {
  return () => {
    const { bdcId, content, onUpdate } = handle.props
    const widthStep = widthStepForPercent(content.placement.widthPercent)
    const captureDialogId = `elce-avatar-capture-dialog-${bdcId}`
    const take = content.take

    return <section
      id={`elce-avatar-editor-${bdcId}`}
      className="elce-card-editor"
      aria-label="Éditeur Avatar"
    >
      <header id={`elce-avatar-header-${bdcId}`} className="elce-card-editor__header">
        <h3 id={`elce-avatar-title-${bdcId}`} className="elce-card-editor__title">Avatar</h3>
        <div id={`elce-avatar-actions-${bdcId}`} className="elce-bdc-header-actions">
          {renderAppearanceTrigger({
            id: `elce-avatar-style-${bdcId}`,
            target: { kind: 'bdc', bdcId },
            label: 'Régler le fond et le style de l’Avatar',
            onOpen: handle.props.onOpenAppearanceTarget,
            className: 'elce-appearance-trigger elce-bdc-style-trigger',
          })}
          <button
            id={`elce-avatar-delete-${bdcId}`}
            className="elce-card-editor__delete"
            type="button"
            aria-label="Supprimer l’Avatar"
            title="Supprimer l’Avatar"
            mix={on<HTMLButtonElement, 'click'>('click', handle.props.onDelete)}
          >
            {renderLucideIcon(Trash2, `elce-avatar-delete-icon-${bdcId}`)}
          </button>
        </div>
      </header>

      <div id={`elce-avatar-settings-${bdcId}`} className="elce-carousel-editor__settings">
        <label id={`elce-avatar-position-label-${bdcId}`} className="elce-carousel-editor__setting">
          <span id={`elce-avatar-position-caption-${bdcId}`}>Position</span>
          <select
            id={`elce-avatar-position-${bdcId}`}
            value={content.placement.position}
            mix={on<HTMLSelectElement, 'change'>('change', (event) => {
              const position = AVATAR_POSITIONS.find(({ value }) => value === event.currentTarget.value)?.value
              if (position !== undefined) onUpdate({ ...content, placement: { ...content.placement, position } })
            })}
          >
            {AVATAR_POSITIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label id={`elce-avatar-width-label-${bdcId}`} className="elce-carousel-editor__setting">
          <span id={`elce-avatar-width-caption-${bdcId}`}>Largeur</span>
          <span id={`elce-avatar-width-control-${bdcId}`} className="elce-carousel-editor__duration-control">
            {renderLucideIcon(Minimize2, `elce-avatar-width-small-icon-${bdcId}`)}
            <input
              id={`elce-avatar-width-${bdcId}`}
              type="range"
              min="1"
              max="5"
              step="1"
              value={widthStep}
              aria-label="Largeur de l’Avatar"
              aria-valuetext={avatarWidthLabels[widthStep - 1]}
              mix={on<HTMLInputElement, 'input'>('input', (event) => {
                const widthPercent = avatarWidthSteps[event.currentTarget.valueAsNumber - 1]
                if (widthPercent !== undefined) onUpdate({ ...content, placement: { ...content.placement, widthPercent } })
              })}
            />
            {renderLucideIcon(Maximize2, `elce-avatar-width-large-icon-${bdcId}`)}
          </span>
        </label>
      </div>

      <section id={`elce-avatar-take-${bdcId}`} className="elce-avatar-editor__take" aria-label="Audio et transcript de l’Avatar">
        <div id={`elce-avatar-audio-row-${bdcId}`} className="elce-avatar-editor__audio-row">
          {take === null || handle.props.audioSource === undefined ? null : <audio
            id={`elce-avatar-audio-${bdcId}`}
            controls={true}
            src={handle.props.audioSource}
          />}
          <button
            id={`elce-avatar-capture-open-${bdcId}`}
            className="elce-avatar-editor__capture"
            type="button"
            aria-haspopup="dialog"
            aria-controls={captureDialogId}
            mix={on<HTMLButtonElement, 'click'>('click', (event) => showCaptureDialog(event.currentTarget, captureDialogId))}
          >
            {renderLucideIcon(Mic, `elce-avatar-capture-icon-${bdcId}`)}
            <span id={`elce-avatar-capture-label-${bdcId}`}>Capture live</span>
          </button>
        </div>
        {take === null
          ? <p id={`elce-avatar-empty-${bdcId}`} className="elce-carousel-editor__empty">Aucune prise sonore associée.</p>
          : <>
            <p id={`elce-avatar-transcript-${bdcId}`} className="elce-avatar-editor__transcript" aria-label="Transcript de la prise">
              {take.words.map(({ text }) => text).join(' ')}
            </p>
            <p id={`elce-avatar-take-info-${bdcId}`} className="elce-avatar-editor__take-info">
              {take.words.length} mots · {(take.durationMs / 1000).toFixed(2)} s
            </p>
          </>}
      </section>

      <dialog
        id={captureDialogId}
        className="elce-export-dialog elce-avatar-capture-dialog"
        aria-labelledby={`elce-avatar-capture-title-${bdcId}`}
      >
        <div id={`elce-avatar-capture-content-${bdcId}`} className="elce-export-dialog__content">
          <header id={`elce-avatar-capture-header-${bdcId}`} className="elce-export-dialog__header">
            <h2 id={`elce-avatar-capture-title-${bdcId}`}>Capture live</h2>
            <button
              id={`elce-avatar-capture-close-${bdcId}`}
              className="elce-export-dialog__close"
              type="button"
              aria-label="Fermer la capture live"
              title="Fermer la capture live"
              mix={on<HTMLButtonElement, 'click'>('click', (event) => closeCaptureDialog(event.currentTarget))}
            >
              {renderLucideIcon(X, `elce-avatar-capture-close-icon-${bdcId}`)}
            </button>
          </header>
          <codplay-audio-capture
            id={`elce-avatar-capture-module-${bdcId}`}
            className="elce-avatar-editor__capture-module"
            data-head-target-runtime-src="/assets/vendor/@rive-app/canvas-advanced-single/canvas_advanced_single.mjs"
            data-head-target-src={mattAvatarProfile.document.src}
            data-head-target-artboard={mattAvatarProfile.document.artboard}
            data-head-target-state-machine={mattAvatarProfile.viewModel.stateMachine}
            data-head-target-view-model={mattAvatarProfile.viewModel.viewModel}
            data-head-target-instance={mattAvatarProfile.viewModel.instance}
            mix={on<HTMLElement, 'audio-capture-insert'>('audio-capture-insert', async (event) => {
              event.preventDefault()
              const dialog = event.currentTarget.closest('dialog')
              try {
                await handle.props.onInsert(event.detail.audio, event.detail.timeline)
                event.detail.complete()
                if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close()
              } catch (error) {
                event.detail.complete(error instanceof Error ? error.message : String(error))
              }
            })}
          />
        </div>
      </dialog>
    </section>
  }
}

/** Maps the stored width to the closest of the five authoring slider steps. */
function widthStepForPercent(widthPercent: number): number {
  return avatarWidthSteps.reduce((closestIndex, candidate, index) =>
    Math.abs(candidate - widthPercent) < Math.abs(avatarWidthSteps[closestIndex]! - widthPercent) ? index : closestIndex, 0) + 1
}

/** Opens the native capture dialog from its Avatar entry point. */
function showCaptureDialog(button: HTMLButtonElement, dialogId: string): void {
  const dialog = button.ownerDocument.getElementById(dialogId)
  if (dialog instanceof HTMLDialogElement) dialog.showModal()
}

/** Closes the native capture dialog from its close control. */
function closeCaptureDialog(button: HTMLButtonElement): void {
  const dialog = button.closest('dialog')
  if (dialog instanceof HTMLDialogElement) dialog.close()
}
