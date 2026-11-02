// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render } from 'remix/ui/test'
import type { RichTextDocument } from '../../../domain/document/document-types'
import { renderInlineTextField } from './inline-text-field'
import {
  INLINE_TEXT_LABEL_SELECTION_EVENT,
  INLINE_TEXT_LABEL_UPDATE_EVENT,
} from '../profile/profile-token-events'
import type {
  InlineTextLabelSelectionEventDetail,
  InlineTextLabelUpdateDetail,
} from '../profile/profile-token-events'

describe('InlineTextFieldAdapter', () => {
  it('updates the selected label atom through the field facade and keeps it selected', async () => {
    const value: RichTextDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'localDateLabel',
        attrs: { kind: 'relative', offsetDays: -1 },
      }] }],
    }
    const onChange = vi.fn()
    const rendered = render(<div id="inline-text-field-test-host">
      {renderInlineTextField({
        id: 'inline-text-field-test',
        value,
        ariaLabel: 'Message',
        onChange,
      })}
    </div>)
    const editor = rendered.$('#inline-text-field-test-editor') as HTMLElement
    const selections: InlineTextLabelSelectionEventDetail[] = []
    editor.addEventListener(INLINE_TEXT_LABEL_SELECTION_EVENT, (event) => {
      selections.push((event as CustomEvent<InlineTextLabelSelectionEventDetail>).detail)
    })
    const update: InlineTextLabelUpdateDetail = {
      position: 1,
      expected: { kind: 'local-date', dateKind: 'relative', offsetDays: -1 },
      label: { kind: 'local-date', dateKind: 'relative', offsetDays: 3 },
    }

    await rendered.act(() => editor.dispatchEvent(new CustomEvent(INLINE_TEXT_LABEL_UPDATE_EVENT, {
      bubbles: true,
      detail: update,
    })))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'localDateLabel',
        attrs: { kind: 'relative', offsetDays: 3 },
      }] }],
    }))
    expect(selections.at(-1)).toEqual({
      targetId: editor.id,
      selection: { position: 1, label: update.label },
    })
    rendered.cleanup()
  })
})
