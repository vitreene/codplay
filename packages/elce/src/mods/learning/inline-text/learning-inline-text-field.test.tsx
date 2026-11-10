// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import type { ElceTextValue } from '../../../resources/document/rich-text-types'
import { renderInlineTextField } from './learning-inline-text-field'

const fixtures: ReturnType<typeof render>[] = []

afterEach(() => fixtures.splice(0).forEach((fixture) => fixture.cleanup()))

/** Mounts the real native field with a controlled model owned by the test fixture. */
function createNativeFieldFixture() {
  const state: { id: string; value: ElceTextValue; changes: ElceTextValue[] } = {
    id: 'native-title-fixture',
    value: 'Prototype :',
    changes: [],
  }
  const view = (): RemixNode => <main id="native-title-fixture-host">
    {renderInlineTextField({
      id: state.id,
      value: state.value,
      ariaLabel: 'Titre de test',
      className: 'elce-inline-title-input',
      required: true,
      onChange: (value) => {
        state.value = value
        state.changes.push(value)
        rendered.root.render(view())
      },
    })}
  </main>
  const rendered = render(view())
  fixtures.push(rendered)

  /** Returns the currently mounted input after model or identity changes. */
  const field = (): HTMLInputElement => {
    const input = rendered.$(`#${state.id}`)
    if (!(input instanceof HTMLInputElement)) throw new Error('The native title fixture must render an input.')
    return input
  }

  /** Publishes an external model value through the normal parent render. */
  const setValue = (value: string, id = state.id): void => {
    state.value = value
    state.id = id
    rendered.root.render(view())
  }
  return { rendered, state, field, setValue }
}

describe('Native inline text drafts', () => {
  it('keeps trailing-space and empty required drafts visible until blur', async () => {
    const { rendered, state, field } = createNativeFieldFixture()
    await rendered.act(() => {
      field().focus()
      field().value = 'Prototype '
      field().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))
    })
    expect(field().value).toBe('Prototype ')
    expect(field().defaultValue).toBe('Prototype :')
    expect(state.value).toBe('Prototype :')
    expect(state.changes).toEqual([])

    await rendered.act(() => {
      field().value = ''
      field().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))
    })
    expect(field().value).toBe('')
    expect(state.value).toBe('Prototype :')
    await rendered.act(() => field().blur())
    expect(field().value).toBe('Prototype :')

    await rendered.act(() => {
      field().focus()
      field().value = 'Prototype '
      field().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))
    })
    await rendered.act(() => field().blur())
    expect(field().value).toBe('Prototype')
    expect(state.value).toBe('Prototype')
  })

  it('commits the next valid value through the existing change callback', async () => {
    const { rendered, state, field } = createNativeFieldFixture()
    await rendered.act(() => {
      field().focus()
      field().value = 'Prototype '
      field().dispatchEvent(new Event('input', { bubbles: true }))
    })
    await rendered.act(() => {
      field().value = 'Prototype produit'
      field().dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(state.value).toBe('Prototype produit')
    expect(state.changes).toEqual(['Prototype produit'])
    expect(field().value).toBe('Prototype produit')
    expect(field().defaultValue).toBe('Prototype produit')

    await rendered.act(() => {
      field().value = '  Prototype produit  '
      field().dispatchEvent(new Event('input', { bubbles: true }))
    })
    await rendered.act(() => field().blur())
    expect(field().value).toBe('Prototype produit')
    expect(state.value).toBe('Prototype produit')
  })

  it('reconciles external model changes and discards drafts when field identity changes', async () => {
    const { rendered, field, setValue } = createNativeFieldFixture()
    await rendered.act(() => {
      field().focus()
      field().value = 'Prototype '
      field().dispatchEvent(new Event('input', { bubbles: true }))
    })
    await rendered.act(() => setValue('Titre externe'))
    expect(field().value).toBe('Titre externe')

    await rendered.act(() => {
      field().value = ''
      field().dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(field().value).toBe('')
    await rendered.act(() => setValue('Titre externe', 'next-native-title-fixture'))
    expect(field().value).toBe('Titre externe')
  })
})
