import { createDecorEditorPalette } from './render'
import type { DecorEditorController } from './controller'

export interface MountDecorEditorOptions {
  /** Optional callback for the host when the palette view has been rendered. */
  onRender?: () => void
}

export interface DecorEditorMountHandle {
  /** Suspends the palette view while the player is in playback mode. */
  setPreviewSuspended(suspended: boolean): void
  destroy(): void
}

/** Mounts the decor editor palette without observing or mutating a player node. */
export function mountDecorEditor(
  container: HTMLElement,
  controller: DecorEditorController,
  options: MountDecorEditorOptions = {},
): DecorEditorMountHandle {
  const palette = createDecorEditorPalette(controller)
  palette.element.style.top = '24px'
  palette.element.style.left = '24px'
  container.appendChild(palette.element)
  let previewSuspended = false

  /** Applies the palette-only presentation after each controller update. */
  function render(): void {
    palette.render()
    groupTypoIconFields(palette.element)
    palette.element.style.visibility = previewSuspended ? 'hidden' : ''
    options.onRender?.()
  }

  const unsubscribeController = controller.subscribe(render)
  return {
    setPreviewSuspended(suspended): void {
      previewSuspended = suspended
      palette.element.style.visibility = suspended ? 'hidden' : ''
    },
    destroy(): void {
      unsubscribeController()
      container.innerHTML = ''
    },
  }
}

/** Groups the three unlabeled typography controls into the compact toolbar row. */
function groupTypoIconFields(paletteEl: HTMLElement): void {
  const panel = paletteEl.querySelector('.dedit-panel')
  if (!panel) return
  const rows = Array.from(panel.querySelectorAll<HTMLElement>(':scope > .dedit-field'))
  const unlabeled = rows.filter((row) => !row.querySelector('.dedit-field__label'))
  if (unlabeled.length < 3) return

  const [bold, italic, align] = unlabeled
  if (!bold || !italic || !align) return
  const wrapper = document.createElement('div')
  wrapper.classList.add('dedit-icon-row')
  bold.before(wrapper)
  wrapper.append(bold, italic)
  const separator = document.createElement('div')
  separator.classList.add('dedit-icon-row__separator')
  wrapper.append(separator, align)
}
