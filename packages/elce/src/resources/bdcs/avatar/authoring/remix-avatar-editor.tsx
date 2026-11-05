import { on, type Handle } from 'remix/component'
import type { AvatarContent } from '../domain/avatar-types'
import { AVATAR_POSITIONS } from '../avatar-config'
import type { AppearanceTarget } from '../../../../domain/appearance/appearance-target-types'
import { renderAppearanceTrigger } from '../../../../core/authoring/appearance-trigger'

interface AvatarEditorProps {
  readonly bdcId: string
  readonly content: AvatarContent
  readonly audioSource?: string
  readonly onUpdate: (content: AvatarContent) => void
  readonly onImport: (audio: File, timeline: File) => Promise<void>
  readonly onDelete: () => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
}

/** Renders the Avatar's take import, placement and existing appearance controls. */
export function RemixAvatarEditor(handle: Handle<AvatarEditorProps>) {
  let audio: File | undefined
  let timeline: File | undefined
  let status = ''
  let importing = false
  /** Imports the selected files through the controller-owned media queue. */
  const importTake = async (): Promise<void> => {
    if (audio === undefined || timeline === undefined || importing) return
    importing = true
    status = 'Lecture des fichiers…'
    void handle.update()
    await handle.props.onImport(audio, timeline).then(() => { status = 'Prise transmise à la sauvegarde.' }, (error: unknown) => {
      status = error instanceof Error ? error.message : 'Import impossible.'
    })
    importing = false
    if (!handle.signal.aborted) void handle.update()
  }
  return () => {
    const { bdcId, content, onUpdate } = handle.props
    return <section id={`elce-avatar-editor-${bdcId}`} className="elce-carousel-editor" aria-label="Éditeur Avatar">
      <header id={`elce-avatar-header-${bdcId}`} className="elce-carousel-editor__header">
        <h3 id={`elce-avatar-title-${bdcId}`}>Avatar</h3>
        <div id={`elce-avatar-actions-${bdcId}`} className="elce-bdc-header-actions">
          {renderAppearanceTrigger({ id: `elce-avatar-style-${bdcId}`, target: { kind: 'bdc', bdcId }, label: 'Régler le fond et le style de l’Avatar', onOpen: handle.props.onOpenAppearanceTarget, className: 'elce-appearance-trigger elce-bdc-style-trigger' })}
          <button id={`elce-avatar-delete-${bdcId}`} type="button" mix={on('click', handle.props.onDelete)}>Supprimer l’Avatar</button>
        </div>
      </header>
      <fieldset id={`elce-avatar-placement-${bdcId}`}>
        <legend id={`elce-avatar-placement-title-${bdcId}`}>Présentation</legend>
        <label id={`elce-avatar-position-label-${bdcId}`}>Position
          <select id={`elce-avatar-position-${bdcId}`} value={content.placement.position} mix={on<HTMLSelectElement, 'change'>('change', (event) => {
            const position = AVATAR_POSITIONS.find(({ value }) => value === event.currentTarget.value)?.value
            if (position !== undefined) onUpdate({ ...content, placement: { ...content.placement, position } })
          })}>{AVATAR_POSITIONS.map(({ value, label }) => <option value={value}>{label}</option>)}</select>
        </label>
        <label id={`elce-avatar-width-label-${bdcId}`}>Largeur (%)
          <input id={`elce-avatar-width-${bdcId}`} type="number" min="10" max="45" value={content.placement.widthPercent} mix={on<HTMLInputElement, 'change'>('change', (event) => onUpdate({ ...content, placement: { ...content.placement, widthPercent: event.currentTarget.valueAsNumber } }))} />
        </label>
        <label id={`elce-avatar-start-label-${bdcId}`}>
          <input id={`elce-avatar-start-${bdcId}`} type="checkbox" checked={content.autoStart} mix={on<HTMLInputElement, 'change'>('change', (event) => onUpdate({ ...content, autoStart: event.currentTarget.checked }))} /> Démarrer automatiquement
        </label>
      </fieldset>
      <fieldset id={`elce-avatar-take-${bdcId}`}>
        <legend id={`elce-avatar-take-title-${bdcId}`}>Prise sonore</legend>
        {content.take === null ? <p id={`elce-avatar-empty-${bdcId}`}>Choisissez le son et son fichier de transcript et visèmes.</p>
          : <p id={`elce-avatar-take-info-${bdcId}`}>{content.take.words.length} mots · {(content.take.durationMs / 1000).toFixed(2)} s</p>}
        {handle.props.audioSource === undefined ? null : <audio id={`elce-avatar-audio-${bdcId}`} controls src={handle.props.audioSource} />}
        <label id={`elce-avatar-file-label-${bdcId}`}>Son
          <input id={`elce-avatar-file-${bdcId}`} type="file" accept="audio/*" mix={on<HTMLInputElement, 'change'>('change', (event) => { audio = event.currentTarget.files?.[0]; void handle.update() })} />
        </label>
        <label id={`elce-avatar-timeline-label-${bdcId}`}>Transcript et visèmes (JSON)
          <input id={`elce-avatar-timeline-${bdcId}`} type="file" accept=".json,application/json" mix={on<HTMLInputElement, 'change'>('change', (event) => { timeline = event.currentTarget.files?.[0]; void handle.update() })} />
        </label>
        <button id={`elce-avatar-import-${bdcId}`} type="button" disabled={audio === undefined || timeline === undefined || importing} mix={on('click', () => { void importTake() })}>{content.take === null ? 'Utiliser cette prise' : 'Remplacer la prise'}</button>
        <p id={`elce-avatar-status-${bdcId}`} role="status">{status}</p>
      </fieldset>
    </section>
  }
}
