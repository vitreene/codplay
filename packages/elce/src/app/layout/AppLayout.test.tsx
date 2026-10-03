/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createActor } from 'xstate'
import { afterEach, describe, expect, it } from 'vitest'
import { controllerMachine } from '../controller/controller-machine'
import { AppLayout } from './AppLayout'

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })

describe('AppLayout authoring titles and creation actions', () => {
  let root: ReturnType<typeof createRoot> | undefined
  let stopActor: (() => void) | undefined

  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    stopActor?.()
    stopActor = undefined
    document.body.replaceChildren()
  })

  it('creates pages and chapters from accessible icon buttons', async () => {
    const { actor, host } = mountApp()
    const pageButton = host.querySelector<HTMLButtonElement>('#elce-create-page')
    const chapterButton = host.querySelector<HTMLButtonElement>('#elce-create-chapter')

    expect(pageButton?.getAttribute('aria-label')).toBe('Ajouter une page')
    expect(pageButton?.querySelector('svg')).not.toBeNull()
    expect(pageButton?.textContent?.trim()).toBe('')
    expect(chapterButton?.getAttribute('aria-label')).toBe('Ajouter un chapitre')
    expect(chapterButton?.querySelector('svg')).not.toBeNull()
    expect(chapterButton?.textContent?.trim()).toBe('')

    await act(async () => pageButton?.click())
    expect(actor.getSnapshot().context.document.pages[1]?.name).toBe('Page B')
    expect(actor.getSnapshot().context.selectedPageId).toBe(actor.getSnapshot().context.document.pages[1]?.id)

    await act(async () => chapterButton?.click())
    expect(actor.getSnapshot().context.document.chapters).toHaveLength(2)
  })

  it('edits page and chapter titles in the central work area through XState', async () => {
    const { actor, host } = mountApp()
    const pageTitle = host.querySelector<HTMLInputElement>('#elce-page-title-page-a')
    const chapterTitle = host.querySelector<HTMLInputElement>('#elce-chapter-title-chapter-1')

    expect(host.querySelector('#elce-create-page-name')).toBeNull()
    expect(pageTitle?.value).toBe('Page A')
    expect(chapterTitle?.value).toBe('Chapitre 1')

    await act(async () => commitInput(pageTitle!, 'Présentation'))
    await act(async () => commitInputWithEnter(chapterTitle!, 'Introduction'))

    expect(actor.getSnapshot().context.document.pages[0]?.name).toBe('Présentation')
    expect(actor.getSnapshot().context.document.chapters[0]?.name).toBe('Introduction')
    expect(host.querySelector('#elce-pages-chapter-1-select-page-a')?.textContent).toBe('Présentation')
    expect(host.querySelector('#elce-chapter-name-chapter-1')?.textContent).toBe('Introduction')
  })

  /** Mounts the real work area with a running XState controller. */
  function mountApp() {
    const actor = createActor(controllerMachine, { input: {} })
    actor.start()
    stopActor = () => actor.stop()
    const host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)

    act(() => root?.render(<AppLayout controller={actor} />))
    return { actor, host }
  }

  /** Commits an uncontrolled title field with the same blur event used in the interface. */
  function commitInput(input: HTMLInputElement, value: string) {
    input.focus()
    input.value = value
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  }

  /** Commits a title by pressing Enter, which blurs the central field. */
  function commitInputWithEnter(input: HTMLInputElement, value: string) {
    input.focus()
    input.value = value
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  }
})
