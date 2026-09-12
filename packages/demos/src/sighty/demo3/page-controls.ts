import {
  DEMO3_COLOR_INTENTS,
  type Demo3ColorName,
} from './messages'

type Demo3ControlsOptions = Readonly<{
  container: HTMLElement
  injectTextColor: (colorName: Demo3ColorName) => Promise<void>
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

export type Demo3Controls = Readonly<{
  destroy: () => void
}>

const COLOR_NAMES: readonly Demo3ColorName[] = ['blue', 'coral']

/** Creates the two page-level controls that send color events through Sighty. */
export function createDemo3Controls(options: Demo3ControlsOptions): Demo3Controls {
  const cleanups: Array<() => void> = []
  options.container.replaceChildren()
  options.container.className = 'demo3-page-controls'

  for (const colorName of COLOR_NAMES) {
    const button = createColorButton(colorName, options)
    options.container.append(button)
    cleanups.push(() => button.remove())
  }

  return {
    destroy: () => {
      for (const cleanup of cleanups.splice(0)) cleanup()
      options.container.replaceChildren()
      options.container.className = ''
    },
  }
}

/** Creates one page button for a named color event. */
function createColorButton(
  colorName: Demo3ColorName,
  options: Demo3ControlsOptions,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `demo3-page-controls__button demo3-page-controls__button--${colorName}`
  button.dataset.demo3Color = colorName
  button.textContent = colorName === 'blue' ? 'Bleu' : 'Corail'
  button.addEventListener('click', () => {
    void options.injectTextColor(colorName).catch((error: unknown) => {
      options.onLog(error instanceof Error ? error.message : String(error), 'error')
    })
  })
  button.setAttribute('aria-label', `Changer la couleur du texte : ${button.textContent}`)
  button.title = DEMO3_COLOR_INTENTS[colorName]
  return button
}
