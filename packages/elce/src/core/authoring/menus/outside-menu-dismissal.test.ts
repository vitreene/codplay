// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installOutsideMenuDismissal } from './outside-menu-dismissal'

describe('outside menu dismissal', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('keeps an open controlled menu for inside interactions and dismisses it outside', () => {
    const root = document.createElement('div')
    root.id = 'controlled-menu'
    const inside = document.createElement('button')
    root.append(inside)
    document.body.append(root)
    let isOpen = true
    const onDismiss = vi.fn(() => { isOpen = false })
    const dispose = installOutsideMenuDismissal({
      getRoot: () => document.getElementById(root.id),
      isOpen: () => isOpen,
      onDismiss,
    })

    inside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(onDismiss).not.toHaveBeenCalled()

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(onDismiss).toHaveBeenCalledOnce()

    isOpen = true
    document.body.dispatchEvent(new Event('click', { bubbles: true }))
    expect(onDismiss).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('dismisses native disclosures on outside keyboard clicks and removes listeners', () => {
    const disclosure = document.createElement('details')
    disclosure.id = 'native-menu'
    disclosure.open = true
    document.body.append(disclosure)
    const dispose = installOutsideMenuDismissal({
      getRoot: () => document.getElementById(disclosure.id),
    })

    document.body.dispatchEvent(new Event('click', { bubbles: true }))
    expect(disclosure.open).toBe(false)

    disclosure.open = true
    dispose()
    document.body.dispatchEvent(new Event('click', { bubbles: true }))
    expect(disclosure.open).toBe(true)
  })
})
