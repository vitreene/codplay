interface OutsideMenuDismissalOptions {
  readonly getRoot: () => HTMLElement | null
  readonly isOpen?: () => boolean
  readonly onDismiss?: () => void
}

/** Closes an open native or controlled menu when an outside interaction occurs. */
export function installOutsideMenuDismissal(options: OutsideMenuDismissalOptions): () => void {
  const dismissOnOutsideInteraction = (event: Event): void => {
    const root = options.getRoot()
    const isOpen = options.isOpen?.() ?? (root instanceof HTMLDetailsElement && root.open)
    if (!isOpen || (event.target instanceof Node && root?.contains(event.target))) return
    if (root instanceof HTMLDetailsElement) root.open = false
    options.onDismiss?.()
  }

  document.addEventListener('pointerdown', dismissOnOutsideInteraction, true)
  document.addEventListener('click', dismissOnOutsideInteraction, true)
  return () => {
    document.removeEventListener('pointerdown', dismissOnOutsideInteraction, true)
    document.removeEventListener('click', dismissOnOutsideInteraction, true)
  }
}
