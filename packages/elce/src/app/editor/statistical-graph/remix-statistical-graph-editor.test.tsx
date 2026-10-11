// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { render } from 'remix/ui/test'
import { BDC_TYPE } from '../../../config/document-config'
import { controllerMachine } from '../../controller/controller-machine'
import { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { renderRemixStatisticalGraphEditor } from './remix-statistical-graph-editor'

describe('Remix Statistical Graph editor', () => {
  it('commits numeric cell input and reports oversized paste without changing the matrix', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)
    const initialDocument = controller.getSnapshot().context.document
    const page = initialDocument.pages[0]
    if (page === undefined) throw new Error('The graph editor fixture has no page.')

    actions.createStatisticalGraph(page.id, page.bdcIds.length)
    let document = controller.getSnapshot().context.document
    const graphBdc = document.bdcs.find((entry) => entry.type === BDC_TYPE.STATISTICAL_GRAPH)
    if (graphBdc === undefined || graphBdc.statisticalGraph == null) throw new Error('The graph editor fixture has no statistical graph BDC.')
    const initialGraph = graphBdc.statisticalGraph
    const rendered = render(renderRemixStatisticalGraphEditor(
      graphBdc,
      actions.createStatisticalGraphEditorActions(graphBdc.id, initialGraph),
    ))

    await rendered.act(() => {
      const cell = rendered.$('[aria-label="Valeur catégorie 1, série 1"]') as HTMLInputElement | null
      if (cell === null) throw new Error('The graph editor fixture has no first value cell.')
      cell.value = '12'
      cell.dispatchEvent(new Event('input', { bubbles: true }))
    })

    document = controller.getSnapshot().context.document
    const editedGraph = document.bdcs.find((entry) => entry.id === graphBdc.id)?.statisticalGraph
    expect(editedGraph?.values).toEqual([{ categoryId: initialGraph.categories[0]?.id, seriesId: initialGraph.series[0]?.id, value: 12 }])

    await rendered.act(() => {
      const grid = rendered.$('.elce-statistical-graph-editor__grid') as HTMLTableElement | null
      if (grid === null) throw new Error('The graph editor fixture has no paste grid.')
      const event = new Event('paste', { bubbles: true, cancelable: true })
      const clipboardData = { getData: (type: string) => type === 'text/plain' ? Array.from({ length: 42 }, (_, index) => `R${index + 1}`).join('\n') : '' }
      Object.defineProperty(event, 'clipboardData', { value: clipboardData })
      grid.dispatchEvent(event)
    })

    document = controller.getSnapshot().context.document
    const rejectedGraph = document.bdcs.find((entry) => entry.id === graphBdc.id)?.statisticalGraph
    expect(rejectedGraph?.values).toEqual(editedGraph?.values)
    expect(rendered.$(`#elce-statistical-graph-grid-error-${graphBdc.id}`)?.textContent).toContain('41')

    rendered.cleanup()
    controller.stop()
  })
})
